import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDivisions, getMembers, getTeams } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { MembersView } from "@/components/members/members-view";

export const metadata = { title: "Anggota & Tim" };

export default async function MembersPage() {
  const [event, user] = await Promise.all([getActiveEvent(), getCurrentUser()]);
  const [members, teams, divisions] = await Promise.all([
    getMembers(),
    getTeams(event.id),
    getDivisions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Anggota & Struktur Tim"
        description="Daftar fungsionaris & intern External Affairs, serta pembagian tim per divisi."
      />
      <MembersView
        members={members}
        teams={teams}
        divisions={divisions}
        eventId={event.id}
        eventTitle={event.title}
        canManageMembers={can.manageMembers(user)}
        canManageTeams={can.manageTeams(user)}
      />
    </div>
  );
}
