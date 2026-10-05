import { SkPage, SkHeader, SkCardGrid } from "@/components/skeletons";

// Daftar Ormawa Visit: one large card per edition.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={1} badge={false} />
      <SkCardGrid n={4} cols={2} lines={6} tall />
    </SkPage>
  );
}
