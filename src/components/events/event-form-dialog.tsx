"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEventAction, updateEventAction } from "@/lib/actions/manage";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";
import type { OVEvent } from "@/lib/types";

const NO_TEMPLATE = "__none__";

export function EventFormDialog({
  mode, event, events = [], open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  event?: OVEvent;
  events?: OVEvent[];
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const t = useT();
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();

  // Template: copy data from an existing Ormawa Visit into the new one.
  const [templateSource, setTemplateSource] = React.useState<string>(NO_TEMPLATE);
  const [copy, setCopy] = React.useState({ divisions: true, members: false, tasks: true, rundown: true, jobs: true, budget: false });

  const UNSET = "__unset__";
  const [f, setF] = useResetOn(`${isOpen}:${event?.id ?? "new"}`, () => ({
    title: event?.title ?? "",
    partner: event?.partner ?? "",
    campus: event?.campus ?? "",
    cabinet: event?.cabinet ?? "",
    code: event?.code ?? "",
    // A brand-new OV is a plan; partner/campus/type/mode/location are usually
    // unknown until the primary Reach & Offer prospect is chosen, so don't
    // assume them on create.
    type: event?.type ?? (event ? "external" : UNSET),
    mode: event?.mode ?? (event ? "offline" : UNSET),
    status: event?.status ?? "planning",
    plan_start: event?.plan_start ?? "",
    plan_end: event?.plan_end ?? "",
    event_date: event?.event_date ?? "",
    location: event?.location ?? "",
    // Performance Measurement — filled in after the event. Kept as strings so an
    // empty box stays empty (and saves as NULL) instead of collapsing to 0.
    attendance_hmsi: event?.attendance_hmsi?.toString() ?? "",
    feedback_hmsi_count: event?.feedback_hmsi_count?.toString() ?? "",
    feedback_hmsi_rating: event?.feedback_hmsi_rating?.toString() ?? "",
    feedback_partner_count: event?.feedback_partner_count?.toString() ?? "",
    feedback_partner_rating: event?.feedback_partner_rating?.toString() ?? "",
    report_url: event?.report_url ?? "",
  }));

  function submit() {
    start(async () => {
      const payload = {
        ...f,
        // "Belum ditentukan" → leave the column empty rather than guessing.
        type: f.type === UNSET ? undefined : (f.type as OVEvent["type"]),
        mode: f.mode === UNSET ? undefined : (f.mode as OVEvent["mode"]),
        plan_start: f.plan_start || null,
        plan_end: f.plan_end || null,
        event_date: f.event_date || null,
        // Empty box -> null ("belum diisi"), never 0 — the dashboard shows a
        // dash for null and a real zero for zero, and those mean different things.
        attendance_hmsi: f.attendance_hmsi === "" ? null : Number(f.attendance_hmsi),
        feedback_hmsi_count: f.feedback_hmsi_count === "" ? null : Number(f.feedback_hmsi_count),
        feedback_hmsi_rating: f.feedback_hmsi_rating === "" ? null : Number(f.feedback_hmsi_rating),
        feedback_partner_count: f.feedback_partner_count === "" ? null : Number(f.feedback_partner_count),
        feedback_partner_rating: f.feedback_partner_rating === "" ? null : Number(f.feedback_partner_rating),
        report_url: f.report_url.trim() || null,
      };
      const template =
        mode === "create" && templateSource !== NO_TEMPLATE
          ? { sourceEventId: templateSource, ...copy }
          : undefined;
      const res =
        mode === "create"
          ? await createEventAction(payload, template)
          : await updateEventAction(event!.id, payload);
      if (res.ok) { toast.success(mode === "create" ? t("Ormawa Visit ditambahkan") : t("Ormawa Visit diperbarui")); setOpen(false); }
      else toast.error(res.error);
    });
  }

  /** "oleh HMD TC" etc — falls back to a generic word before a partner is set. */
  const partnerLabel = f.partner.trim() || t("himpunan partner");

  const templateOptions = events.filter((e) => e.id !== event?.id);
  const copyItems: { key: keyof typeof copy; label: string }[] = [
    { key: "divisions", label: t("Divisi") },
    { key: "members", label: t("Anggota & Tim") },
    { key: "tasks", label: t("Tugas (WBS)") },
    { key: "rundown", label: t("Rundown") },
    { key: "jobs", label: t("Job Hari-H") },
    { key: "budget", label: t("Anggaran (RAB)") },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Tambah Ormawa Visit") : t("Edit Ormawa Visit")}</DialogTitle>
          <DialogDescription>{t("Buat gelaran Ormawa Visit baru beserta rencana tanggalnya.")}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 py-1">
          {mode === "create" && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {t("Ini masih rencana — cukup isi nama & tanggal. Detail seperti partner, kampus, lokasi, tipe, dan mode bisa dikosongkan dulu; nanti terisi otomatis dari prospek utama di Reach & Offer.")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Nama Ormawa Visit")}</Label>
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="HMSI ITS x ..." />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kode (opsional)")}</Label>
              <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="OV1 2026" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Himpunan / Partner")}</Label>
              <Input value={f.partner} onChange={(e) => setF({ ...f, partner: e.target.value })} placeholder="HIMASTA" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kampus")}</Label>
              <Input value={f.campus} onChange={(e) => setF({ ...f, campus: e.target.value })} placeholder="ITS" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Kabinet")}</Label>
              <Input value={f.cabinet} onChange={(e) => setF({ ...f, cabinet: e.target.value })} placeholder="PilarAksi 2026" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Lokasi")}</Label>
              <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Tower 2 Lt.2 ITS" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tipe")}</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                <SelectTrigger><SelectValue placeholder={t("Belum ditentukan")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{t("Belum ditentukan")}</SelectItem>
                  <SelectItem value="internal">{t("Internal ITS")}</SelectItem>
                  <SelectItem value="external">{t("Eksternal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Mode")}</Label>
              <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
                <SelectTrigger><SelectValue placeholder={t("Belum ditentukan")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{t("Belum ditentukan")}</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Status")}</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as OVEvent["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">{t("Rencana")}</SelectItem>
                  <SelectItem value="active">{t("Aktif")}</SelectItem>
                  <SelectItem value="done">{t("Selesai")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t("Rentang tanggal perencanaan")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("Mulai rencana")}</Label>
                <Input type="date" value={f.plan_start} onChange={(e) => setF({ ...f, plan_start: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Akhir rencana")}</Label>
                <Input type="date" value={f.plan_end} onChange={(e) => setF({ ...f, plan_end: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Rencana tanggal pelaksanaan")}</Label>
            <Input type="date" value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} />
          </div>

          {/* Performance Measurement — the after-the-event numbers. Entered
              here, read on the Dashboard. Blank stays blank (NULL), which the
              dashboard renders as "belum diisi" rather than as a zero. */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("Performance Measurement")}</p>
            <p className="mb-3 text-[11px] text-muted-foreground">
              {t("Diisi setelah acara selesai. Angkanya tampil di Dashboard. Boleh dikosongkan dulu.")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>{t("Jumlah fungsionaris HMSI yang hadir")}</Label>
                <Input
                  type="number" min={0} step={1} inputMode="numeric" placeholder="0"
                  value={f.attendance_hmsi}
                  onChange={(e) => setF({ ...f, attendance_hmsi: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Total feedback HMSI")}</Label>
                <Input
                  type="number" min={0} step={1} inputMode="numeric" placeholder="0"
                  value={f.feedback_hmsi_count}
                  onChange={(e) => setF({ ...f, feedback_hmsi_count: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Rata-rata rating HMSI")} <span className="text-muted-foreground">(0–5)</span></Label>
                <Input
                  type="number" min={0} max={5} step="0.01" inputMode="decimal" placeholder="4.78"
                  value={f.feedback_hmsi_rating}
                  onChange={(e) => setF({ ...f, feedback_hmsi_rating: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Total feedback")} {partnerLabel}</Label>
                <Input
                  type="number" min={0} step={1} inputMode="numeric" placeholder="0"
                  value={f.feedback_partner_count}
                  onChange={(e) => setF({ ...f, feedback_partner_count: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Rata-rata rating")} {partnerLabel} <span className="text-muted-foreground">(0–5)</span></Label>
                <Input
                  type="number" min={0} max={5} step="0.01" inputMode="decimal" placeholder="4.92"
                  value={f.feedback_partner_rating}
                  onChange={(e) => setF({ ...f, feedback_partner_rating: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>{t("Link Pertanggung Jawaban (LPJ)")}</Label>
                <Input
                  type="url" placeholder="https://…"
                  value={f.report_url}
                  onChange={(e) => setF({ ...f, report_url: e.target.value })}
                />
              </div>
            </div>
          </div>

          {mode === "create" && templateOptions.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Copy className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">{t("Salin data dari Ormawa Visit lain (template)")}</p>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                {t("Hemat waktu — data disalin sebagai kerangka awal (status, PIC, dan tanggal dikosongkan). Bisa diedit setelahnya.")}
              </p>
              <Select value={templateSource} onValueChange={setTemplateSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>{t("Tidak menyalin (kosong)")}</SelectItem>
                  {templateOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateSource !== NO_TEMPLATE && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {copyItems.map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={copy[item.key]}
                        onCheckedChange={(v) => setCopy((c) => ({ ...c, [item.key]: v === true }))}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.title.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? t("Tambah") : t("Simpan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
