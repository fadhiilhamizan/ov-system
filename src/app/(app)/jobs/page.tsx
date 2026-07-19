import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getJobs, getMembers } from "@/lib/data/repo";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { JobsTable } from "@/components/jobs/jobs-table";
import { MembersProvider } from "@/components/members/members-context";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Hari-H" };

export default async function JobsPage() {
  const [event, user, t] = await Promise.all([getActiveEvent(), getCurrentUser(), getT()]);
  const [jobs, members] = await Promise.all([getJobs(event.id), getMembers(event.id)]);

  return (
    <div>
      <PageHeader
        title={t("Pembagian Tugas Hari-H")}
        description={t("Pembagian tugas panitia saat hari pelaksanaan Ormawa Visit.")}
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <MembersProvider members={members}>
        <JobsTable jobs={jobs} eventId={event.id} canManage={can.manageJobs(user)} />
      </MembersProvider>
    </div>
  );
}
