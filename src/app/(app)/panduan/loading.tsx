import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkCard } from "@/components/skeletons";

// Panduan: the flowchart block, then one section per menu.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader badge={false} />
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-14 w-32 rounded-xl" />)}
        </div>
      </div>
      {Array.from({ length: 6 }, (_, i) => <SkCard key={i} lines={i === 0 ? 5 : 2} />)}
    </SkPage>
  );
}
