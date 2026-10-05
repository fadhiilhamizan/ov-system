"use client";
import * as React from "react";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, ClipboardList, GripVertical, Copy } from "lucide-react";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";
import { ExpandableText } from "@/components/ui/expandable-text";
import { createJobAction, updateJobAction, deleteJobAction, reorderJobsAction, duplicateJobAction } from "@/lib/actions/schedule";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";
import { useLocalFirst, type LocalFirst } from "@/lib/use-local-first";
import { LocalSaveStatus } from "@/components/ui/local-save-status";
import { MemberPicker } from "@/components/members/member-picker";
import { useMembers } from "@/components/members/members-context";
import { cn, uuidV4 } from "@/lib/utils";
import type { JobHariH } from "@/lib/types";
import { ImportXlsxButton } from "@/components/ui/import-xlsx";

function JobFormDialog({
  mode, job, eventId, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  job?: JobHariH;
  eventId: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const t = useT();
  const members = useMembers();
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();
  const [f, setF] = useResetOn(`${isOpen}:${job?.id ?? "new"}`, () => ({
    pic: job?.pic ?? "", job: job?.job ?? "", notes: job?.notes ?? "",
  }));

  function submit() {
    start(async () => {
      const res = mode === "create"
        ? await createJobAction({ ...f, event_id: eventId })
        : await updateJobAction(job!.id, f);
      if (res.ok) { toast.success(mode === "create" ? t("Tugas ditambahkan") : t("Tugas diperbarui")); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Tambah Tugas Hari-H") : t("Edit Tugas Hari-H")}</DialogTitle>
          <DialogDescription>{t("Pembagian tugas panitia saat hari pelaksanaan.")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>
              {t("Deskripsi tugas")} <span className="text-danger">*</span>
            </Label>
            <Input value={f.job} onChange={(e) => setF({ ...f, job: e.target.value })} placeholder="MC Acara" />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("PIC")}</Label>
            <MemberPicker
              members={members}
              value={f.pic}
              onChange={(v) => setF({ ...f, pic: v })}
              placeholder={t("Pilih dari anggota")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Catatan (opsional)")}</Label>
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="min-h-[56px]" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.job.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}{mode === "create" ? t("Tambah") : t("Simpan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobActions({
  job, eventId, canDelete, store,
}: { job: JobHariH; eventId: string; canDelete: boolean; store: LocalFirst<JobHariH> }) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> {t("Edit")}</DropdownMenuItem>
          {/* Both show at once and save in the background (use-local-first).
              The copy lands at the end, where its new number puts it. */}
          <DropdownMenuItem onSelect={() => {
            const id = uuidV4();
            store.add(
              { ...job, id, no: "", job: `${job.job} (salinan)` },
              () => duplicateJobAction(job.id, id),
              { success: t("Tugas diduplikat") },
            );
          }}><Copy /> {t("Duplikat")}</DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem destructive onSelect={() => {
              store.remove([job.id], () => deleteJobAction(job.id), { success: t("Tugas dihapus") });
            }}><Trash2 /> {t("Hapus")}</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <JobFormDialog mode="edit" job={job} eventId={eventId} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

function PicChips({ pic }: { pic: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {pic ? pic.split(",").map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs">
          <Avatar name={p.trim()} size={18} /> {p.trim()}
        </span>
      )) : <span className="text-sm text-muted-foreground">-</span>}
    </div>
  );
}

function SortableJobRow({
  job, index, eventId, canManage, canDelete, store,
}: {
  job: JobHariH; index: number; eventId: string; canManage: boolean; canDelete: boolean;
  store: LocalFirst<JobHariH>;
}) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id, disabled: !canManage });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-border transition-colors hover:bg-muted/50",
        isDragging && "relative z-10 bg-muted shadow-lg",
      )}
    >
      {canManage && (
        <TableCell cell="select" className="w-8 pr-0">
          <button
            {...attributes}
            {...listeners}
            className="flex cursor-grab touch-none items-center justify-center rounded p-1 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={t("Geser untuk mengurutkan")}
          >
            <GripVertical className="size-4" />
          </button>
        </TableCell>
      )}
      <TableCell cell="hide-mobile" className="text-sm font-medium tabular-nums text-muted-foreground">{index + 1}</TableCell>
      <TableCell cell="primary" className="font-medium">
        <span className="mr-1.5 text-xs tabular-nums text-muted-foreground md:hidden">{index + 1}.</span>{job.job}
      </TableCell>
      <TableCell label={t("PIC")}><PicChips pic={job.pic} /></TableCell>
      <TableCell label={t("Catatan")} className="max-w-[280px] align-top text-xs text-muted-foreground">
        <ExpandableText text={job.notes} />
      </TableCell>
      {canManage && <TableCell cell="actions"><JobActions job={job} eventId={eventId} canDelete={canDelete} store={store} /></TableCell>}
    </tr>
  );
}

export function JobsTable({
  jobs, eventId, canManage, canDelete,
}: {
  jobs: JobHariH[];
  eventId: string;
  /** "limited" access and up: add, edit, reorder, duplicate. */
  canManage: boolean;
  /** "full" access only: remove rows. */
  canDelete: boolean;
}) {
  const t = useT();
  const sorted = React.useMemo(
    () => [...jobs].sort((a, b) => (parseInt(a.no, 10) || 0) - (parseInt(b.no, 10) || 0)),
    [jobs],
  );
  // Local-first: drag, duplicate and delete show at once (use-local-first).
  const store = useLocalFirst(sorted);
  const items = store.rows;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((j) => j.id === active.id);
    const to = items.findIndex((j) => j.id === over.id);
    if (from < 0 || to < 0) return;
    const ids = arrayMove(items, from, to).map((j) => j.id);
    store.reorder(ids, () => reorderJobsAction(ids));
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {t("Seret ikon untuk mengurutkan; nomor tersusun otomatis.")}
            <LocalSaveStatus status={store.status} />
          </p>
          <div className="flex items-center gap-2">
            <ImportXlsxButton module="jobs" />
            <JobFormDialog mode="create" eventId={eventId} trigger={
              <DialogTrigger asChild><Button aria-keyshortcuts="N"><Plus className="size-4" /> <span className="hidden sm:inline">{t("Tambah Tugas")}</span><span className="sr-only sm:hidden">{t("Tambah Tugas")}</span></Button></DialogTrigger>
            } />
          </div>
        </div>
      )}

      {items.length ? (
        <div className="rounded-xl border border-border bg-card">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <Table stack>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {canManage && <TableHead className="w-8" />}
                  <TableHead className="w-12">{t("No")}</TableHead>
                  <TableHead className="min-w-[240px]">{t("Job Description")}</TableHead>
                  <TableHead className="min-w-[160px]">{t("PIC")}</TableHead>
                  <TableHead>{t("Catatan")}</TableHead>
                  {canManage && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext items={items.map((j) => j.id)} strategy={verticalListSortingStrategy}>
                  {items.map((j, i) => (
                    <SortableJobRow key={j.id} job={j} index={i} eventId={eventId} canManage={canManage} canDelete={canDelete} store={store} />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>
      ) : (
        <EmptyState icon={<ClipboardList />} title={t("Belum ada pembagian tugas")} description={t("Tambahkan pembagian tugas hari-H untuk Ormawa Visit ini.")} />
      )}
    </div>
  );
}
