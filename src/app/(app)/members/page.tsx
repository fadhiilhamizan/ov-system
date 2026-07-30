import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { divisionStats, getDivisions, getEvents, getMembers, getTeams } from "@/lib/data/repo";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MembersView } from "@/components/members/members-view";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Divisi & Anggota" };

export default async function MembersPage() {
  const [event, user] = await Promise.all([getActiveEvent(), getCurrentUser()]);
  const [members, teams, divisions, stats, events] = await Promise.all([
    getMembers(event.id),
    getTeams(event.id),
    getDivisions(event.id),
    divisionStats(event.id),
    getEvents(),
  ]);
  const t = await getT();

  return (
    <div>
      <PageHeader
        title={t("Divisi & Anggota")}
        description={t("Divisi, daftar fungsionaris & intern, serta pembagian tim tiap divisi Ormawa Visit ini.")}
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      {/* In production, RLS hides the roster (name + NRP = PII) from guests, so
          it arrives empty here. Say so, otherwise an empty page looks broken. */}
      {user.role === "guest" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {t("Daftar nama & NRP anggota hanya tampil untuk akun yang sudah punya peran. Ajukan peran lewat menu akun untuk melihatnya.")}
          </span>
        </div>
      )}
      <MembersView
        members={members}
        teams={teams}
        divisions={divisions}
        divisionStats={stats}
        events={events}
        eventId={event.id}
        canManageMembers={can.manageMembers(user)}
        canManageTeams={can.manageTeams(user)}
        canManageDivisions={can.manageDivisions(user)}
      />
    </div>
  );
}
