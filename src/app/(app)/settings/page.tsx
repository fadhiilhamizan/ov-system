import { Check, Minus, Database, ShieldCheck, Info, Cloud } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResetDataButton } from "@/components/settings/reset-data-button";
import { ROLE_META, ROLE_ORDER, MODULE_ACCESS } from "@/lib/constants";
import { NAV } from "@/components/layout/nav-config";

export const metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const modules = NAV.flatMap((g) => g.items);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi sistem, hak akses peran, dan manajemen data Ormawa Visit Command Center."
      />

      {/* Backend status */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Cloud className="size-4 text-primary" />
          <CardTitle>Status Backend</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Sumber data</p>
              <p className="text-xs text-muted-foreground">
                {supabaseConfigured
                  ? "Supabase (cloud) - akun & real-time aktif"
                  : "Mode demo lokal - data dari kedua file Excel, tersimpan di .data/db.json"}
              </p>
            </div>
            <Badge variant={supabaseConfigured ? "success" : "warning"}>
              {supabaseConfigured ? "Supabase" : "Demo Lokal"}
            </Badge>
          </div>
          {!supabaseConfigured && (
            <p className="text-xs text-muted-foreground">
              Untuk mengaktifkan akun sungguhan & sinkronisasi real-time multi-user, isi kredensial
              Supabase pada <code className="rounded bg-muted px-1 py-0.5">.env.local</code> dan jalankan
              migrasi di <code className="rounded bg-muted px-1 py-0.5">supabase/</code>. Lihat{" "}
              <code className="rounded bg-muted px-1 py-0.5">README.md</code>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Roles matrix */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <CardTitle>Hak Akses per Peran</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">Modul</th>
                  {ROLE_ORDER.map((r) => (
                    <th key={r} className="px-2 py-2 text-center font-medium">
                      {ROLE_META[r].label.split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.key} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-medium">{m.label}</td>
                    {ROLE_ORDER.map((r) => {
                      const allowed = (MODULE_ACCESS[m.key] ?? []).includes(r);
                      return (
                        <td key={r} className="px-2 py-2 text-center">
                          {allowed ? (
                            <Check className="mx-auto size-4 text-emerald-500" />
                          ) : (
                            <Minus className="mx-auto size-4 text-muted-foreground/40" />
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
                <p className="text-sm font-semibold">{ROLE_META[r].label}</p>
                <p className="text-xs text-muted-foreground">{ROLE_META[r].description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data management */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Database className="size-4 text-primary" />
          <CardTitle>Manajemen Data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Kembalikan seluruh data ke kondisi awal dari file{" "}
            <span className="font-medium text-foreground">MAIN SHEET ORMAWA VISIT.xlsx</span> &{" "}
            <span className="font-medium text-foreground">ORMAWA VISIT 2026.xlsx</span>.
          </p>
          {user.role === "admin" ? (
            <ResetDataButton />
          ) : (
            <Badge variant="outline">Hanya Admin</Badge>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Info className="size-4 text-primary" />
          <CardTitle>Tentang</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Ormawa Visit Command Center · v1.0</p>
          <p>Sistem manajemen program kerja Ormawa Visit - Departemen External Affairs HMSI ITS.</p>
          <p>Dibangun dari digitalisasi Main Sheet Ormawa Visit (eks Google Sheets).</p>
        </CardContent>
      </Card>
    </div>
  );
}
