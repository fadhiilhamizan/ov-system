import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkStats, SkTable } from "@/components/skeletons";

// Anggaran: totals, then each RAB plan card with its category chips and items.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={1} />
      <SkStats n={3} />
      {[0, 1].map((p) => (
        <div key={p} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
            <Skeleton className="hidden size-10 rounded-xl sm:block" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-28" />
          </div>
          {p === 0 && (
            <>
              <div className="flex flex-wrap gap-3 border-y border-border bg-muted/20 px-5 py-3">
                {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-4 w-28" />)}
              </div>
              <div className="p-3">
                <SkTable cols={5} rows={8} check={false} widths={[3, 0.8, 1, 1.4, 1.4]} />
              </div>
            </>
          )}
        </div>
      ))}
    </SkPage>
  );
}
