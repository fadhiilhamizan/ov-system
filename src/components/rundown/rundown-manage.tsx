"use client";
import * as React from "react";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createRundownAction, updateRundownAction, deleteRundownAction } from "@/lib/actions/schedule";
import { useT } from "@/lib/i18n/provider";
import type { RundownItem } from "@/lib/types";

function RundownFormDialog({
  mode, item, eventId, variant, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  item?: RundownItem;
  eventId: string;
  variant: string;
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
    time_start: item?.time_start ?? "", time_end: item?.time_end ?? "", duration: item?.duration ?? "",
    activity: item?.activity ?? "", keterangan: item?.keterangan ?? "", host: item?.host ?? "",
    mc: item?.mc ?? "", opr_link: item?.opr_link ?? "",
    job_lo: item?.job_lo ?? "", job_event: item?.job_event ?? "", job_consump: item?.job_consump ?? "",
    job_creative: item?.job_creative ?? "", job_opr: item?.job_opr ?? "",
  }));
  React.useEffect(() => {
    if (isOpen && item) setF({
      time_start: item.time_start, time_end: item.time_end, duration: item.duration, activity: item.activity,
      keterangan: item.keterangan, host: item.host, mc: item.mc, opr_link: item.opr_link,
      job_lo: item.job_lo, job_event: item.job_event, job_consump: item.job_consump, job_creative: item.job_creative, job_opr: item.job_opr,
    });
  }, [isOpen, item]);

  function submit() {
    start(async () => {
      const res = mode === "create"
        ? await createRundownAction({ ...f, event_id: eventId, variant })
        : await updateRundownAction(item!.id, f);
      if (res.ok) { toast.success(mode === "create" ? t("Agenda ditambahkan") : t("Agenda diperbarui")); setOpen(false); }
      else toast.error(res.error);
    });
  }

  const jobs: [keyof typeof f, string][] = [
    ["job_lo", "Job LO"], ["job_event", "Job Event"], ["job_consump", "Job Konsumsi"],
    ["job_creative", "Job Creative"], ["job_opr", "Job Operational"],
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Tambah Agenda Rundown") : t("Edit Agenda Rundown")}</DialogTitle>
          <DialogDescription>{t("Satu baris susunan acara (Juklak-Juknis).")}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 py-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5"><Label>{t("Jam mulai")}</Label><Input value={f.time_start} onChange={(e) => setF({ ...f, time_start: e.target.value })} placeholder="08.00" /></div>
            <div className="grid gap-1.5"><Label>{t("Jam selesai")}</Label><Input value={f.time_end} onChange={(e) => setF({ ...f, time_end: e.target.value })} placeholder="08.30" /></div>
            <div className="grid gap-1.5"><Label>{t("Durasi")}</Label><Input value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} placeholder="30'" /></div>
          </div>
          <div className="grid gap-1.5"><Label>{t("Kegiatan")}</Label><Input value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })} placeholder={t("Registrasi peserta")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("Pengisi acara")}</Label><Input value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>MC</Label><Input value={f.mc} onChange={(e) => setF({ ...f, mc: e.target.value })} /></div>
          </div>
          <div className="grid gap-1.5"><Label>{t("Keterangan")}</Label><Input value={f.keterangan} onChange={(e) => setF({ ...f, keterangan: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>{t("Link kebutuhan Operator")}</Label><Input value={f.opr_link} onChange={(e) => setF({ ...f, opr_link: e.target.value })} /></div>
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
            {jobs.map(([k, label]) => (
              <div key={k} className="grid gap-1"><Label>{t(label)}</Label><Textarea value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="min-h-[44px] text-xs" /></div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.activity.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}{mode === "create" ? t("Tambah") : t("Simpan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddRundownButton({ eventId, variant }: { eventId: string; variant: string }) {
  const t = useT();
  return (
    <RundownFormDialog mode="create" eventId={eventId} variant={variant} trigger={
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> {t("Tambah Agenda")}</Button></DialogTrigger>
    } />
  );
}

export function RundownActions({ item, eventId }: { item: RundownItem; eventId: string }) {
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
            const res = await deleteRundownAction(item.id);
            if (res.ok) toast.success(t("Agenda dihapus")); else toast.error(res.error);
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />} {t("Hapus")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RundownFormDialog mode="edit" item={item} eventId={eventId} variant={item.variant} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
