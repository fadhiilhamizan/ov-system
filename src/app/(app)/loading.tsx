import { SkPage, SkHeader, SkStats, SkCard } from "@/components/skeletons";

// Fallback for any route without its own skeleton (and the developer page).
export default function Loading() {
  return (
    <SkPage>
      <SkHeader badge={false} />
      <SkStats />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkCard lines={8} className="lg:col-span-2" />
        <SkCard lines={8} />
      </div>
    </SkPage>
  );
}
