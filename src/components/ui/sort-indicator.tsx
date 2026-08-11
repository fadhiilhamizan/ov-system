"use client";
import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { SortDir, useMultiSort } from "@/lib/use-multi-sort";

/**
 * Sort arrow for a table header. When more than one column is sorted, shows the
 * column's 1-based priority so the stacking order is visible.
 */
export function SortIndicator({
  dir,
  rank,
  showRank,
}: {
  dir?: SortDir;
  rank: number;
  showRank: boolean;
}) {
  if (!dir) return <ChevronsUpDown className="size-3.5 opacity-40" />;
  return (
    <span className="inline-flex items-center gap-0.5 text-primary">
      {dir === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      {showRank && rank >= 0 && (
        <span className="text-[10px] font-semibold tabular-nums">{rank + 1}</span>
      )}
    </span>
  );
}

/**
 * Clickable sortable column header. Defined at module scope (not inside a
 * component's render) so React keeps the same component identity between
 * renders - otherwise the header remounts on every keystroke and the
 * react-hooks/static-components rule fires.
 */
export function SortHead<K extends string>({
  sort,
  k,
  className,
  children,
}: {
  sort: ReturnType<typeof useMultiSort<K>>;
  k: K;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => sort.toggle(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <SortIndicator dir={sort.dirOf(k)} rank={sort.rankOf(k)} showRank={sort.rules.length > 1} />
      </button>
    </TableHead>
  );
}
