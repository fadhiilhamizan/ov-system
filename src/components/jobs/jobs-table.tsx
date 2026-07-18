"use client";
import * as React from "react";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, ClipboardList } from "lucide-react";
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
import { createJobAction, updateJobAction, deleteJobAction } from "@/lib/actions/schedule";
import { useT } from "@/lib/i18n/provider";
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
            <Label>{t("PIC (pisahkan koma)")}</Label>
            <Input value={f.pic} onChange={(e) => setF({ ...f, pic: e.target.value })} placeholder="Nama1, Nama2" />
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

export function JobsTable({ jobs, eventId, canManage }: { jobs: JobHariH[]; eventId: string; canManage: boolean }) {
  const t = useT();
  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <JobFormDialog mode="create" eventId={eventId} trigger={
            <DialogTrigger asChild><Button><Plus className="size-4" /> {t("Tambah Tugas")}</Button></DialogTrigger>
          } />
        </div>
      )}

      {jobs.length ? (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">{t("No")}</TableHead>
                <TableHead className="min-w-[240px]">{t("Job Description")}</TableHead>
                <TableHead className="min-w-[160px]">{t("PIC")}</TableHead>
                <TableHead>{t("Catatan")}</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-sm font-medium text-muted-foreground">{j.no || "-"}</TableCell>
                  <TableCell className="font-medium">{j.job}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {j.pic ? j.pic.split(",").map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs">
                          <Avatar name={p.trim()} size={18} /> {p.trim()}
                        </span>
                      )) : <span className="text-sm text-muted-foreground">-</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{j.notes || "-"}</TableCell>
                  {canManage && <TableCell><JobActions job={j} eventId={eventId} /></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={<ClipboardList />} title={t("Belum ada pembagian tugas")} description={t("Tambahkan pembagian tugas hari-H untuk Ormawa Visit ini.")} />
      )}
    </div>
  );
}
