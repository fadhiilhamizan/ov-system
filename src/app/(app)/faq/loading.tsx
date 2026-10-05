import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader } from "@/components/skeletons";

// FAQ: a column of collapsed questions.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={1} badge={false} />
      <div className="space-y-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
            <Skeleton className={i % 3 ? "h-4 w-2/3" : "h-4 w-1/2"} />
            <Skeleton className="ml-auto size-4" />
          </div>
        ))}
      </div>
    </SkPage>
  );
}
