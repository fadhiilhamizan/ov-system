import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkStats, SkToolbar, SkTable } from "@/components/skeletons";

// Reach & Offer: pipeline numbers, toolbar, prospect table.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkStats />
      <SkToolbar filters={1} actions={2} views={2} />
      <Skeleton className="h-3 w-20" />
      <SkTable cols={7} rows={10} widths={[2.2, 1.8, 1.6, 1.2, 1.3, 1.6, 2]} />
    </SkPage>
  );
}
