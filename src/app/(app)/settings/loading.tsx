import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkCard, SkList } from "@/components/skeletons";

// Pengaturan: stacked cards (support, account, backups, access matrix, changelog).
export default function Loading() {
  return (
    <SkPage>
      <SkHeader badge={false} />
      <SkCard lines={2} />
      <SkCard lines={2} />
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-36" />
        <SkList n={4} avatar={false} />
      </div>
      <SkCard lines={8} />
      <SkCard lines={6} />
    </SkPage>
  );
}
