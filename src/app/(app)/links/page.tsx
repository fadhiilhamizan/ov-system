import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { getLinks } from "@/lib/data/repo";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { LinksView } from "@/components/links/links-view";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Super Link" };

export default async function LinksPage() {
  const [user, event] = await Promise.all([getCurrentUser(), getActiveEvent()]);
  const links = await getLinks(event.id);

  return (
    <div>
      <PageHeader
        title="Super Link"
        description="Kumpulan dokumen, form, dan drive penting Ormawa Visit, dikelompokkan per seksi & divisi."
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <LinksView
        links={links}
        user={user}
        activeEventId={event.id}
        canCreate={can.createLink(user)}
        canManage={can.manageLinks(user)}
      />
    </div>
  );
}
