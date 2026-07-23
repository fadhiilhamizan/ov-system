"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_META, STATUS_ORDER } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { createTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import { useT } from "@/lib/i18n/provider";
import { MemberPicker, type PickerRole } from "@/components/members/member-picker";
import { useMembers, useTeams } from "@/components/members/members-context";
import { useTaskLinks } from "./task-links-context";
import { ResultLinksEditor, toDraft, validateLinks, type DraftLink } from "./result-links-editor";
import type { AppUser, Division, DivisionKey, OVEvent, Task, TaskStatus } from "@/lib/types";

export function TaskFormDialog({
  mode,
  task,
  divisions,
  events,
  activeEventId,
  defaultDivision,
  defaultEndDate,
  user,
  open,
  onOpenChange,
  trigger,
}: {
  mode: "create" | "edit";
  task?: Task;
  divisions: Division[];
  events: OVEvent[];
  activeEventId: string;
  defaultDivision?: DivisionKey;
  defaultEndDate?: string;
  user: AppUser;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const t = useT();
  const members = useMembers();
  const teams = useTeams();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [pending, start] = React.useTransition();

  const progressOnly = mode === "edit" && task ? !can.editTask(user, task) : false;

  const [form, setForm] = React.useState(() => ({
    event_id: task?.event_id ?? activeEventId,
    division: (task?.division ?? defaultDivision ?? "EVENT") as DivisionKey,
    pic: task?.pic ?? "",
    title: task?.title ?? "",
    start_date: task?.start_date ?? "",
    end_date: task?.end_date ?? defaultEndDate ?? "",
    notes: task?.notes ?? "",
    result: task?.result ?? "",
    status: (task?.status ?? "todo") as TaskStatus,
  }));

  const existingLinks = useTaskLinks(task?.id);
  const [links, setLinks] = React.useState<DraftLink[]>(() => existingLinks.map(toDraft));

  // PIC picker: only this division's members, grouped by role (coordinator from
  // the division's team, else the member's fungsionaris/intern type).
  const divisionMembers = React.useMemo(
    () => members.filter((m) => m.division === form.division),
    [members, form.division],
  );
  const coordinatorNames = React.useMemo(() => {
    const team = teams.find((tm) => tm.division === form.division);
    return new Set(
      (team?.coordinator ?? "")
        .split(/\s{2,}|,|·/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
  }, [teams, form.division]);
  const roleOf = React.useCallback(
    (m: { nickname: string; name: string; type: "fungsionaris" | "intern" }): PickerRole => {
      const nn = (m.nickname || m.name).toLowerCase();
      if (coordinatorNames.has(nn) || coordinatorNames.has(m.name.toLowerCase())) return "coordinator";
      return m.type;
    },
    [coordinatorNames],
  );

  React.useEffect(() => {
    if (isOpen && task) {
      setForm({
        event_id: task.event_id,
        division: task.division,
        pic: task.pic,
        title: task.title,
        start_date: task.start_date ?? "",
        end_date: task.end_date ?? "",
        notes: task.notes,
        result: task.result,
        status: task.status,
      });
      setLinks(existingLinks.map(toDraft));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task]);

  /** `markDone` = the "Simpan & Selesai" shortcut: save and flip status to done
   *  in one go, so submitting a result doesn't need a second status edit. */
  function submit(markDone = false) {
    const problem = validateLinks(links);
    if (problem === "invalid") {
      toast.error(t("Ada tautan hasil yang tidak valid (harus diawali http:// atau https://)."));
      return;
    }
    if (problem === "duplicate") {
      toast.error(t("Ada tautan hasil yang sama lebih dari sekali."));
      return;
    }
    // Drop empty rows and strip the client-only `key`.
    const payloadLinks = links
      .filter((l) => l.url.trim())
      .map(({ id, url, label, in_super_link }) => ({ id, url: url.trim(), label, in_super_link }));

    start(async () => {
      const status = markDone ? ("done" as const) : form.status;
      const fullPayload = {
        ...form,
        status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      // When the user only has progress access (staff/intern on their task),
      // send just status+result so the server keeps them in the "progress only"
      // permission lane — sending every field would require full edit rights.
      const res =
        mode === "create"
          ? await createTaskAction(fullPayload, payloadLinks)
          : await updateTaskAction(
              task!.id,
              progressOnly ? { status, result: form.result } : fullPayload,
              payloadLinks,
            );
      if (res.ok) {
        toast.success(
          markDone
            ? t("Tugas disimpan & ditandai selesai")
            : mode === "create" ? t("Tugas ditambahkan") : t("Tugas diperbarui"),
        );
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Tambah Tugas") : t("Edit Tugas")}</DialogTitle>
          <DialogDescription>
            {progressOnly
              ? t("Kamu dapat memperbarui Status & Hasil tugas ini.")
              : t("Lengkapi detail tugas pada Work Breakdown Structure.")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 py-1">
          {!progressOnly && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="title">
                  {t("Judul tugas / Job Description")} <span className="text-danger">*</span>
                </Label>
                <Textarea
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t("Contoh: Pembuatan Rundown Ormawa Visit")}
                  className="min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>
                    {t("Divisi")} <span className="text-danger">*</span>
                  </Label>
                  <Select
                    value={form.division}
                    onValueChange={(v) => setForm({ ...form, division: v as DivisionKey })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((d) => (
                        <SelectItem key={d.key} value={d.key}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>
                    {t("Ormawa Visit")} <span className="text-danger">*</span>
                  </Label>
                  <Select
                    value={form.event_id}
                    onValueChange={(v) => setForm({ ...form, event_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>{t("PIC / Penanggung Jawab")}</Label>
                <MemberPicker
                  members={divisionMembers}
                  value={form.pic}
                  onChange={(v) => setForm({ ...form, pic: v })}
                  placeholder={t("Pilih dari anggota divisi ini")}
                  roleOf={roleOf}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="start">{t("Mulai")}</Label>
                  <Input
                    id="start"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="end">{t("Deadline")}</Label>
                  <Input
                    id="end"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="notes">{t("Important Notes")}</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={t("Catatan penting, konteks, atau evaluasi dari OV sebelumnya")}
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Status")}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="result">{t("Hasil — deskripsi")}</Label>
            <Textarea
              id="result"
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
              placeholder={t("Ringkas apa yang sudah dikerjakan / hasilnya")}
              className="min-h-[60px]"
            />
          </div>

          <ResultLinksEditor links={links} onChange={setLinks} />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("Batal")}</Button>
          </DialogClose>
          {form.status !== "done" && (
            <Button
              variant="outline"
              className="border-emerald-500/60 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
              onClick={() => submit(true)}
              disabled={pending || !form.title.trim()}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {t("Simpan & Selesai")}
            </Button>
          )}
          <Button onClick={() => submit(false)} disabled={pending || !form.title.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? t("Tambah Tugas") : t("Simpan Perubahan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
