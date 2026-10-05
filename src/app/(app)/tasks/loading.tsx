import { SkPage, SkHeader, SkToolbar, SkChips, SkTable } from "@/components/skeletons";

// Work Breakdown: toolbar with filters and view switch, status chips, the task table.
export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkToolbar filters={4} actions={2} views={3} />
      <SkChips n={4} />
      <SkTable cols={8} rows={12} widths={[3, 2, 1.2, 1.2, 1.2, 1.1, 1.3, 2]} />
    </SkPage>
  );
}
