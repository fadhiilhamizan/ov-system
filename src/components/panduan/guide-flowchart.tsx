"use client";
import * as React from "react";
import {
  Play, LogIn, FlaskConical, Eye, LayoutDashboard, CalendarRange, Copy, ListChecks,
  RefreshCcw, Link2, CalendarClock, Flag, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

// A hand-built, responsive flowchart of how to use the app end-to-end.
// Node kinds: terminal (pill), process (card), decision (branches with
// conditions — if / and / or logic made explicit through branch labels).

function Down() {
  return <div className="mx-auto h-6 w-px bg-border" aria-hidden />;
}

function Terminal({ tone, icon, children }: { tone: "start" | "end"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm",
        tone === "start" ? "bg-emerald-500" : "bg-slate-600",
      )}
    >
      {icon}
      {children}
    </div>
  );
}

function Process({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <div>
          <p className="text-sm font-semibold leading-tight">{title}</p>
          {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
    </div>
  );
}

const BRANCH_TONE: Record<string, string> = {
  yes: "border-emerald-400/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  no: "border-rose-400/60 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  opt: "border-sky-400/60 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
};

function Decision({
  question, branches,
}: {
  question: string;
  branches: { label: string; tone: keyof typeof BRANCH_TONE; text: string }[];
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mx-auto flex w-fit max-w-md items-center gap-2 rounded-xl border-2 border-amber-400/70 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-800 shadow-sm dark:bg-amber-500/10 dark:text-amber-200">
        <HelpCircle className="size-4 shrink-0" />
        {question}
      </div>
      <Down />
      <div className="grid gap-3 sm:grid-cols-3">
        {branches.map((b, i) => (
          <div key={i} className={cn("rounded-xl border p-3 text-sm", BRANCH_TONE[b.tone])}>
            <span className="mb-1.5 inline-block rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide dark:bg-black/20">
              {b.label}
            </span>
            <p className="text-xs leading-relaxed text-foreground/80">{b.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuideFlowchart() {
  const t = useT();
  return (
    <div className="space-y-0.5">
      <Terminal tone="start" icon={<Play className="size-4" />}>{t("Mulai — buka aplikasi")}</Terminal>
      <Down />

      <Decision
        question={t("Sudah punya akun?")}
        branches={[
          { label: "Ya", tone: "yes", text: t("Login dengan email & kata sandi.") },
          { label: "Tidak — coba dulu", tone: "opt", text: t("Klik 'Coba Mode Demo' (database terpisah) atau 'Masuk sebagai Tamu' (hanya lihat).") },
          { label: "Tidak — butuh akun", tone: "no", text: t("Hubungi PIC Ormawa Visit untuk dibuatkan akun.") },
        ]}
      />
      <Down />
      <Process icon={<LogIn className="size-4" />} title={t("Masuk ke sistem")} desc={t("Login, Mode Demo, atau Mode Tamu.")} />
      <Down />
      <Process icon={<LayoutDashboard className="size-4" />} title={t("Lihat Dashboard")} desc={t("Ringkasan progres, KPI, dan deadline terdekat.")} />
      <Down />
      <Process icon={<CalendarRange className="size-4" />} title={t("Pilih Ormawa Visit")} desc={t("Gunakan pemilih edisi di kanan atas. Semua modul mengikuti edisi ini.")} />
      <Down />

      <Decision
        question={t("Membuat Ormawa Visit baru?")}
        branches={[
          { label: "Ya", tone: "yes", text: t("Buka menu Ormawa Visit → Tambah. Bisa salin data (template) dari edisi sebelumnya.") },
          { label: "Tidak", tone: "no", text: t("Lanjut memakai edisi yang sudah dipilih.") },
        ]}
      />
      <Down />

      <Decision
        question={t("Apa peranmu?")}
        branches={[
          { label: "Admin / Koordinator", tone: "opt", text: t("Kelola divisi, tugas, rundown, job hari-H, dan anggaran.") },
          { label: "Staff / Intern", tone: "opt", text: t("Perbarui status & isi hasil pada tugas yang menjadi tanggung jawabmu.") },
          { label: "Tamu", tone: "no", text: t("Hanya melihat data, tanpa mengubah.") },
        ]}
      />
      <Down />
      <Process icon={<ListChecks className="size-4" />} title={t("Kerjakan tugas (Work Breakdown / Papan Divisi)")} desc={t("Tambah/kelola tugas, tentukan PIC dari daftar anggota, dan deadline.")} />
      <Down />
      <Process icon={<RefreshCcw className="size-4" />} title={t("Perbarui status tugas")} desc={t("To Do → On Going → Done. Isi kolom Hasil dengan tautan bukti.")} />
      <Down />
      <Process icon={<Link2 className="size-4" />} title={t("Kelola aset & relasi")} desc={t("Reach & Offer (prospek), Super Link (dokumen), dan Anggaran (RAB).")} />
      <Down />
      <Process icon={<CalendarClock className="size-4" />} title={t("Siapkan hari pelaksanaan")} desc={t("Susun Rundown per divisi dan pembagian Job Hari-H.")} />
      <Down />

      <Decision
        question={t("Acara sudah selesai?")}
        branches={[
          { label: "Belum", tone: "no", text: t("Kembali memantau progres di Dashboard sampai semua tugas Done.") },
          { label: "Sudah", tone: "yes", text: t("Isi catatan/evaluasi (mis. 'terlalu cepat/lama') pada rundown, lalu buat laporan akhir.") },
        ]}
      />
      <Down />
      <Terminal tone="end" icon={<Flag className="size-4" />}>{t("Selesai — evaluasi & arsip")}</Terminal>

      {/* Legend */}
      <div className="!mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-emerald-500" /> {t("Mulai")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-primary/60" /> {t("Langkah")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rotate-45 rounded-[2px] border-2 border-amber-400" /> {t("Keputusan (jika…)")}</span>
        <span className="inline-flex items-center gap-1.5"><FlaskConical className="size-3.5" /> {t("Demo")}</span>
        <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" /> {t("Tamu")}</span>
        <span className="inline-flex items-center gap-1.5"><Copy className="size-3.5" /> {t("Template")}</span>
      </div>
    </div>
  );
}
