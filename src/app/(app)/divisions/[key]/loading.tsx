import { SkPage, SkHeader, SkStats, SkToolbar, SkTable } from "@/components/skeletons";

// One division board: its numbers, then its slice of the task table.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={1} />
      <SkStats />
      <SkToolbar filters={3} actions={2} views={3} />
      <SkTable cols={8} rows={10} widths={[3, 2, 1.2, 1.2, 1.2, 1.1, 1.3, 2]} />
    </SkPage>
  );
}
