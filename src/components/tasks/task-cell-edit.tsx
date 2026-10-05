"use client";
import * as React from "react";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberPicker, type PickerRole } from "@/components/members/member-picker";
import { useMembers, useTeams } from "@/components/members/members-context";
import { isCoordinator, splitForDivision } from "@/lib/members";
import { updateTaskAction } from "@/lib/actions/tasks";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { useTaskStore } from "./task-store";
import { useTaskLinks, useTaskRefs, useSuperLinks } from "./task-links-context";
import { ResultLinksEditor, toDraft, validateLinks, type DraftLink } from "./result-links-editor";
import { RefsEditor, toRefDraft, validateRefs, cleanRefs, newRefDraft, type DraftRef } from "./refs-editor";
import type { AppUser, Division, Member, Task } from "@/lib/types";

// ============================================================
// Edit ONE cell of the Work Breakdown table without opening the task form.
//
// Every column but Status (which already has its own pill menu) gets a small
// pencil in its top-right corner. The cell reserves room for it (`pr-8`), so
// the pencil never sits on top of the text it edits. Pressing it opens a
// popover holding only that cell's field(s) for that one row.
//
// Plain task fields go through the shared local-first store (task-store.tsx):
// the table shows the new value as soon as the popover closes, and the write
// queues behind every other write to the list. References and result links do
// not live on the task row (they are `task_refs` / `task_links`), so those two
// wait for the server like the task dialog does, and keep the popover open on
// an error so nothing typed is lost.
// ============================================================

export type TaskCellField = "title" | "evaluation" | "division" | "pic" | "deadline" | "refs" | "result";

/** Who may edit which cell. Results are "progress" (filling in what was done). */
export function canEditCell(user: AppUser, field: TaskCellField): boolean {
  return field === "result" ? can.editTaskProgress(user) : can.editTask(user);
}

/**
 * A table cell with an edit pencil. Renders a plain cell when the account may
 * not edit this field, so read-only roles see exactly the table they had.
 */
export function EditableTaskCell({
  task, field, user, divisions, className, children,
}: {
  task: Task;
  field: TaskCellField;
  user: AppUser;
  divisions: Division[];
  className?: string;
  children: React.ReactNode;
}) {
  const editable = canEditCell(user, field);
  return (
    <TableCell className={cn(className, editable && "group/cell relative pr-8")}>
      {children}
      {editable && <CellEditButton task={task} field={field} divisions={divisions} />}
    </TableCell>
  );
}

const FIELD_LABEL: Record<TaskCellField, string> = {
  title: "Tugas",
  evaluation: "Evaluasi",
  division: "Divisi",
  pic: "PIC",
  deadline: "Deadline",
  refs: "Referensi",
  result: "Hasil",
};

function CellEditButton({ task, field, divisions }: { task: Task; field: TaskCellField; divisions: Division[] }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const wide = field === "refs" || field === "result";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t("Edit")} ${t(FIELD_LABEL[field])}`}
          title={`${t("Edit")} ${t(FIELD_LABEL[field])}`}
          className={cn(
            "absolute right-1.5 top-2.5 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition",
            "hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            // Hidden until the row is hovered, faint across the row, full on
            // the cell under the pointer. Always visible on touch screens,
            // which have no hover, and while its popover is open.
            "opacity-0 group-hover/row:opacity-40 group-hover/cell:opacity-100 [@media(hover:none)]:opacity-70",
            open && "bg-muted text-foreground opacity-100",
          )}
        >
          <Pencil className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn("space-y-3 p-3", wide ? "w-[min(30rem,calc(100vw-2rem))]" : "w-80")}
        // Opening moves focus into the first field, not onto the popover box.
        onOpenAutoFocus={(e) => {
          const el = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>("textarea, input, button[role=combobox]");
          if (el) { e.preventDefault(); el.focus(); }
        }}
      >
        {open && <CellEditor task={task} field={field} divisions={divisions} close={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function CellEditor({
  task, field, divisions, close,
}: {
  task: Task;
  field: TaskCellField;
  divisions: Division[];
  close: () => void;
}) {
  switch (field) {
    case "title": return <TitleEditor task={task} close={close} />;
    case "evaluation": return <TextFieldEditor task={task} field="evaluation" close={close} />;
    case "division": return <DivisionEditor task={task} divisions={divisions} close={close} />;
    case "pic": return <PicEditor task={task} close={close} />;
    case "deadline": return <DeadlineEditor task={task} close={close} />;
    case "refs": return <RefsCellEditor task={task} close={close} />;
    case "result": return <ResultCellEditor task={task} close={close} />;
  }
}

/** Save plain task fields: local-first when the table's store is there. */
function useSaveFields(task: Task) {
  const t = useT();
  const store = useTaskStore();
  const [pending, start] = React.useTransition();
  function save(fields: Partial<Task>, close: () => void) {
    if (store) {
      close();
      store.patch(task.id, fields, () => updateTaskAction(task.id, fields), { success: t("Tugas diperbarui") });
      return;
    }
    start(async () => {
      const res = await updateTaskAction(task.id, fields);
      if (res.ok) { toast.success(t("Tugas diperbarui")); close(); }
      else toast.error(res.error);
    });
  }
  return { save, pending };
}

function Footer({ onSave, disabled, pending, close }: {
  onSave: () => void;
  disabled?: boolean;
  pending?: boolean;
  close: () => void;
}) {
  const t = useT();
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="outline" size="sm" onClick={close}>{t("Batal")}</Button>
      <Button size="sm" onClick={onSave} disabled={disabled || pending}>
        {pending && <Loader2 className="size-3.5 animate-spin" />}
        {t("Simpan")}
      </Button>
    </div>
  );
}

/** Ctrl/Cmd+Enter saves from a multi-line field (plain Enter is a new line). */
function saveOnModEnter(onSave: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSave(); }
  };
}

function TitleEditor({ task, close }: { task: Task; close: () => void }) {
  const t = useT();
  const { save, pending } = useSaveFields(task);
  const [title, setTitle] = React.useState(task.title);
  const [notes, setNotes] = React.useState(task.notes ?? "");
  const ok = !!title.trim();
  const submit = () => { if (ok) save({ title, notes }, close); };
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`cell-title-${task.id}`}>
          {t("Judul tugas / Job Description")} <span className="text-danger">*</span>
        </Label>
        <Textarea id={`cell-title-${task.id}`} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={saveOnModEnter(submit)} className="min-h-[60px]" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`cell-notes-${task.id}`}>{t("Important Notes")}</Label>
        <Textarea id={`cell-notes-${task.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} onKeyDown={saveOnModEnter(submit)} placeholder={t("Catatan penting atau konteks tugas")} />
      </div>
      <Footer onSave={submit} disabled={!ok} pending={pending} close={close} />
    </>
  );
}

function TextFieldEditor({ task, field, close }: { task: Task; field: "evaluation"; close: () => void }) {
  const t = useT();
  const { save, pending } = useSaveFields(task);
  const [value, setValue] = React.useState(task[field] ?? "");
  const submit = () => save({ [field]: value }, close);
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`cell-${field}-${task.id}`}>{t("Evaluasi")}</Label>
        <Textarea
          id={`cell-${field}-${task.id}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={saveOnModEnter(submit)}
          placeholder={t("Evaluasi tugas ini dari Ormawa Visit sebelumnya dan/atau Ormawa Visit sekarang")}
          className="min-h-[90px]"
        />
      </div>
      <Footer onSave={submit} pending={pending} close={close} />
    </>
  );
}

function DivisionEditor({ task, divisions, close }: { task: Task; divisions: Division[]; close: () => void }) {
  const t = useT();
  const { save, pending } = useSaveFields(task);
  const [value, setValue] = React.useState(task.division);
  return (
    <>
      <div className="grid gap-1.5">
        <Label>{t("Divisi")}</Label>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {divisions.map((d) => <SelectItem key={d.key} value={d.key}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Footer onSave={() => save({ division: value }, close)} disabled={value === task.division} pending={pending} close={close} />
    </>
  );
}

function PicEditor({ task, close }: { task: Task; close: () => void }) {
  const t = useT();
  const members = useMembers();
  const teams = useTeams();
  const { save, pending } = useSaveFields(task);
  const [value, setValue] = React.useState(task.pic ?? "");
  // Same grouping as the task form: this division's people first, the rest of
  // the edition's roster underneath (see splitForDivision).
  const team = React.useMemo(() => teams.find((tm) => tm.division === task.division), [teams, task.division]);
  const { inDivision, others } = React.useMemo(
    () => splitForDivision(members, task.division, team),
    [members, task.division, team],
  );
  const roleOf = React.useCallback(
    (m: Member): PickerRole => (isCoordinator(m, team) ? "coordinator" : m.type),
    [team],
  );
  return (
    <>
      <div className="grid gap-1.5">
        <Label>{t("PIC / Penanggung Jawab")}</Label>
        <MemberPicker
          members={inDivision}
          value={value}
          onChange={setValue}
          placeholder={t("Pilih dari anggota divisi ini")}
          roleOf={roleOf}
          extra={{ label: t("Anggota divisi lain"), members: others }}
        />
      </div>
      <Footer onSave={() => save({ pic: value }, close)} pending={pending} close={close} />
    </>
  );
}

function DeadlineEditor({ task, close }: { task: Task; close: () => void }) {
  const t = useT();
  const { save, pending } = useSaveFields(task);
  const [value, setValue] = React.useState(task.end_date ?? "");
  const submit = () => save({ end_date: value || null }, close);
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`cell-deadline-${task.id}`}>{t("Deadline")}</Label>
        <Input
          id={`cell-deadline-${task.id}`}
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        />
        {task.start_date && value && value < task.start_date && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">{t("Deadline lebih awal dari tanggal mulai tugas.")}</p>
        )}
      </div>
      <Footer onSave={submit} pending={pending} close={close} />
    </>
  );
}

function RefsCellEditor({ task, close }: { task: Task; close: () => void }) {
  const t = useT();
  const existing = useTaskRefs(task.id);
  const superLinks = useSuperLinks();
  const [refs, setRefs] = React.useState<DraftRef[]>(() =>
    existing?.length ? existing.map(toRefDraft) : [newRefDraft()]);
  const [pending, start] = React.useTransition();
  // The page never loaded references: an empty editor would read as "none"
  // and saving it would wipe the real ones. Same rule as the task form.
  if (existing === undefined) {
    return <p className="text-xs text-muted-foreground">{t("Referensi belum dapat diubah dari halaman ini.")}</p>;
  }
  function submit() {
    const problem = validateRefs(refs);
    if (problem === "invalid") { toast.error(t("Ada referensi yang tidak valid (harus diawali http:// atau https://).")); return; }
    if (problem === "duplicate") { toast.error(t("Ada referensi yang sama lebih dari sekali.")); return; }
    start(async () => {
      const res = await updateTaskAction(task.id, {}, undefined, cleanRefs(refs));
      if (res.ok) { toast.success(t("Referensi diperbarui")); close(); }
      else toast.error(res.error);
    });
  }
  return (
    <>
      <div className="max-h-[55vh] overflow-y-auto pr-0.5">
        <RefsEditor refs={refs} onChange={setRefs} links={superLinks} />
      </div>
      <Footer onSave={submit} pending={pending} close={close} />
    </>
  );
}

function ResultCellEditor({ task, close }: { task: Task; close: () => void }) {
  const t = useT();
  const existing = useTaskLinks(task.id);
  const [result, setResult] = React.useState(task.result ?? "");
  // Results are always published and need a title; unnamed legacy links are
  // prefilled with the task title, exactly as the task form does.
  const [links, setLinks] = React.useState<DraftLink[]>(() =>
    existing.map((l, i) => ({ ...toDraft(l, i), label: l.label?.trim() || task.title, in_super_link: true })));
  const [pending, start] = React.useTransition();
  function submit() {
    const problem = validateLinks(links, { requireName: true });
    if (problem === "invalid") { toast.error(t("Ada tautan hasil yang tidak valid (harus diawali http:// atau https://).")); return; }
    if (problem === "unnamed") { toast.error(t("Setiap tautan hasil wajib diberi judul.")); return; }
    if (problem === "duplicate") { toast.error(t("Ada tautan hasil yang sama lebih dari sekali.")); return; }
    const payload = links
      .filter((l) => l.url.trim())
      .map(({ id, url, label }) => ({ id, url: url.trim(), label: label.trim(), in_super_link: true }));
    start(async () => {
      const res = await updateTaskAction(task.id, { result }, payload);
      // The action's response carries the revalidated page, so the table
      // already shows the new description and links by the time this runs.
      if (res.ok) { toast.success(t("Hasil diperbarui")); close(); }
      else toast.error(res.error);
    });
  }
  return (
    <>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-0.5">
        <div className="grid gap-1.5">
          <Label htmlFor={`cell-result-${task.id}`}>{t("Hasil - deskripsi")}</Label>
          <Textarea
            id={`cell-result-${task.id}`}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder={t("Ringkas apa yang sudah dikerjakan / hasilnya")}
            className="min-h-[60px]"
          />
        </div>
        <ResultLinksEditor links={links} onChange={setLinks} />
      </div>
      <Footer onSave={submit} pending={pending} close={close} />
    </>
  );
}
