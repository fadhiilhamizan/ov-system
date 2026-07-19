import { Check, Eye, Minus, ShieldCheck, Info, Cloud, MessageCircle, UserCircle, DatabaseBackup, History } from "lucide-react";
import { getCurrentUser, USE_SUPABASE } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listBackupsAction } from "@/lib/actions/backup";
import { APP_VERSION, APP_CODENAME } from "@/lib/version";
import { CHANGELOG } from "@/lib/changelog";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { BackupPanel } from "@/components/settings/backup-panel";
import { ROLE_META, ROLE_ORDER, MODULE_ACCESS_LEVEL } from "@/lib/constants";
import { NAV } from "@/components/layout/nav-config";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Pengaturan" };

const WHATSAPP_URL = "https://wa.me/6281311598126";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const t = await getT();
  const modules = NAV.flatMap((g) => g.items);
  const canBackup = can.manageBackups(user);
  const backupsResult = canBackup ? await listBackupsAction() : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Pengaturan")}
        description={t("Konfigurasi sistem, hak akses peran, backup, dan informasi Ormawa Visit Command Center.")}
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

      {/* Account */}
      <Card>
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
      <Card>
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

      {/* Backup & Rollback */}
      {canBackup && (
        <Card>
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
      )}

      {/* Roles matrix */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <CardTitle>{t("Hak Akses per Peran")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Legend: three access states */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-emerald-500" /> {t("Akses penuh (kelola)")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-4 text-sky-500" /> {t("Hanya lihat")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Minus className="size-4 text-muted-foreground/40" /> {t("Tidak ada akses")}
            </span>
          </div>
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
                          ) : level === "view" ? (
                            <Eye className="mx-auto size-4 text-sky-500" aria-label={t("Hanya lihat")} />
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
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <History className="size-4 text-primary" />
          <CardTitle>Changelog</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {CHANGELOG.map((entry, i) => (
              <details key={entry.version} className="group rounded-lg border border-border" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <Badge variant={i === 0 ? "primary" : "outline"}>v{entry.version}</Badge>
                  <span className="text-sm font-medium">{entry.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(entry.date, { long: true })}</span>
                </summary>
                <ul className="space-y-1 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  {entry.changes.map((c, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="text-primary">•</span> {c}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Info className="size-4 text-primary" />
          <CardTitle>{t("Tentang")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Ormawa Visit Command Center · v{APP_VERSION} “{APP_CODENAME}”</p>
          <p>{t("Sistem manajemen program kerja Ormawa Visit - Departemen External Affairs HMSI ITS.")}</p>
          <p>
            {t("Ada pertanyaan atau masukan? Hubungi")}{" "}
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              WhatsApp
            </a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
