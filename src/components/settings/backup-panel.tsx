"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Download, RotateCcw, Trash2, DatabaseBackup, AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import {
  createBackupAction, downloadBackupAction, deleteBackupAction, restoreBackupAction,
  importBackupAction, inspectBackupFileAction,
} from "@/lib/actions/backup";
import { useT } from "@/lib/i18n/provider";
import { useSynced } from "@/lib/use-synced";
import type { BackupMeta } from "@/lib/backup";

// "Otomatis" is legacy - scheduled backups were removed in v1.20.0. Kept so
// snapshots taken before then still render with the right label.
const KIND_LABEL: Record<BackupMeta["kind"], { label: string; variant: "primary" | "info" | "warning" }> = {
  manual: { label: "Manual", variant: "primary" },
  auto: { label: "Otomatis (lama)", variant: "info" },
  pre_restore: { label: "Pra-Pemulihan", variant: "warning" },
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function BackupPanel({ initialBackups }: { initialBackups: BackupMeta[] }) {
  const t = useT();
  const [backups] = useSynced(initialBackups);
  const [creating, startCreate] = React.useTransition();

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("Backup dibuat manual - klik tombol di kanan sebelum melakukan perubahan besar. Setiap backup bisa diunduh sebagai JSON atau dipulihkan kembali.")}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <ImportBackupButton onDone={refreshAfterMutation} />
          <Button size="sm" onClick={backupNow} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
            {t("Backup Sekarang")}
          </Button>
        </div>
      </div>

      {backups.length ? (
        <div className="rounded-xl border border-border">
          <div className="divide-y divide-border">
            {backups.map((b) => (
              <BackupRow key={b.id} backup={b} onDone={refreshAfterMutation} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={<DatabaseBackup />} title={t("Belum ada backup")} description={t("Klik “Backup Sekarang” untuk membuat backup pertama.")} />
      )}
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
              {t("Sebuah backup pengaman otomatis akan dibuat sebelum pemulihan, tapi tindakan ini tetap berisiko tinggi.")}
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

function BackupRow({ backup, onDone }: { backup: BackupMeta; onDone: () => void }) {
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
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ormawa-visit-backup-${backup.created_at.slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("Backup diunduh"));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <Badge variant={kind.variant}>{t(kind.label)}</Badge>
      <span className="text-sm">{formatTimestamp(backup.created_at)}</span>
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
              {" "}{formatTimestamp(backup.created_at)}. {t("Sebuah backup pengaman otomatis akan dibuat sebelum pemulihan, tapi tindakan ini tetap berisiko tinggi.")}
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
