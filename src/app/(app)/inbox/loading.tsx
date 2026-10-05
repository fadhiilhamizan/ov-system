import { Skeleton } from "@/components/ui/empty";
import { SkPage, SkHeader, SkTabs, SkList } from "@/components/skeletons";

// Kotak Masuk: tabs, unread line, message list.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader badge={false} />
      <SkTabs n={2} />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
      <SkList n={8} />
    </SkPage>
  );
}
