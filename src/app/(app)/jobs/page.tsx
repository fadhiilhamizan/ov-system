import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getJobs } from "@/lib/data/repo";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { JobsTable } from "@/components/jobs/jobs-table";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Hari-H" };

export default async function JobsPage() {
  const [event, user, t] = await Promise.all([getActiveEvent(), getCurrentUser(), getT()]);
  const jobs = await getJobs(event.id);

  return (
    <div>
      <PageHeader
        title={t("Pembagian Tugas Hari-H")}
        description={t("Pembagian tugas panitia saat hari pelaksanaan Ormawa Visit.")}
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <JobsTable jobs={jobs} eventId={event.id} canManage={can.manageJobs(user)} />
    </div>
  );
}
