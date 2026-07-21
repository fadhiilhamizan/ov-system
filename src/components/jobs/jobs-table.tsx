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
import { createJobAction, updateJobAction, deleteJobAction, reorderJobsAction, duplicateJobAction } from "@/lib/actions/schedule";
import { useT } from "@/lib/i18n/provider";
import { MemberPicker } from "@/components/members/member-picker";
import { useMembers } from "@/components/members/members-context";
import { cn } from "@/lib/utils";
import type { JobHariH } from "@/lib/types";

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
  const [f, setF] = React.useState(() => ({
    pic: job?.pic ?? "", job: job?.job ?? "", notes: job?.notes ?? "",
  }));
  React.useEffect(() => {
    if (isOpen && job) setF({ pic: job.pic, job: job.job, notes: job.notes });
  }, [isOpen, job]);

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

function JobActions({ job, eventId }: { job: JobHariH; eventId: string }) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> {t("Edit")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => start(async () => {
            const res = await duplicateJobAction(job.id);
            if (res.ok) toast.success(t("Tugas diduplikat")); else toast.error(res.error);
          })}><Copy /> {t("Duplikat")}</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => start(async () => {
            const res = await deleteJobAction(job.id);
            if (res.ok) toast.success(t("Tugas dihapus")); else toast.error(res.error);
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />} {t("Hapus")}</DropdownMenuItem>
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

function SortableJobRow({ job, index, eventId, canManage }: { job: JobHariH; index: number; eventId: string; canManage: boolean }) {
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
        <TableCell className="w-8 pr-0">
          <button
            {...attributes}
            {...listeners}
            className="flex cursor-grab touch-none items-center justify-center rounded p-1 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label="Geser untuk mengurutkan"
          >
            <GripVertical className="size-4" />
          </button>
        </TableCell>
      )}
      <TableCell className="text-sm font-medium tabular-nums text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="font-medium">{job.job}</TableCell>
      <TableCell><PicChips pic={job.pic} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{job.notes || "-"}</TableCell>
      {canManage && <TableCell><JobActions job={job} eventId={eventId} /></TableCell>}
    </tr>
  );
}

export function JobsTable({ jobs, eventId, canManage }: { jobs: JobHariH[]; eventId: string; canManage: boolean }) {
  const t = useT();
  // Local order for optimistic drag; synced from server props on change.
  const sorted = React.useMemo(
    () => [...jobs].sort((a, b) => (parseInt(a.no, 10) || 0) - (parseInt(b.no, 10) || 0)),
    [jobs],
  );
  const [items, setItems] = React.useState(sorted);
  const orderKey = sorted.map((j) => j.id).join(",");
  React.useEffect(() => setItems(sorted), [orderKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const next = arrayMove(items, from, to);
    setItems(next); // optimistic
    reorderJobsAction(next.map((j) => j.id)).then((res) => {
      if (!res.ok) { toast.error(res.error); setItems(sorted); }
    });
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("Seret ikon untuk mengurutkan; nomor tersusun otomatis.")}</p>
          <JobFormDialog mode="create" eventId={eventId} trigger={
            <DialogTrigger asChild><Button><Plus className="size-4" /> {t("Tambah Tugas")}</Button></DialogTrigger>
          } />
        </div>
      )}

      {items.length ? (
        <div className="rounded-xl border border-border bg-card">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <Table>
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
                    <SortableJobRow key={j.id} job={j} index={i} eventId={eventId} canManage={canManage} />
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
