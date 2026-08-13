import { cookies } from "next/headers";
import { Check, Minus, ShieldCheck, Info, Cloud, MessageCircle, UserCircle, DatabaseBackup, History, FlaskConical, FileSpreadsheet, ExternalLink, Code2 } from "lucide-react";
import { ARCHIVE_SHEETS } from "@/lib/archives";
import { USE_SUPABASE } from "@/lib/auth";
import { requireModule } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { listBackupsAction } from "@/lib/actions/backup";
import { DEMO_COOKIE, demoActive } from "@/lib/demo";
import { APP_VERSION } from "@/lib/version";
import { CHANGELOG } from "@/lib/changelog";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { BackupPanel } from "@/components/settings/backup-panel";
import { ChangelogList } from "@/components/settings/changelog-list";
import { DemoReset } from "@/components/settings/demo-reset";
import { ROLE_META, ROLE_ORDER, MODULE_ACCESS_LEVEL } from "@/lib/constants";
import { NAV } from "@/components/layout/nav-config";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Pengaturan" };

const WHATSAPP_URL = "https://wa.me/6281311598126";
const GITHUB_URL = "https://github.com/fadhiilhamizan/ov-system";

/** lucide dropped its brand icons, so the GitHub mark is inlined here. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export default async function SettingsPage() {
  // Guard first: only admin can open Pengaturan.
  const user = await requireModule("settings");
  const t = await getT();
  const store = await cookies();
  const isDemo = demoActive(store.get(DEMO_COOKIE)?.value);
  const modules = NAV.flatMap((g) => g.items);
  const canBackup = can.manageBackups(user);
  // Backup only makes sense against the real (production) DB - in the demo
  // sandbox we offer a "reset to initial data" instead.
  const backupsResult = canBackup && !isDemo ? await listBackupsAction() : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Pengaturan")}
        description={t("Konfigurasi sistem, hak akses peran, backup, dan informasi Ormawa Visit Management System.")}
      />

      {/* Under-development notice */}
      <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-600 dark:text-amber-300">
              <Info className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{t("Website ini masih dalam pengembangan")}</p>
              <p className="text-sm text-muted-foreground">
                {t("Kalau menemukan bug, error, atau punya keluhan/masukan, langsung hubungi lewat WhatsApp.")}
              </p>
            </div>
          </div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-105"
          >
            <MessageCircle className="size-4" /> {t("Hubungi via WhatsApp")}
          </a>
        </CardContent>
      </Card>

      {/* Account. The `id` on this and the cards below are anchor targets:
          Violet links to them (e.g. /settings#changelog) and the app shell's
          AnchorScroller scrolls the section into view. Keep them in step with
          APP_ROUTES in lib/violet/links.ts. */}
      <Card id="akun">
        <CardHeader className="flex-row items-center gap-2">
          <UserCircle className="size-4 text-primary" />
          <CardTitle>{t("Akun Saya")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Avatar name={user.name} color={user.avatarColor} size={44} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email || t("Mode tamu")}</p>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0">{t(ROLE_META[user.role].label)}</Badge>
        </CardContent>
      </Card>

      {/* Backend status */}
      <Card id="backend">
        <CardHeader className="flex-row items-center gap-2">
          <Cloud className="size-4 text-primary" />
          <CardTitle>{t("Status Backend")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">{t("Sumber data")}</p>
              <p className="text-xs text-muted-foreground">
                {USE_SUPABASE
                  ? t("Supabase (cloud) - akun & real-time aktif")
                  : t("Mode demo lokal - data tersimpan di .data/db.json")}
              </p>
            </div>
            <Badge variant={USE_SUPABASE ? "success" : "warning"}>
              {USE_SUPABASE ? "Supabase" : t("Demo Lokal")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Archive of the original spreadsheets this system replaced. Read-only
          reference, visible to everyone who can open Pengaturan. */}
      <Card id="arsip">
        <CardHeader className="flex-row items-center gap-2">
          <FileSpreadsheet className="size-4 text-primary" />
          <CardTitle>{t("Arsip Spreadsheet")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("Main Sheet asli sebelum sistem ini dibuat. Disimpan sebagai rujukan - semua riwayat Ormawa Visit sebelum aplikasi ini ada tercatat di sana.")}
          </p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {ARCHIVE_SHEETS.map((sheet) => (
              <a
                key={sheet.url}
                href={sheet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-muted/50"
              >
                <Badge variant="outline" className="shrink-0 tabular-nums">{sheet.year}</Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{sheet.title}</span>
                <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Demo: reset to initial data (replaces backup while in the sandbox).
          Both this and Backup are admin-only - the page itself is now readable
          by coordinator/staff/intern, who get the matrix + changelog only. */}
      {isDemo ? (
        canBackup && (
        <Card id="demo">
          <CardHeader className="flex-row items-center gap-2">
            <FlaskConical className="size-4 text-amber-500" />
            <CardTitle>{t("Data Mode Demo")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DemoReset />
          </CardContent>
        </Card>
        )
      ) : (
        canBackup && (
          <Card id="backup">
            <CardHeader className="flex-row items-center gap-2">
              <DatabaseBackup className="size-4 text-primary" />
              <CardTitle>{t("Backup & Rollback")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!USE_SUPABASE ? (
                <p className="text-sm text-muted-foreground">
                  {t("Backup hanya tersedia saat sistem terhubung ke Supabase (mode cloud).")}
                </p>
              ) : backupsResult && backupsResult.ok ? (
                <BackupPanel initialBackups={backupsResult.backups} />
              ) : (
                <p className="text-sm text-danger">{backupsResult && !backupsResult.ok ? backupsResult.error : t("Gagal memuat backup.")}</p>
              )}
            </CardContent>
          </Card>
        )
      )}

      {/* Roles matrix */}
      <Card id="akses">
        <CardHeader className="flex-row items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <CardTitle>{t("Hak Akses per Peran")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Legend: four access states */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-emerald-500" /> {t("Akses penuh (kelola)")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-amber-500" /> {t("Akses terbatas")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-sky-500" /> {t("Hanya lihat")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Minus className="size-4 text-muted-foreground/40" /> {t("Tidak ada akses")}
            </span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("Akses terbatas: bisa membuat, mengubah, dan mengisi hasil - tapi tidak bisa menghapus.")}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">{t("Modul")}</th>
                  {ROLE_ORDER.map((r) => (
                    <th key={r} className="px-2 py-2 text-center font-medium">
                      {t(ROLE_META[r].label).split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.key} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-medium">{t(m.label)}</td>
                    {ROLE_ORDER.map((r) => {
                      const level = MODULE_ACCESS_LEVEL[m.key]?.[r] ?? "none";
                      return (
                        <td key={r} className="px-2 py-2 text-center">
                          {level === "full" ? (
                            <Check className="mx-auto size-4 text-emerald-500" aria-label={t("Akses penuh (kelola)")} />
                          ) : level === "limited" ? (
                            <Check className="mx-auto size-4 text-amber-500" aria-label={t("Akses terbatas")} />
                          ) : level === "view" ? (
                            <Check className="mx-auto size-4 text-sky-500" aria-label={t("Hanya lihat")} />
                          ) : (
                            <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label={t("Tidak ada akses")} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ROLE_ORDER.map((r) => (
              <div key={r} className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold">{t(ROLE_META[r].label)}</p>
                <p className="text-xs text-muted-foreground">{t(ROLE_META[r].description)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Changelog */}
      <Card id="changelog">
        <CardHeader className="flex-row items-center gap-2">
          <History className="size-4 text-primary" />
          <CardTitle>Changelog</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangelogList entries={CHANGELOG} />
        </CardContent>
      </Card>

      {/* Open source - the code behind this app is public. */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Code2 className="size-4 text-primary" />
          <CardTitle>{t("Kode Sumber Terbuka")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {t("Seluruh kode yang membangun website ini bersifat open source - siapa pun boleh melihat, mempelajari, atau ikut mengembangkannya lewat repositori GitHub di bawah.")}
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted/50"
          >
            <GithubMark className="size-4" /> {t("Lihat di GitHub")}
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Info className="size-4 text-primary" />
          <CardTitle>{t("Tentang")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Ormawa Visit Management System · v{APP_VERSION}</p>
          <p>{t("Sistem manajemen program kerja Ormawa Visit - Departemen External Affairs HMSI ITS.")}</p>
          <p>
            {t("Ada pertanyaan atau masukan? Hubungi")}{" "}
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              WhatsApp
            </a>.
          </p>
          <p>
            {t("Kode sumber:")}{" "}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              github.com/fadhiilhamizan/ov-system
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
