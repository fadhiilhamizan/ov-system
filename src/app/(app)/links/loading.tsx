import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkToolbar, SkList } from "@/components/skeletons";

// Super Link: toolbar, then edition heading over a grid of per-division link cards.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader badge={false} />
      <SkToolbar filters={1} actions={2} />
      {[0, 1].map((g) => (
        <div key={g} className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 3xl:grid-cols-3 4xl:grid-cols-4">
            {Array.from({ length: g === 0 ? 4 : 2 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <SkList n={3} className="rounded-none border-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkPage>
  );
}
