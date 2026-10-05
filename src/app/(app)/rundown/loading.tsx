import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkRundown } from "@/components/skeletons";

// Rundown: column filter, then the wide table (scrolls sideways, like the real one).
export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-3 w-64 max-w-[50%]" />
      </div>
      <SkRundown rows={10} />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
    </SkPage>
  );
}
