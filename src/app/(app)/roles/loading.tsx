import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkList } from "@/components/skeletons";

// Role Request: pending requests, each with approve / reject.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader badge={false} />
      <Skeleton className="h-4 w-40" />
      <SkList n={6} />
    </SkPage>
  );
}
