import { cookies } from "next/headers";
import { FlaskConical, UserRoundCheck } from "lucide-react";
import { requireModule } from "@/lib/guard";
import { getRoleRequests } from "@/lib/data/repo";
import { DEMO_COOKIE, demoActive } from "@/lib/demo";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { RoleRequestsView } from "@/components/roles/role-requests-view";
import { EmptyState } from "@/components/ui/empty";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Role Request" };

export default async function RolesPage() {
  // Guard first: the whole module is admin-only (MODULE_ACCESS_LEVEL.roles).
  await requireModule("roles");
  const store = await cookies();
  const isDemo = demoActive(store.get(DEMO_COOKIE)?.value);
  const [requests, t] = await Promise.all([getRoleRequests(), getT()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Role Request")}
        description={t("Akun yang baru mendaftar belum punya peran. Setujui atau abaikan permintaan peran di sini.")}
      />

      {/* The menu stays visible in the demo so people can see what it looks
          like — but nothing here can actually work without real accounts. */}
      {isDemo && (
        <Card className="flex items-start gap-3 border-amber-300/60 bg-amber-50/60 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1.5 text-sm">
            <p className="font-medium">{t("Kenapa Role Request tidak berfungsi di Mode Demo?")}</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              <li>{t("Mode Demo memakai database terpisah berisi data contoh, bukan data asli — jadi tidak ada akun sungguhan di dalamnya.")}</li>
              <li>{t("Di Mode Demo kamu tidak login: identitas diambil dari tombol peran di kanan atas, bukan dari akun. Karena itu tidak ada akun yang bisa mengajukan peran, dan tidak ada peran yang bisa disimpan.")}</li>
              <li>{t("Menyetujui pengajuan berarti mengubah peran sebuah akun. Tanpa akun, tidak ada yang bisa diubah.")}</li>
            </ul>
            <p className="text-muted-foreground">
              {t("Untuk mencoba fiturnya secara utuh, keluar dari Mode Demo lalu daftar akun di sistem yang sebenarnya. Di sini kamu tetap bisa melihat tampilan halamannya.")}
            </p>
          </div>
        </Card>
      )}

      {requests.length === 0 ? (
        <EmptyState
          icon={<UserRoundCheck />}
          title={t("Belum ada permintaan peran")}
          description={
            isDemo
              ? t("Mode Demo tidak punya akun, jadi daftar ini selalu kosong.")
              : t("Permintaan dari akun yang baru mendaftar akan muncul di sini.")
          }
        />
      ) : (
        <RoleRequestsView requests={requests} />
      )}
    </div>
  );
}
