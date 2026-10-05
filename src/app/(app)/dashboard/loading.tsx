import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkStats, SkCard } from "@/components/skeletons";

// Dashboard: greeting, quick-access tiles, four KPIs, progress donut + divisions, deadlines.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={1} badge={false} />
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex w-56 shrink-0 items-center gap-3 rounded-xl border border-border bg-card p-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <SkStats />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-5 lg:col-span-2 sm:flex-row">
          <Skeleton className="size-40 rounded-full" />
          <div className="grid w-full flex-1 grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        </div>
        <SkCard lines={6} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkCard lines={7} className="lg:col-span-2" />
        <SkCard lines={5} />
      </div>
      <SkCard lines={4} />
    </SkPage>
  );
}
