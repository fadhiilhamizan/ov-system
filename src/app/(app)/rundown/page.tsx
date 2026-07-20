import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getRundown, getDivisions } from "@/lib/data/repo";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { RundownView } from "@/components/rundown/rundown-view";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Rundown Acara" };

export default async function RundownPage() {
  const [event, user, t] = await Promise.all([getActiveEvent(), getCurrentUser(), getT()]);
  const [items, divisions] = await Promise.all([getRundown(event.id), getDivisions(event.id)]);

  return (
    <div>
      <PageHeader
        title={t("Rundown Acara (Juklak-Juknis)")}
        description={t("Susunan acara hari-H: tiap divisi menjadi kolom, isi kegiatannya langsung di tabel.")}
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <RundownView items={items} divisions={divisions} eventId={event.id} canManage={can.manageRundown(user)} />
    </div>
  );
}
