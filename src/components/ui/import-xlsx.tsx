"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  FileSpreadsheet, Download, Upload, Loader2, CircleAlert, CheckCircle2, Info, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  commitImportAction, downloadImportTemplateAction, previewImportAction, type ImportPreview,
} from "@/lib/actions/import";
import { specFor } from "@/lib/import/modules";
import type { ImportModule } from "@/lib/import/core";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

// ============================================================
// "Import XLSX": the one dialog every table menu uses.
//
// Three steps on one screen: download the menu's template, pick the filled
// file, read the preview. Nothing is written until the Impor button, and that
// button stays disabled while the preview reports any error - the server
// refuses such a file anyway (all rows or none), this only says so sooner.
// The file stays in memory here and is sent again on commit, so the server
// re-validates exactly what it imports.
// ============================================================

export interface ImportTarget {
  value: string;
  label: string;
}

export function ImportXlsxButton({
  module,
  targets,
  defaultTarget,
  className,
  label,
  size,
}: {
  module: ImportModule;
  /** Where rows land inside the menu (a budget plan, an FGD table, a subject). */
  targets?: ImportTarget[];
  defaultTarget?: string;
  className?: string;
  label?: string;
  size?: "sm" | "default";
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        variant="outline"
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        aria-label={label ?? t("Import XLSX")}
      >
        <FileSpreadsheet className="size-4" />
        <span className="hidden sm:inline">{label ?? t("Import XLSX")}</span>
      </Button>
      {open && (
        <ImportXlsxDialog
          module={module}
          targets={targets}
          defaultTarget={defaultTarget}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

function ImportXlsxDialog({
  module, targets, defaultTarget, open, onOpenChange,
}: {
  module: ImportModule;
  targets?: ImportTarget[];
  defaultTarget?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const spec = specFor(module);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [target, setTarget] = React.useState(defaultTarget ?? targets?.[0]?.value ?? "");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [downloading, startDownload] = React.useTransition();
  const [reading, startRead] = React.useTransition();
  const [saving, startSave] = React.useTransition();
  const needsTarget = !!spec.target;
  const noTargets = needsTarget && !targets?.length;

  function form(f: File) {
    const fd = new FormData();
    fd.set("module", module);
    fd.set("target", target);
    fd.set("file", f);
    return fd;
  }

  function download() {
    startDownload(async () => {
      const res = await downloadImportTemplateAction(module);
      if (!res.ok) { toast.error(res.error); return; }
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function read(f: File) {
    setFile(f);
    setPreview(null);
    setProblem(null);
    startRead(async () => {
      const res = await previewImportAction(form(f));
      if (res.ok) setPreview(res);
      else setProblem(res.error);
    });
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // Reset so picking the SAME file again (after fixing it) still fires.
    e.target.value = "";
    if (f) read(f);
  }

  function changeTarget(v: string) {
    setTarget(v);
    // The preview was validated against the old target; read again.
    setPreview(null);
    setProblem(null);
    setFile(null);
  }

  function commit() {
    if (!file) return;
    startSave(async () => {
      const res = await commitImportAction(form(file));
      if (res.ok) {
        toast.success(`${res.inserted} ${t("baris berhasil diimpor")}`);
        onOpenChange(false);
      } else {
        toast.error(res.error);
        setProblem(res.error);
      }
    });
  }

  const canCommit = !!preview && preview.total > 0 && preview.errorCount === 0 && !saving && !reading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* min-w-0 on every child: DialogContent is a grid, and a grid item
          sizes to its content by default, so a wide preview table would
          stretch the whole dialog sideways instead of scrolling inside. */}
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" /> {t("Import XLSX")} - {t(spec.title)}
          </DialogTitle>
          <DialogDescription>
            {t("Tambahkan banyak data sekaligus dari Excel atau Google Sheets. Data yang sudah ada tidak diubah.")}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: template */}
        <section className="space-y-2 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">1. {t("Unduh template")}</p>
              <p className="text-xs text-muted-foreground">
                {t("Berisi sheet Petunjuk (aturan), Data (diisi), Contoh (contoh pengisian), dan Referensi (daftar pilihan).")}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={download} disabled={downloading}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {t("Unduh Template")}
            </Button>
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {spec.rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </section>

        {/* Target (budget plan, FGD table, subject) */}
        {needsTarget && (
          <section className="grid gap-1.5">
            <Label>{t(spec.target!.label)}</Label>
            {noTargets ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                {t("Belum ada tujuan impor. Buat dulu dari menu ini, lalu buka lagi jendela impor.")}
              </p>
            ) : (
              <Select value={target} onValueChange={changeTarget}>
                <SelectTrigger><SelectValue placeholder={t("Pilih tujuan")} /></SelectTrigger>
                <SelectContent>
                  {targets!.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </section>
        )}

        {/* Step 2: file */}
        <section className="space-y-2 rounded-xl border border-border p-4">
          <p className="text-sm font-semibold">2. {t("Unggah file yang sudah diisi")}</p>
          <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={pick} />
          <button
            type="button"
            disabled={noTargets || (needsTarget && !target) || reading || saving}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) read(f);
            }}
            className="flex w-full flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
            {file ? <span className="font-medium text-foreground">{file.name}</span> : t("Klik atau seret file .xlsx ke sini")}
            <span className="text-xs">{t("Maksimal 3 MB")}</span>
          </button>

          {problem && (
            <p className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {problem}
            </p>
          )}
        </section>

        {/* Step 3: preview */}
        {preview && <PreviewBlock preview={preview} />}

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={commit} disabled={!canCommit}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {preview && preview.total > 0 ? `${t("Impor")} ${preview.total} ${t("baris")}` : t("Impor")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewBlock({ preview }: { preview: ImportPreview }) {
  const t = useT();
  const hasErrors = preview.errorCount > 0;
  return (
    <section className="space-y-3">
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
          hasErrors ? "bg-danger/10 text-danger" : preview.total ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground",
        )}
      >
        {hasErrors ? <X className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
        <span>
          {hasErrors
            ? `${preview.errorCount} ${t("kesalahan ditemukan. Perbaiki di file lalu unggah ulang; belum ada data yang disimpan.")}`
            : preview.total
              ? `${preview.total} ${t("baris siap diimpor.")}`
              : t("File tidak berisi baris data. Isi sheet Data terlebih dahulu.")}
        </span>
      </div>

      {preview.ignoredHeaders.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {t("Kolom ini tidak dikenal dan diabaikan:")} {preview.ignoredHeaders.join(", ")}
        </p>
      )}

      {hasErrors && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-danger/30">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">{t("Baris")}</th>
                <th className="px-3 py-1.5 font-medium">{t("Kolom")}</th>
                <th className="px-3 py-1.5 font-medium">{t("Masalah")}</th>
              </tr>
            </thead>
            <tbody>
              {preview.errors.map((e, i) => (
                <tr key={i} className="border-t border-border/60 align-top">
                  <td className="px-3 py-1.5 tabular-nums">{e.line}</td>
                  <td className="px-3 py-1.5 font-medium">{e.column}</td>
                  <td className="px-3 py-1.5">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.errorCount > preview.errors.length && (
            <p className="border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
              +{preview.errorCount - preview.errors.length} {t("kesalahan lainnya")}
            </p>
          )}
        </div>
      )}

      {preview.sample.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t("Pratinjau")} ({preview.sample.length} {t("dari")} {preview.total} {t("baris")})
          </p>
          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr className="text-left">
                  <th className="px-2 py-1.5 font-medium text-muted-foreground">#</th>
                  {preview.columns.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-2 py-1.5 font-medium">{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((r) => (
                  <tr key={r.line} className="border-t border-border/60 align-top">
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{r.line}</td>
                    {r.cells.map((c, i) => (
                      <td key={i} className="max-w-56 whitespace-pre-line px-2 py-1.5">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
