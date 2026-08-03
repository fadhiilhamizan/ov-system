import { requireModule } from "@/lib/guard";
import { getActiveEvent } from "@/lib/session";
import { getLinks, getEvents, getDivisions } from "@/lib/data/repo";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { LinksView } from "@/components/links/links-view";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Super Link" };

export default async function LinksPage() {
  // Guard first: guests have no access to Super Link.
  const user = await requireModule("links");
  const [activeEvent, links, events, divisions] = await Promise.all([
    getActiveEvent(),
    getLinks(),
    getEvents(),
    getDivisions(),
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
        defaultEventId={activeEvent.id}
        canCreate={can.createLink(user)}
        canManage={can.manageLinks(user)}
        canDelete={can.deleteLink(user)}
      />
    </div>
  );
}
