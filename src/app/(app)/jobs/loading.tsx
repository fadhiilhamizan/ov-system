import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkTable } from "@/components/skeletons";

// Hari-H: hint + buttons, then the numbered job table.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-64 max-w-[55%]" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <SkTable cols={4} rows={10} widths={[0.4, 3, 2, 2.5]} />
    </SkPage>
  );
}
