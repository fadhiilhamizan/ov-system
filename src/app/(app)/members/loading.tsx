import { SkPage, SkHeader, SkTabs, SkCardGrid } from "@/components/skeletons";

// Divisi & Anggota: tabs, then division cards with their team rosters.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={1} />
      <SkTabs n={2} />
      <SkCardGrid n={6} cols={3} lines={4} tall />
    </SkPage>
  );
}
