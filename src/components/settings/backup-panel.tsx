"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  Loader2, Download, RotateCcw, Trash2, DatabaseBackup, AlertTriangle, Upload, ChevronDown, X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import {
  createBackupAction, downloadBackupAction, deleteBackupAction, restoreBackupAction,
  importBackupAction, inspectBackupFileAction, bulkDeleteBackupsAction,
} from "@/lib/actions/backup";
import { useT, useLang } from "@/lib/i18n/provider";
import { useMultiSelect } from "@/lib/use-multi-select";
import { useSynced } from "@/lib/use-synced";
import { APP_TIME_ZONE, todayYmd } from "@/lib/format";
import type { BackupMeta } from "@/lib/backup";

// "Otomatis" is legacy - scheduled backups were removed in v1.20.0. Kept so
// snapshots taken before then still render with the right label.
const KIND_LABEL: Record<BackupMeta["kind"], { label: string; variant: "primary" | "info" | "warning" }> = {
  manual: { label: "Manual", variant: "primary" },
  auto: { label: "Otomatis (lama)", variant: "info" },
  pre_restore: { label: "Pra-Pemulihan", variant: "warning" },
};

/** Pinned to the committee's timezone, NOT the host's. Left to the host, the
 *  server formats in UTC and the browser in WIB, so every snapshot timestamp on
 *  this page was a seven-hour hydration mismatch (React #418) and the card was
 *  thrown away and re-rendered on every load. */
function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Clock time only - the day is already the group heading. */
function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** How many days are listed before "show everything", same as the changelog. */
const VISIBLE_DAYS = 5;

interface DayGroup {
  day: string;
  label: string;
  items: BackupMeta[];
}

/** Newest first, bucketed by calendar day in the committee's timezone. */
function groupByDay(backups: BackupMeta[], lang: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const b of backups) {
    const day = todayYmd(new Date(b.created_at));
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(b);
    else groups.push({ day, label: formatDay(b.created_at, lang), items: [b] });
  }
  return groups;
}

/** Save one snapshot as a JSON file in the browser. */
function saveJson(backup: BackupMeta, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ormawa-visit-backup-${backup.created_at.slice(0, 19).replace(/[:T]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The list is grouped by day and each day folds open and shut like a
 * changelog release, because it only ever grows: a year of "Backup Sekarang"
 * plus a pre-restore snapshot per rollback was one unbroken wall of rows.
 * Rows can be ticked (per row, per day, or everything shown) to download or
 * delete many snapshots in one go.
 */
export function BackupPanel({ initialBackups }: { initialBackups: BackupMeta[] }) {
  const t = useT();
  const lang = useLang();
  const [backups] = useSynced(initialBackups);
  const [creating, startCreate] = React.useTransition();
  const [bulkPending, startBulk] = React.useTransition();
  const [showAll, setShowAll] = React.useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  const groups = React.useMemo(() => groupByDay(backups, lang), [backups, lang]);
  const shown = showAll ? groups : groups.slice(0, VISIBLE_DAYS);
  const hiddenDays = groups.length - shown.length;
  const visibleIds = React.useMemo(() => shown.flatMap((g) => g.items.map((b) => b.id)), [shown]);
  const sel = useMultiSelect(visibleIds);
  const byId = React.useMemo(() => new Map(backups.map((b) => [b.id, b])), [backups]);

  function refreshAfterMutation() {
    // Server actions already revalidatePath; a soft reload picks up the
    // fresh list without a full navigation.
    window.location.reload();
  }

  function backupNow() {
    startCreate(async () => {
      const res = await createBackupAction();
      if (res.ok) { toast.success(t("Backup berhasil dibuat")); refreshAfterMutation(); }
      else toast.error(res.error);
    });
  }

  function downloadSelected() {
    const ids = sel.ids;
    startBulk(async () => {
      let done = 0;
      for (const id of ids) {
        const b = byId.get(id);
        if (!b) continue;
        const res = await downloadBackupAction(id);
        if (!res.ok) { toast.error(res.error); continue; }
        saveJson(b, res.data);
        done++;
      }
      if (done) toast.success(`${done} ${t("backup diunduh")}`);
    });
  }

  function deleteSelected() {
    const ids = sel.ids;
    startBulk(async () => {
      const res = await bulkDeleteBackupsAction(ids);
      if (res.ok) {
        toast.success(`${ids.length} ${t("backup dihapus")}`);
        setBulkDeleteOpen(false);
        sel.clear();
        refreshAfterMutation();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("Backup dibuat manual - klik tombol di kanan sebelum melakukan perubahan besar. Setiap backup bisa diunduh sebagai JSON atau dipulihkan kembali.")}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <ImportBackupButton onDone={refreshAfterMutation} />
          <Button size="sm" onClick={backupNow} disabled={creating} aria-keyshortcuts="Shift+B">
            {creating ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
            {t("Backup Sekarang")}
          </Button>
        </div>
      </div>

      {backups.length ? (
        <>
          {/* Select-all + bulk bar. Select-all only touches the days on screen,
              so ticks inside a collapsed "older" range are never hit blind. */}
          <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
              <Checkbox
                checked={sel.allVisibleSelected ? true : sel.count ? "indeterminate" : false}
                onCheckedChange={sel.toggleAll}
                aria-label={t("Pilih semua backup yang tampil")}
              />
              {sel.count ? `${sel.count} ${t("dipilih")}` : t("Pilih semua")}
            </label>
            {sel.count > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={downloadSelected} disabled={bulkPending}>
                  {bulkPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {t("Unduh")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(true)} disabled={bulkPending} className="text-danger">
                  <Trash2 className="size-4" /> {t("Hapus")}
                </Button>
                <Button variant="ghost" size="sm" onClick={sel.clear} disabled={bulkPending}>
                  <X className="size-4" /> {t("Batal pilih")}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {shown.map((g, i) => {
              const ids = g.items.map((b) => b.id);
              const picked = ids.filter((id) => sel.selected.has(id)).length;
              return (
                <details key={g.day} className="group rounded-lg border border-border" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    {/* preventDefault on the wrapper, not the checkbox: it stops
                        the click from ALSO folding the day, while Radix still
                        sees an unprevented click and toggles. */}
                    <span className="flex" onClick={(e) => e.preventDefault()}>
                      <Checkbox
                        checked={picked === ids.length ? true : picked ? "indeterminate" : false}
                        onCheckedChange={() => sel.set(ids, picked !== ids.length)}
                        aria-label={t("Pilih semua backup pada hari ini")}
                      />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium">{g.label}</span>
                    <Badge variant="outline">{g.items.length} {t("backup")}</Badge>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                  </summary>
                  <div className="divide-y divide-border border-t border-border">
                    {g.items.map((b) => (
                      <BackupRow
                        key={b.id}
                        backup={b}
                        selected={sel.selected.has(b.id)}
                        onToggle={() => sel.toggle(b.id)}
                        onDone={refreshAfterMutation}
                      />
                    ))}
                  </div>
                </details>
              );
            })}
          </div>

          {(hiddenDays > 0 || showAll) && groups.length > VISIBLE_DAYS && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {showAll ? t("Tampilkan lebih sedikit") : `${t("Lihat semua backup")} (${hiddenDays} ${t("hari lainnya")})`}
              <ChevronDown className={showAll ? "size-3.5 rotate-180 transition" : "size-3.5 transition"} />
            </button>
          )}
        </>
      ) : (
        <EmptyState icon={<DatabaseBackup />} title={t("Belum ada backup")} description={t("Klik “Backup Sekarang” untuk membuat backup pertama.")} />
      )}

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Hapus backup terpilih?")}</DialogTitle>
            <DialogDescription>
              {sel.count} {t("backup akan dihapus permanen dan tidak bisa dipulihkan lagi.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button variant="destructive" disabled={bulkPending || !sel.count} onClick={deleteSelected}>
              {bulkPending && <Loader2 className="size-4 animate-spin" />} {t("Hapus")} {sel.count}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Restore from a JSON file the user downloaded earlier.
 *
 * The file is inspected first and the dialog reports what it actually contains,
 * so "I picked the wrong file" is caught before the overwrite - the same typed
 * confirmation as a stored-backup restore, because the consequence is identical.
 */
function ImportBackupButton({ onDone }: { onDone: () => void }) {
  const t = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [pending, start] = React.useTransition();
  // Held only in memory between picking the file and confirming the restore.
  const [file, setFile] = React.useState<{ name: string; data: unknown; tables: number; rows: number } | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    // Reset immediately so picking the SAME file twice still fires onChange.
    e.target.value = "";
    if (!chosen) return;
    start(async () => {
      let data: unknown;
      try {
        data = JSON.parse(await chosen.text());
      } catch {
        toast.error(t("File bukan JSON yang valid."));
        return;
      }
      const res = await inspectBackupFileAction(data);
      if (!res.ok) { toast.error(res.error); return; }
      setFile({ name: chosen.name, data, tables: res.tables, rows: res.rows });
      setConfirmText("");
      setOpen(true);
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={pick}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {t("Impor dari File")}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="size-5" /> {t("Pulihkan dari file ini?")}
            </DialogTitle>
            <DialogDescription>
              {t("Seluruh data saat ini akan diganti total dengan isi file")} <b>{file?.name}</b>
              {" "}({file?.tables} {t("tabel")}, {file?.rows} {t("baris")}).{" "}
              {t("Backup pengaman otomatis dibuat lebih dulu, dan pemulihan berjalan sekaligus: kalau ada yang gagal di tengah, tidak ada satu pun data yang berubah.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>{t("Ketik PULIHKAN untuk konfirmasi")}</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="PULIHKAN" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button
              variant="destructive"
              disabled={pending || confirmText !== "PULIHKAN" || !file}
              onClick={() => start(async () => {
                const res = await importBackupAction(file!.data);
                if (res.ok) { toast.success(t("Data dipulihkan dari file")); setOpen(false); onDone(); }
                else toast.error(res.error);
              })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} {t("Pulihkan Sekarang")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BackupRow({
  backup, selected, onToggle, onDone,
}: {
  backup: BackupMeta;
  selected: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [restoreOpen, setRestoreOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [pending, start] = React.useTransition();
  const kind = KIND_LABEL[backup.kind];

  function download() {
    start(async () => {
      const res = await downloadBackupAction(backup.id);
      if (!res.ok) { toast.error(res.error); return; }
      saveJson(backup, res.data);
      toast.success(t("Backup diunduh"));
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3 px-4 py-2.5", selected && "bg-primary/5")}>
      <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={t("Pilih backup ini")} />
      <span className="text-sm tabular-nums">{formatClock(backup.created_at)}</span>
      <Badge variant={kind.variant}>{t(kind.label)}</Badge>
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon-sm" onClick={download} disabled={pending} title={t("Unduh JSON")}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setRestoreOpen(true)} title={t("Pulihkan (rollback)")}>
          <RotateCcw className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setDelOpen(true)} title={t("Hapus backup")}>
          <Trash2 className="size-4 text-danger" />
        </Button>
      </div>

      {/* Restore confirm - typed confirmation, extra scary on purpose */}
      <Dialog open={restoreOpen} onOpenChange={(v) => { setRestoreOpen(v); if (!v) setConfirmText(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="size-5" /> {t("Pulihkan data ke titik ini?")}
            </DialogTitle>
            <DialogDescription>
              {t("Seluruh data saat ini (tugas, anggaran, anggota, dll) akan diganti total dengan isi backup")}
              {" "}{formatTimestamp(backup.created_at)}. {t("Backup pengaman otomatis dibuat lebih dulu, dan pemulihan berjalan sekaligus: kalau ada yang gagal di tengah, tidak ada satu pun data yang berubah.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>{t("Ketik PULIHKAN untuk konfirmasi")}</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="PULIHKAN" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button
              variant="destructive"
              disabled={pending || confirmText !== "PULIHKAN"}
              onClick={() => start(async () => {
                const res = await restoreBackupAction(backup.id);
                if (res.ok) { toast.success(t("Data dipulihkan")); setRestoreOpen(false); onDone(); }
                else toast.error(res.error);
              })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} {t("Pulihkan Sekarang")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Hapus backup ini?")}</DialogTitle>
            <DialogDescription>{t("Backup")} {formatTimestamp(backup.created_at)} {t("akan dihapus permanen.")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => start(async () => {
                const res = await deleteBackupAction(backup.id);
                if (res.ok) { toast.success(t("Backup dihapus")); setDelOpen(false); onDone(); }
                else toast.error(res.error);
              })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} {t("Hapus")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
