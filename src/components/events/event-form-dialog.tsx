"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEventAction, updateEventAction } from "@/lib/actions/manage";
import type { OVEvent } from "@/lib/types";

export function EventFormDialog({
  mode, event, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  event?: OVEvent;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();

  const [f, setF] = React.useState(() => ({
    title: event?.title ?? "",
    partner: event?.partner ?? "",
    campus: event?.campus ?? "",
    cabinet: event?.cabinet ?? "",
    code: event?.code ?? "",
    type: event?.type ?? "external",
    mode: event?.mode ?? "offline",
    status: event?.status ?? "planning",
    plan_start: event?.plan_start ?? "",
    plan_end: event?.plan_end ?? "",
    event_date: event?.event_date ?? "",
    location: event?.location ?? "",
  }));
  React.useEffect(() => {
    if (isOpen && event) {
      setF({
        title: event.title, partner: event.partner, campus: event.campus, cabinet: event.cabinet,
        code: event.code, type: event.type, mode: event.mode, status: event.status,
        plan_start: event.plan_start ?? "", plan_end: event.plan_end ?? "",
        event_date: event.event_date ?? "", location: event.location,
      });
    }
  }, [isOpen, event]);

  function submit() {
    start(async () => {
      const payload = {
        ...f,
        plan_start: f.plan_start || null,
        plan_end: f.plan_end || null,
        event_date: f.event_date || null,
      };
      const res = mode === "create" ? await createEventAction(payload) : await updateEventAction(event!.id, payload);
      if (res.ok) { toast.success(mode === "create" ? "Ormawa Visit ditambahkan" : "Ormawa Visit diperbarui"); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Ormawa Visit" : "Edit Ormawa Visit"}</DialogTitle>
          <DialogDescription>Buat gelaran Ormawa Visit baru beserta rencana tanggalnya.</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Nama Ormawa Visit</Label>
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="HMSI ITS x ..." />
            </div>
            <div className="grid gap-1.5">
              <Label>Kode (opsional)</Label>
              <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="OV1 2026" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Himpunan / Partner</Label>
              <Input value={f.partner} onChange={(e) => setF({ ...f, partner: e.target.value })} placeholder="HIMASTA" />
            </div>
            <div className="grid gap-1.5">
              <Label>Kampus</Label>
              <Input value={f.campus} onChange={(e) => setF({ ...f, campus: e.target.value })} placeholder="ITS" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Kabinet</Label>
              <Input value={f.cabinet} onChange={(e) => setF({ ...f, cabinet: e.target.value })} placeholder="PilarAksi 2026" />
            </div>
            <div className="grid gap-1.5">
              <Label>Lokasi</Label>
              <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Tower 2 Lt.2 ITS" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as OVEvent["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal ITS</SelectItem>
                  <SelectItem value="external">Eksternal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Mode</Label>
              <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v as OVEvent["mode"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as OVEvent["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Rencana</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="done">Selesai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Rentang tanggal perencanaan</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Mulai rencana</Label>
                <Input type="date" value={f.plan_start} onChange={(e) => setF({ ...f, plan_start: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Akhir rencana</Label>
                <Input type="date" value={f.plan_end} onChange={(e) => setF({ ...f, plan_end: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Rencana tanggal pelaksanaan</Label>
            <Input type="date" value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.title.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Tambah" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
