import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { getLinks, getEvents, getDivisions, getTeams } from "@/lib/data/repo";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { LinksView } from "@/components/links/links-view";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Super Link" };

export default async function LinksPage() {
  const [user, activeEvent, links, events, divisions, teams] = await Promise.all([
    getCurrentUser(),
    getActiveEvent(),
    getLinks(),
    getEvents(),
    getDivisions(),
    getTeams(),
  ]);
  const t = await getT();

  return (
    <div>
      <PageHeader
        title={t("Super Link")}
        description={t("Kumpulan dokumen, form, dan drive penting Ormawa Visit, dikelompokkan per Ormawa Visit & divisi.")}
      />
      <LinksView
        links={links}
        events={events}
        divisions={divisions}
        teams={teams}
        defaultEventId={activeEvent.id}
        canCreate={can.createLink(user)}
        canManage={can.manageLinks(user)}
      />
    </div>
  );
}
