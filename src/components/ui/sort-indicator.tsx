"use client";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { SortDir } from "@/lib/use-multi-sort";

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
