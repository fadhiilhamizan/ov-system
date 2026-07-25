import { UserRoundCheck } from "lucide-react";
import { requireModule } from "@/lib/guard";
import { getRoleRequests, getDivisions, getEvents } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { RoleRequestsView } from "@/components/roles/role-requests-view";
import { EmptyState } from "@/components/ui/empty";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Role Request" };

export default async function RolesPage() {
  // Guard first: the whole module is admin-only (MODULE_ACCESS_LEVEL.roles).
  await requireModule("roles");
  const [requests, events, divisions, t] = await Promise.all([
    getRoleRequests(),
    getEvents(),
    getDivisions(),
    getT(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Role Request")}
        description={t("Akun yang baru mendaftar belum punya peran. Setujui atau abaikan permintaan peran di sini.")}
      />
      {requests.length === 0 ? (
        <EmptyState
          icon={<UserRoundCheck />}
          title={t("Belum ada permintaan peran")}
          description={t("Permintaan dari akun yang baru mendaftar akan muncul di sini.")}
        />
      ) : (
        <RoleRequestsView requests={requests} events={events} divisions={divisions} />
      )}
    </div>
  );
}
