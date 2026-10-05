"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  FileSpreadsheet, Download, Upload, Loader2, CircleAlert, CheckCircle2, Info, X, TriangleAlert,
  RefreshCw, ChevronDown, CopyCheck, FileWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  commitImportAction, downloadImportTemplateAction, importReportAction, previewImportAction,
  type ImportPreview, type PreviewRow,
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
//
// The file is held ONLY in this component's memory and sent again with each
// step (preview, report, commit), so the server never has to keep it: see the
// note at the top of actions/import.ts. Closing the dialog drops it.
// ============================================================

/** Same cap as the server; checked here too so a big file never uploads. */
const MAX_BYTES = 3 * 1024 * 1024;
/** Rows rendered at a time in the preview table. */
const PAGE = 100;

export interface ImportTarget {
  value: string;
  label: string;
}

type Filter = "all" | "problem" | "existing";

/** Save a base64 payload as a file in the browser. */
function saveBase64(base64: string, fileName: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  // Revoke on the next tick: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

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
        aria-keyshortcuts="I"
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
  const [skipExisting, setSkipExisting] = React.useState(true);
  const [dragOver, setDragOver] = React.useState(false);
  const [done, setDone] = React.useState<{ inserted: number; skipped: number } | null>(null);
  const [downloading, startDownload] = React.useTransition();
  const [reading, startRead] = React.useTransition();
  const [reporting, startReport] = React.useTransition();
  const [saving, startSave] = React.useTransition();
  const needsTarget = !!spec.target;
  const noTargets = needsTarget && !targets?.length;
  const busy = reading || saving || reporting;

  function form(f: File) {
    const fd = new FormData();
    fd.set("module", module);
    fd.set("target", target);
    fd.set("file", f);
    fd.set("skipExisting", skipExisting ? "1" : "0");
    return fd;
  }

  function download() {
    startDownload(async () => {
      const res = await downloadImportTemplateAction(module);
      if (!res.ok) { toast.error(res.error); return; }
      saveBase64(res.base64, res.fileName);
    });
  }

  function read(f: File) {
    setPreview(null);
    setProblem(null);
    setDone(null);
    // Refuse the obvious mismatches here, before a single byte is uploaded.
    if (!/\.xlsx$/i.test(f.name)) {
      setFile(null);
      setProblem(/\.(xls|csv|ods|numbers)$/i.test(f.name)
        ? t("Format ini belum didukung. Simpan ulang sebagai Excel Workbook (.xlsx).")
        : t("File harus berformat .xlsx (Excel Workbook)."));
      return;
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      setProblem(t("Ukuran file maksimal 3 MB. Pecah datanya menjadi beberapa file."));
      return;
    }
    setFile(f);
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

  function reset() {
    setFile(null);
    setPreview(null);
    setProblem(null);
    setDone(null);
  }

  function changeTarget(v: string) {
    setTarget(v);
    // The preview was validated against the old target; read again.
    reset();
  }

  function report() {
    if (!file) return;
    startReport(async () => {
      const res = await importReportAction(form(file));
      if (!res.ok) { toast.error(res.error); return; }
      saveBase64(res.base64, res.fileName);
    });
  }

  function commit() {
    if (!file) return;
    startSave(async () => {
      const res = await commitImportAction(form(file));
      if (res.ok) {
        toast.success(`${res.inserted} ${t("baris berhasil diimpor")}`);
        setDone({ inserted: res.inserted, skipped: res.skipped });
      } else {
        toast.error(res.error);
        setProblem(res.error);
      }
    });
  }

  const skipping = !!preview && preview.canSkipExisting && skipExisting ? preview.existingCount : 0;
  const toImport = preview ? preview.total - skipping : 0;
  const canCommit = !!preview && toImport > 0 && preview.errorCount === 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* min-w-0 on every child: DialogContent is a grid, and a grid item
          sizes to its content by default, so a wide preview table would
          stretch the whole dialog sideways instead of scrolling inside. */}
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" /> {t("Import XLSX")} - {t(spec.title)}
          </DialogTitle>
          <DialogDescription>
            {t("Tambahkan banyak data sekaligus dari Excel atau Google Sheets. Data yang sudah ada tidak diubah.")}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <section className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-6 py-10 text-center">
            <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
            <p className="text-base font-semibold">
              {done.inserted} {t("baris berhasil diimpor ke")} {t(spec.title)}.
            </p>
            {done.skipped > 0 && (
              <p className="text-sm text-muted-foreground">
                {done.skipped} {t("baris dilewati karena sudah ada.")}
              </p>
            )}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={reset}><RefreshCw className="size-4" /> {t("Impor file lain")}</Button>
              <DialogClose asChild><Button>{t("Selesai")}</Button></DialogClose>
            </div>
          </section>
        ) : (
          <>
            {/* Step 1: template */}
            <section className="space-y-2 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">1. {t("Unduh template")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("Berisi sheet Petunjuk (aturan), Data (diisi), Contoh (contoh pengisian), dan Referensi (daftar pilihan). Template mengikuti Ormawa Visit yang sedang aktif.")}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={download} disabled={downloading}>
                  {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {t("Unduh Template")}
                </Button>
              </div>
              <details className="group text-xs">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-primary [&::-webkit-details-marker]:hidden">
                  {t("Aturan pengisian menu ini")}
                  <ChevronDown className="size-3.5 transition group-open:rotate-180" />
                </summary>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {spec.rules.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </details>
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
                  <Select value={target} onValueChange={changeTarget} disabled={busy}>
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
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={pick}
                aria-label={t("Pilih file .xlsx")}
              />
              {file && !problem ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  {reading ? <Loader2 className="size-5 shrink-0 animate-spin text-primary" /> : <FileSpreadsheet className="size-5 shrink-0 text-emerald-600" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {kb(file.size)}
                      {reading ? ` · ${t("Membaca file…")}` : preview ? ` · ${t("sheet")} ${preview.sheetName}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
                    <RefreshCw className="size-4" /> {t("Ganti file")}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={noTargets || (needsTarget && !target) || busy}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) read(f);
                  }}
                  className={cn(
                    "flex w-full flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-7 text-sm text-muted-foreground transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60",
                    dragOver ? "border-primary bg-primary/10 text-primary" : "border-border",
                  )}
                >
                  <Upload className="size-5" />
                  {dragOver ? t("Lepaskan file di sini") : t("Klik atau seret file .xlsx ke sini")}
                  <span className="text-xs">{t("Maksimal 3 MB. File tidak disimpan: hanya dibaca untuk diperiksa.")}</span>
                </button>
              )}

              {problem && (
                <div className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span className="flex-1">{problem}</span>
                  {file && (
                    <button type="button" onClick={() => inputRef.current?.click()} className="shrink-0 font-medium underline">
                      {t("Pilih file lain")}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Step 3: preview */}
            {preview && (
              <PreviewBlock
                preview={preview}
                skipExisting={skipExisting}
                onSkipExisting={setSkipExisting}
                onReport={report}
                reporting={reporting}
              />
            )}
          </>
        )}

        {!done && (
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button onClick={commit} disabled={!canCommit}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {preview && toImport > 0 ? `${t("Impor")} ${toImport} ${t("baris")}` : t("Impor")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Chip({ tone, children }: { tone: "ok" | "error" | "warning" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "ok" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "error" && "bg-danger/10 text-danger",
        tone === "warning" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function PreviewBlock({
  preview, skipExisting, onSkipExisting, onReport, reporting,
}: {
  preview: ImportPreview;
  skipExisting: boolean;
  onSkipExisting: (v: boolean) => void;
  onReport: () => void;
  reporting: boolean;
}) {
  const t = useT();
  const [filter, setFilter] = React.useState<Filter>(preview.errorCount ? "problem" : "all");
  const [limit, setLimit] = React.useState(PAGE);
  const problemRows = preview.rows.filter((r) => r.issues.length > 0);
  const errorRows = preview.rows.filter((r) => r.issues.some((i) => i.level === "error")).length;
  const readyRows = preview.rows.filter((r) => !r.issues.some((i) => i.level === "error")).length;
  const shown = filter === "problem" ? problemRows : filter === "existing" ? preview.rows.filter((r) => r.existing) : preview.rows;

  const tabs: [Filter, string, number][] = [
    ["all", t("Semua"), preview.total],
    ["problem", t("Perlu dicek"), problemRows.length],
    ...(preview.existingCount ? [["existing", t("Sudah ada"), preview.existingCount] as [Filter, string, number]] : []),
  ];

  return (
    <section className="space-y-3">
      <p className="text-sm font-semibold">3. {t("Periksa hasil pembacaan")}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="muted">{preview.total} {t("baris dibaca")}</Chip>
        {preview.total > 0 && <Chip tone="ok"><CheckCircle2 className="size-3.5" /> {readyRows} {t("siap")}</Chip>}
        {errorRows > 0 && <Chip tone="error"><X className="size-3.5" /> {errorRows} {t("baris bermasalah")} ({preview.errorCount} {t("kesalahan")})</Chip>}
        {preview.warningCount > 0 && <Chip tone="warning"><TriangleAlert className="size-3.5" /> {preview.warningCount} {t("peringatan")}</Chip>}
        {preview.existingCount > 0 && <Chip tone="warning"><CopyCheck className="size-3.5" /> {preview.existingCount} {t("sudah ada")}</Chip>}
        {(preview.errorCount > 0 || preview.warningCount > 0) && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={onReport} disabled={reporting}>
            {reporting ? <Loader2 className="size-4 animate-spin" /> : <FileWarning className="size-4" />}
            {t("Unduh laporan pemeriksaan")}
          </Button>
        )}
      </div>

      {preview.errorCount > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          {t("Belum ada data yang disimpan. Perbaiki kesalahan di file (laporan pemeriksaan menandai sel yang salah), lalu unggah ulang.")}
        </p>
      )}
      {preview.total === 0 && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t("File tidak berisi baris data. Isi sheet Data terlebih dahulu.")}
        </p>
      )}

      {[...preview.notes, ...preview.fileIssues].map((n) => (
        <p key={n} className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" /> {n}
        </p>
      ))}
      {preview.ignoredHeaders.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {t("Kolom ini tidak dikenal dan diabaikan:")} {preview.ignoredHeaders.join(", ")}
        </p>
      )}

      {preview.existingCount > 0 && preview.canSkipExisting && (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <Checkbox checked={skipExisting} onCheckedChange={(v) => onSkipExisting(v === true)} className="mt-0.5" />
          <span>
            <span className="font-medium">{t("Lewati yang sudah ada")}</span>
            <span className="block text-muted-foreground">
              {preview.existingCount} {t("baris sama dengan data yang sudah tersimpan (mis. file yang sama diunggah dua kali).")}
            </span>
          </span>
        </label>
      )}

      {preview.rows.length > 0 && (
        <div className="space-y-2">
          <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist">
            {tabs.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => { setFilter(key); setLimit(PAGE); }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label} {count}
              </button>
            ))}
          </div>

          <div className="max-h-[22rem] overflow-auto rounded-lg border border-border">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="text-left">
                  <th className="border-b border-border px-2 py-1.5 font-medium text-muted-foreground">{t("Baris")}</th>
                  <th className="border-b border-border px-1 py-1.5" />
                  {preview.columns.map((c) => (
                    <th key={c.key} className="whitespace-nowrap border-b border-border px-2 py-1.5 font-medium">{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map((r) => (
                  <PreviewTableRow key={r.line} row={r} span={preview.columns.length + 2} />
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={preview.columns.length + 2} className="px-3 py-6 text-center text-muted-foreground">
                      {t("Tidak ada baris di kategori ini.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {shown.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="w-full rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
            >
              {t("Tampilkan lebih banyak")} ({shown.length - limit} {t("lagi")})
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function PreviewTableRow({ row, span }: { row: PreviewRow; span: number }) {
  const isError = row.issues.some((i) => i.level === "error");
  const isWarning = !isError && (row.issues.length > 0 || row.existing);
  const rowIssues = row.issues.filter((i) => i.c < 0);
  const cellIssues = (c: number) => row.issues.filter((i) => i.c === c);
  const td = "border-b border-border/60 px-2 py-1.5 align-top";
  return (
    <>
      <tr className={cn(isError && "bg-danger/5")}>
        <td className={cn(td, "tabular-nums text-muted-foreground")}>{row.line}</td>
        <td className={cn(td, "px-1")}>
          {isError ? (
            <X className="size-3.5 text-danger" />
          ) : isWarning ? (
            <TriangleAlert className="size-3.5 text-amber-600" />
          ) : (
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          )}
        </td>
        {row.cells.map((c, i) => {
          const issues = cellIssues(i);
          const err = issues.some((x) => x.level === "error");
          return (
            <td
              key={i}
              className={cn(
                td, "max-w-60 whitespace-pre-line break-words",
                err ? "bg-danger/10" : issues.length ? "bg-amber-500/10" : "",
              )}
            >
              {c}
              {issues.map((x, k) => (
                <span key={k} className={cn("mt-0.5 block text-[11px] leading-snug", x.level === "error" ? "text-danger" : "text-amber-700 dark:text-amber-300")}>
                  {x.message}
                </span>
              ))}
            </td>
          );
        })}
      </tr>
      {rowIssues.length > 0 && (
        <tr>
          <td colSpan={span} className="border-b border-border/60 bg-muted/30 px-3 py-1 text-[11px]">
            {rowIssues.map((x, k) => (
              <span key={k} className={cn("block", x.level === "error" ? "text-danger" : "text-amber-700 dark:text-amber-300")}>
                {x.message}
              </span>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}
