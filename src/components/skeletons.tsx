import * as React from "react";
import { Skeleton } from "@/components/ui/empty";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

// ============================================================
// Loading skeletons, one per menu (each route's loading.tsx), built from the
// blocks below so every placeholder has the SHAPE of the page it stands in
// for: the Work Breakdown shows a toolbar and a table, the calendar a month
// grid, Super Link grouped cards. A generic "KPI row + two boxes" for every
// menu told people nothing and then jumped when the real layout arrived.
//
// They are full height and live in the normal page flow, so a long skeleton
// scrolls like the page will; a wide one (the rundown) scrolls sideways inside
// its own box. On a phone the table blocks turn into stacked cards, matching
// what `<Table stack>` does with the real rows.
// ============================================================

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Page wrapper: announces "loading" once for screen readers. */
export async function SkPage({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = await getT();
  return (
    <div className={cn("animate-fade-in space-y-4", className)} aria-busy="true">
      <span role="status" className="sr-only">{t("Memuat halaman…")}</span>
      {children}
    </div>
  );
}

/** Title, description and the edition badge, like PageHeader. */
export function SkHeader({ actions = 0, badge = true }: { actions?: number; badge?: boolean }) {
  return (
    <div className="mb-2 flex flex-col gap-2 sm:mb-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-6 w-52 sm:h-7 sm:w-64" />
        <Skeleton className="h-3.5 w-72 max-w-full sm:h-4 sm:w-96" />
        {badge && <Skeleton className="h-5 w-28 rounded-full" />}
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {range(actions).map((i) => <Skeleton key={i} className="h-9 w-28 rounded-lg" />)}
        </div>
      )}
    </div>
  );
}

/** A row of StatCards. */
export function SkStats({ n = 4 }: { n?: number }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", n >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
      {range(n).map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3.5 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16 sm:h-7" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="size-7 rounded-lg sm:size-10 sm:rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Search box, filter buttons and the action buttons on the right. */
export function SkToolbar({ filters = 2, actions = 2, views = 0 }: { filters?: number; actions?: number; views?: number }) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Skeleton className="h-9 w-full rounded-lg sm:w-64" />
        <div className="flex gap-2 overflow-hidden">
          {range(filters).map((i) => <Skeleton key={i} className="h-10 w-32 shrink-0 rounded-lg" />)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {views > 0 && <Skeleton className="h-9 rounded-lg" style={{ width: views * 40 }} />}
        {range(actions).map((i) => <Skeleton key={i} className={cn("h-9 rounded-lg", i === actions - 1 ? "ml-auto w-24 sm:ml-0" : "w-28")} />)}
      </div>
    </div>
  );
}

/** Pills under a toolbar (status counts, category chips). */
export function SkChips({ n = 4 }: { n?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Skeleton className="h-5 w-16 rounded-full" />
      {range(n).map((i) => <Skeleton key={i} className="h-5 w-20 rounded-full" />)}
    </div>
  );
}

/** Tabs strip. */
export function SkTabs({ n = 2 }: { n?: number }) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
      {range(n).map((i) => <Skeleton key={i} className={cn("h-7 w-28 rounded-md", i === 0 ? "bg-card" : "bg-muted-foreground/10")} />)}
    </div>
  );
}

/**
 * A data table: real header + rows from md up, stacked cards below md (the
 * same switch `<Table stack>` makes).
 */
export function SkTable({
  cols = 6, rows = 8, check = true, widths,
}: {
  cols?: number;
  rows?: number;
  check?: boolean;
  /** Relative widths per column (fr), first is usually the title. */
  widths?: number[];
}) {
  const w = widths ?? [3, ...range(cols - 1).map(() => 1.4)];
  const template = `${check ? "2rem " : ""}${w.map((x) => `${x}fr`).join(" ")} 2rem`;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="hidden md:block">
        <div className="grid items-center gap-4 border-b border-border px-3 py-3" style={{ gridTemplateColumns: template }}>
          {check && <Skeleton className="size-4 rounded" />}
          {w.map((_, i) => <Skeleton key={i} className="h-3 w-16" />)}
          <span />
        </div>
        {range(rows).map((r) => (
          <div key={r} className="grid items-center gap-4 border-b border-border px-3 py-3.5 last:border-0" style={{ gridTemplateColumns: template }}>
            {check && <Skeleton className="size-4 rounded" />}
            {w.map((x, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className={cn("h-3.5", i === 0 ? (r % 3 === 0 ? "w-11/12" : "w-3/4") : r % 2 ? "w-2/3" : "w-1/2")} />
                {i === 0 && r % 2 === 0 && <Skeleton className="h-3 w-1/2" />}
              </div>
            ))}
            <Skeleton className="size-6 rounded-md" />
          </div>
        ))}
      </div>
      <div className="divide-y divide-border md:hidden">
        {range(Math.min(rows, 6)).map((r) => (
          <div key={r} className="space-y-2.5 p-3.5">
            <div className="flex items-center gap-2">
              {check && <Skeleton className="size-4 rounded" />}
              <Skeleton className={cn("h-4", r % 2 ? "w-3/5" : "w-4/5")} />
              <Skeleton className="ml-auto size-6 rounded-md" />
            </div>
            {range(Math.min(cols - 1, 5)).map((i) => (
              <div key={i} className="grid grid-cols-[6.25rem_1fr] gap-3">
                <Skeleton className="h-3 w-14" />
                <Skeleton className={cn("h-3.5", i % 2 ? "w-1/3" : "w-1/2")} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A plain card with a title and a few lines. */
export function SkCard({ lines = 3, className, title = true }: { lines?: number; className?: string; title?: boolean }) {
  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5", className)}>
      {title && <Skeleton className="h-4 w-40" />}
      {range(lines).map((i) => <Skeleton key={i} className={cn("h-3.5", i % 3 === 2 ? "w-2/3" : i % 2 ? "w-5/6" : "w-full")} />)}
    </div>
  );
}

/** Grid of cards (divisions, editions). */
export function SkCardGrid({ n = 6, cols = 3, lines = 3, tall }: { n?: number; cols?: 2 | 3; lines?: number; tall?: boolean }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:gap-4", cols === 3 ? "md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5" : "md:grid-cols-2 3xl:grid-cols-3 4xl:grid-cols-4")}>
      {range(n).map((i) => (
        <div key={i} className={cn("space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5", tall && "min-h-[220px]")}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          {range(lines).map((l) => <Skeleton key={l} className={cn("h-3", l % 2 ? "w-3/4" : "w-full")} />)}
        </div>
      ))}
    </div>
  );
}

/** Rows of a list (inbox messages, role requests, link entries). */
export function SkList({ n = 6, avatar = true, className }: { n?: number; avatar?: boolean; className?: string }) {
  return (
    <div className={cn("divide-y divide-border overflow-hidden rounded-xl border border-border bg-card", className)}>
      {range(n).map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          {avatar && <Skeleton className="size-8 shrink-0 rounded-lg" />}
          <div className="flex-1 space-y-1.5">
            <Skeleton className={cn("h-3.5", i % 2 ? "w-1/2" : "w-2/3")} />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-7 w-14 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Month grid with a header, like CalendarView. */
export function SkCalendar() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Skeleton className="h-5 w-40" />
        <div className="flex gap-1">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {range(7).map((i) => <div key={i} className="flex justify-center py-2"><Skeleton className="h-3 w-6" /></div>)}
      </div>
      <div className="grid grid-cols-7">
        {range(42).map((i) => (
          <div key={i} className="min-h-[60px] space-y-1.5 border-b border-r border-border p-1.5 sm:min-h-[92px] [&:nth-child(7n)]:border-r-0">
            <Skeleton className="size-5 rounded-full" />
            {i % 5 === 2 && <Skeleton className="hidden h-3 w-full sm:block" />}
            {i % 7 === 4 && <Skeleton className="hidden h-3 w-4/5 sm:block" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The rundown: frozen columns on the left, many division columns, scrolls sideways. */
export function SkRundown({ rows = 9, divisions = 5 }: { rows?: number; divisions?: number }) {
  const cols = ["3rem", "6rem", "4.5rem", "13rem", "9rem", "10rem", ...range(divisions).map(() => "9.5rem"), "11rem"];
  const template = cols.join(" ");
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div style={{ minWidth: 1200 }}>
        <div className="grid items-center gap-2 border-b border-border bg-muted/40 px-2 py-2.5" style={{ gridTemplateColumns: template }}>
          {cols.map((_, i) => <Skeleton key={i} className="h-3 w-12" />)}
        </div>
        {range(rows).map((r) => (
          <div key={r} className="grid items-start gap-2 border-b border-border/60 px-2 py-2.5 last:border-0" style={{ gridTemplateColumns: template }}>
            {cols.map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className={cn("h-3.5", i === 0 ? "w-5" : i === 3 ? "w-11/12" : (r + i) % 3 ? "w-3/4" : "w-1/2")} />
                {i === 1 && <Skeleton className="h-3 w-3/5" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kanban-ish columns of cards (Reach & Offer pipeline, WBS kanban). */
export function SkColumns({ n = 4, cards = 3 }: { n?: number; cards?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {range(n).map((c) => (
        <div key={c} className="space-y-2 rounded-xl border border-border bg-muted/30 p-2">
          <Skeleton className="m-1 h-4 w-24" />
          {range(cards - (c % 2)).map((i) => <SkCard key={i} lines={2} title={false} className="p-3 sm:p-3" />)}
        </div>
      ))}
    </div>
  );
}
