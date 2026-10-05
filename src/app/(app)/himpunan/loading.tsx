import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkTabs, SkTable } from "@/components/skeletons";

// Himpunan: FGD / Compare tabs, then a two-column plotting table.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkTabs n={2} />
      <Skeleton className="h-3 w-96 max-w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-56 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <SkTable cols={2} rows={10} widths={[1, 1]} />
    </SkPage>
  );
}
