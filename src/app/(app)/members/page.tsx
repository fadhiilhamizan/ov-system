import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDivisions, getEvents, getMembers, getTeams } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { MembersView } from "@/components/members/members-view";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Anggota & Tim" };

export default async function MembersPage() {
  const [event, user] = await Promise.all([getActiveEvent(), getCurrentUser()]);
  const [members, teams, divisions, events] = await Promise.all([
    getMembers(event.id),
    getTeams(event.id),
    getDivisions(),
    getEvents(),
  ]);

  return (
    <div>
      <PageHeader
        title="Anggota & Struktur Tim"
        description="Daftar fungsionaris & intern External Affairs, serta pembagian tim per divisi."
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <MembersView
        members={members}
        teams={teams}
        divisions={divisions}
        events={events}
        eventId={event.id}
        eventTitle={event.title}
        canManageMembers={can.manageMembers(user)}
        canManageTeams={can.manageTeams(user)}
      />
    </div>
  );
}
