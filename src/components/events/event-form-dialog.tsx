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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEventAction, updateEventAction, applyEventTemplateAction } from "@/lib/actions/manage";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";
import { Checkbox } from "@/components/ui/checkbox";
import type { CloneFilters, CloneMode, CloneSources, OVEvent } from "@/lib/types";
import { ClonePicker } from "./clone-picker";
import { cn } from "@/lib/utils";

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

  // Template: each menu names the Ormawa Visit it is copied from, so one new
  // edition can pull its divisions from OV A and its rundown from OV B.
  const [sources, setSources] = React.useState<CloneSources>({});
  const [filters, setFilters] = React.useState<CloneFilters>({});
  // How an existing edition's data is treated by the copy. Only asked on edit;
  // a brand-new edition has nothing to replace.
  const [cloneMode, setCloneMode] = React.useState<CloneMode>("replace");
  // The copy is destructive, so it stays disabled until the person confirms they
  // understand which edition overwrites which.
  const [confirmed, setConfirmed] = React.useState(false);
  // On edit the copy is destructive, so it is opt-in behind its own toggle
  // rather than sitting open next to the ordinary "Simpan".
  const [showTemplate, setShowTemplate] = React.useState(false);

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
    // Performance Measurement - filled in after the event. Kept as strings so an
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
        // Empty box -> null ("belum diisi"), never 0 - the dashboard shows a
        // dash for null and a real zero for zero, and those mean different things.
        attendance_hmsi: f.attendance_hmsi === "" ? null : Number(f.attendance_hmsi),
        feedback_hmsi_count: f.feedback_hmsi_count === "" ? null : Number(f.feedback_hmsi_count),
        feedback_hmsi_rating: f.feedback_hmsi_rating === "" ? null : Number(f.feedback_hmsi_rating),
        feedback_partner_count: f.feedback_partner_count === "" ? null : Number(f.feedback_partner_count),
        feedback_partner_rating: f.feedback_partner_rating === "" ? null : Number(f.feedback_partner_rating),
        report_url: f.report_url.trim() || null,
      };
      const picked = Object.keys(sources).length > 0;

      if (mode === "create") {
        const res = await createEventAction(payload, picked ? sources : undefined, filters);
        if (res.ok) { toast.success(t("Ormawa Visit ditambahkan")); setOpen(false); }
        else toast.error(res.error);
        return;
      }

      // Edit: save the fields first, then run the (destructive) copy. Order
      // matters - if the copy fails, the metadata edit is still saved and the
      // error names what actually went wrong.
      const res = await updateEventAction(event!.id, payload);
      if (!res.ok) { toast.error(res.error); return; }
      if (picked) {
        const cloned = await applyEventTemplateAction(event!.id, sources, cloneMode, filters);
        if (!cloned.ok) { toast.error(cloned.error); return; }
        toast.success(t("Ormawa Visit diperbarui & data disalin"));
      } else {
        toast.success(t("Ormawa Visit diperbarui"));
      }
      setOpen(false);
    });
  }

  /** "oleh HMD TC" etc - falls back to a generic word before a partner is set. */
  const partnerLabel = f.partner.trim() || t("himpunan partner");

  // An edition can never be its own source, so it is excluded from the picker.
  const templateOptions = events.filter((e) => e.id !== event?.id);

  // Distinct source editions actually selected, by title - for the confirmation.
  const cloneSourceTitles = React.useMemo(() => {
    const ids = new Set(Object.values(sources).filter(Boolean));
    return [...ids].map((id) => events.find((e) => e.id === id)?.title ?? id);
  }, [sources, events]);

  // The copy is destructive on an existing edition, so require the tick first.
  const needsConfirm = mode === "edit" && Object.keys(sources).length > 0;

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
              {t("Ini masih rencana - cukup isi nama & tanggal. Detail seperti partner, kampus, lokasi, tipe, dan mode bisa dikosongkan dulu; nanti terisi otomatis dari prospek utama di Reach & Offer.")}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("Nama Ormawa Visit")}</Label>
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="HMSI ITS x ..." />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kode (opsional)")}</Label>
              <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="OV1 2026" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("Himpunan / Partner")}</Label>
              <Input value={f.partner} onChange={(e) => setF({ ...f, partner: e.target.value })} placeholder="HIMASTA" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kampus")}</Label>
              <Input value={f.campus} onChange={(e) => setF({ ...f, campus: e.target.value })} placeholder="ITS" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("Kabinet")}</Label>
              <Input value={f.cabinet} onChange={(e) => setF({ ...f, cabinet: e.target.value })} placeholder="PilarAksi 2026" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Lokasi")}</Label>
              <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Tower 2 Lt.2 ITS" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          {/* Performance Measurement - the after-the-event numbers. Entered
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

          {templateOptions.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Copy className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">{t("Salin data dari Ormawa Visit lain (template)")}</p>
              </div>

              {mode === "create" ? (
                <p className="mb-2 text-[11px] text-muted-foreground">
                  {t("Hemat waktu - data disalin sebagai kerangka awal (status, PIC, dan tanggal dikosongkan). Tiap menu bisa diambil dari Ormawa Visit yang berbeda.")}
                </p>
              ) : !showTemplate ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {t("Bisa juga menyalin data menu tertentu dari Ormawa Visit lain ke Ormawa Visit ini.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTemplate(true)}
                    className="self-start rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium transition hover:bg-muted"
                  >
                    {t("Salin data dari Ormawa Visit lain…")}
                  </button>
                </div>
              ) : (
                // On edit the copy touches an edition that already has data, so
                // how that data is treated is a choice the person must make.
                <div className="mb-3 space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">{t("Perlakuan data yang sudah ada di Ormawa Visit ini:")}</p>
                  {([
                    ["replace", t("Ganti total"), t("Data menu yang dicentang DIHAPUS dulu, lalu diganti dengan salinan.")],
                    ["append", t("Tambahkan"), t("Data lama tetap; salinan ditambahkan di atasnya.")],
                  ] as const).map(([val, title, desc]) => (
                    <label
                      key={val}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-[11px] transition",
                        cloneMode === val ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                      )}
                    >
                      <input
                        type="radio"
                        name="clone-mode"
                        checked={cloneMode === val}
                        onChange={() => setCloneMode(val)}
                        className="mt-0.5 accent-primary"
                      />
                      <span>
                        <span className="font-medium text-foreground">{title}</span>
                        <span className="block text-muted-foreground">{desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {(mode === "create" || showTemplate) && (
                <>
                  <ClonePicker
                    options={templateOptions}
                    value={sources}
                    onChange={setSources}
                    filters={filters}
                    onFiltersChange={setFilters}
                  />

                  {/* Confirmation: only meaningful when copying INTO an edition
                      that already exists. It names both sides so nobody wipes the
                      wrong Ormawa Visit. */}
                  {mode === "edit" && cloneSourceTitles.length > 0 && (
                    <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50/70 p-2.5 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      <Checkbox
                        checked={confirmed}
                        onCheckedChange={(v) => setConfirmed(v === true)}
                        className="mt-0.5"
                      />
                      <span>
                        {t("Saya paham data yang disalin berasal dari")}{" "}
                        <span className="font-semibold">{cloneSourceTitles.join(", ")}</span>{" "}
                        {cloneMode === "replace"
                          ? t("dan akan MENGHAPUS lalu mengganti data")
                          : t("dan akan DITAMBAHKAN ke data")}{" "}
                        <span className="font-semibold">{event?.title}</span>{" "}
                        {t("yang sedang dibuka.")}
                      </span>
                    </label>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.title.trim() || (needsConfirm && !confirmed)}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? t("Tambah") : t("Simpan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
