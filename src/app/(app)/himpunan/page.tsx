import { requireModule } from "@/lib/guard";
import { attenuate, can } from "@/lib/permissions";
import { getActiveEvent } from "@/lib/session";
import { getProspects } from "@/lib/data/repo";
import { getCompareEntries, getFgdPlans, getFgdRows } from "@/lib/data/himpunan-repo";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { HimpunanView } from "@/components/himpunan/himpunan-view";
import { acceptedProspects } from "@/lib/himpunan";

export const metadata = { title: "Himpunan" };

export default async function HimpunanPage() {
  const user = await requireModule("himpunan");
  const [event, t] = await Promise.all([getActiveEvent(), getT()]);
  const [plans, rows, compare, prospects] = await Promise.all([
    getFgdPlans(event.id),
    getFgdRows(event.id),
    getCompareEntries(event.id),
    getProspects(event.id),
  ]);

  // An archived edition degrades to read-only without threading a flag through
  // every child - same pattern as the other edition-scoped pages.
  const scoped = attenuate(user, event);

  return (
    <div>
      <PageHeader
        title={t("Himpunan")}
        description={t("Plotting FGD antar departemen dan perbandingan himpunan yang menerima ajakan.")}
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <HimpunanView
        eventId={event.id}
        plans={plans}
        rows={rows}
        compare={compare}
        accepted={acceptedProspects(prospects)}
        canManage={can.manageHimpunan(scoped)}
      />
    </div>
  );
}
