import { getCurrentUser } from "@/lib/auth";
import { getLinks } from "@/lib/data/repo";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { LinksView } from "@/components/links/links-view";

export const metadata = { title: "Super Link" };

export default async function LinksPage() {
  const user = await getCurrentUser();
  const links = getLinks();

  return (
    <div>
      <PageHeader
        title="Super Link"
        description="Direktori terpusat semua dokumen, form, dan drive penting Ormawa Visit — dikelompokkan per edisi & divisi."
      />
      <LinksView links={links} user={user} canManage={can.manageLinks(user)} />
    </div>
  );
}
