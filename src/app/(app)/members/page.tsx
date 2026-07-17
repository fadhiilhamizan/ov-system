import { getActiveEvent } from "@/lib/session";
import { getDivisions, getMembers, getTeams } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { MembersView } from "@/components/members/members-view";

export const metadata = { title: "Anggota & Tim" };

export default async function MembersPage() {
  const event = await getActiveEvent();
  const [members, teams, divisions] = await Promise.all([
    getMembers(),
    getTeams(event.id),
    getDivisions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Anggota & Struktur Tim"
        description="Direktori fungsionaris & intern External Affairs, serta pembagian tim per divisi."
      />
      <MembersView members={members} teams={teams} divisions={divisions} eventTitle={event.title} />
    </div>
  );
}
