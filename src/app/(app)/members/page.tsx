import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { divisionStats, getDivisions, getEvents, getMembers, getTeams } from "@/lib/data/repo";
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
      <MembersView
        members={members}
        teams={teams}
        divisions={divisions}
        divisionStats={stats}
        events={events}
        eventId={event.id}
        eventTitle={event.title}
        canManageMembers={can.manageMembers(user)}
        canManageTeams={can.manageTeams(user)}
        canManageDivisions={can.manageDivisions(user)}
      />
    </div>
  );
}
