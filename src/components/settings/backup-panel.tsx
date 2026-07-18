"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Download, RotateCcw, Trash2, DatabaseBackup, AlertTriangle } from "lucide-react";
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
} from "@/lib/actions/backup";
import type { BackupMeta } from "@/lib/backup";

const KIND_LABEL: Record<BackupMeta["kind"], { label: string; variant: "primary" | "info" | "warning" }> = {
  manual: { label: "Manual", variant: "primary" },
  auto: { label: "Otomatis", variant: "info" },
  pre_restore: { label: "Pra-Pemulihan", variant: "warning" },
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function BackupPanel({ initialBackups }: { initialBackups: BackupMeta[] }) {
  const [backups, setBackups] = React.useState(initialBackups);
  React.useEffect(() => setBackups(initialBackups), [initialBackups]);
  const [creating, startCreate] = React.useTransition();

  function refreshAfterMutation() {
    // Server actions already revalidatePath; a soft reload picks up the
    // fresh list without a full navigation.
    window.location.reload();
  }

  function backupNow() {
    startCreate(async () => {
      const res = await createBackupAction();
      if (res.ok) { toast.success("Backup berhasil dibuat"); refreshAfterMutation(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Backup otomatis berjalan tiap 3 hari (perlu <code className="rounded bg-muted px-1 py-0.5">CRON_SECRET</code> dikonfigurasi di Vercel).
        </p>
        <Button size="sm" onClick={backupNow} disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
          Backup Sekarang
        </Button>
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
        <EmptyState icon={<DatabaseBackup />} title="Belum ada backup" description="Klik “Backup Sekarang” untuk membuat backup pertama." />
      )}
    </div>
  );
}

function BackupRow({ backup, onDone }: { backup: BackupMeta; onDone: () => void }) {
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
      toast.success("Backup diunduh");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <Badge variant={kind.variant}>{kind.label}</Badge>
      <span className="text-sm">{formatTimestamp(backup.created_at)}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon-sm" onClick={download} disabled={pending} title="Unduh JSON">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setRestoreOpen(true)} title="Pulihkan (rollback)">
          <RotateCcw className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setDelOpen(true)} title="Hapus backup">
          <Trash2 className="size-4 text-danger" />
        </Button>
      </div>

      {/* Restore confirm - typed confirmation, extra scary on purpose */}
      <Dialog open={restoreOpen} onOpenChange={(v) => { setRestoreOpen(v); if (!v) setConfirmText(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="size-5" /> Pulihkan data ke titik ini?
            </DialogTitle>
            <DialogDescription>
              Seluruh data saat ini (tugas, anggaran, anggota, dll) akan <b>diganti total</b> dengan isi backup
              {" "}{formatTimestamp(backup.created_at)}. Sebuah backup pengaman otomatis akan dibuat sebelum
              pemulihan, tapi tindakan ini tetap berisiko tinggi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Ketik <b>PULIHKAN</b> untuk konfirmasi</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="PULIHKAN" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button
              variant="destructive"
              disabled={pending || confirmText !== "PULIHKAN"}
              onClick={() => start(async () => {
                const res = await restoreBackupAction(backup.id);
                if (res.ok) { toast.success("Data dipulihkan"); setRestoreOpen(false); onDone(); }
                else toast.error(res.error);
              })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Pulihkan Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus backup ini?</DialogTitle>
            <DialogDescription>Backup {formatTimestamp(backup.created_at)} akan dihapus permanen.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => start(async () => {
                const res = await deleteBackupAction(backup.id);
                if (res.ok) { toast.success("Backup dihapus"); setDelOpen(false); onDone(); }
                else toast.error(res.error);
              })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
