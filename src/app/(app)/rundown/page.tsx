import { getActiveEvent } from "@/lib/session";
import { getRundown } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { RundownView } from "@/components/rundown/rundown-view";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Rundown Acara" };

export default async function RundownPage() {
  const event = await getActiveEvent();
  const items = await getRundown(event.id);

  return (
    <div>
      <PageHeader
        title="Rundown Acara (Juklak-Juknis)"
        description="Susunan acara hari-H beserta pengisi, MC, kebutuhan operator, dan job per divisi."
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <RundownView items={items} />
    </div>
  );
}
