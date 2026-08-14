"use client";
import * as React from "react";
import { ChevronsUpDown, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

// ============================================================
// The one filter control every table uses.
//
// Every table used to filter through a single-select dropdown, so "show me the
// prospects that were DITERIMA and the ones that were DITOLAK" was impossible:
// picking the second answer threw the first away. Ticking boxes is the shape
// that question actually has, and it is the same shape the PIC focus on the
// Work Breakdown had already grown into on its own.
//
// CONVENTION: an EMPTY selection means "no filter", not "nothing". That keeps
// the default state (everything visible) reachable by clearing the boxes, and
// it is why callers write `picked.size === 0 || picked.has(x)`.
//
// The rows are plain <label>s rather than DropdownMenuItem: a menu item closes
// the menu on select, and ticking three stages one at a time would mean
// reopening the menu twice.
// ============================================================

export interface FilterOption {
  value: string;
  label: string;
  /** Dot colour, for the options that already have one (status, stage, division). */
  color?: string;
  /** Shown right-aligned. Useful when the count is part of the decision. */
  count?: number;
  /** Rendered in place of the colour dot. */
  icon?: React.ReactNode;
  /** Styles the row as an "everything else" bucket (Tanpa PIC, Tanpa divisi). */
  muted?: boolean;
}

/** Add or remove one value, returning a NEW set (state must not be mutated). */
export function toggleFilterValue(picked: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(picked);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function FilterMultiSelect({
  label,
  allLabel,
  unit,
  icon,
  options,
  picked,
  onChange,
  align = "start",
  className,
  emptyText,
}: {
  /** Small caption above the value, e.g. "Status". */
  label: string;
  /** What the trigger reads when nothing is ticked, e.g. "Semua Status". */
  allLabel: string;
  /** Noun used when several are ticked, e.g. "3 status". Defaults to `label`. */
  unit?: string;
  icon?: React.ReactNode;
  options: FilterOption[];
  picked: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  align?: "start" | "end";
  className?: string;
  /** Shown when there is nothing to tick at all. */
  emptyText?: string;
}) {
  const t = useT();
  const count = picked.size;
  const only = count === 1 ? options.find((o) => picked.has(o.value)) : undefined;
  const value =
    count === 0 ? allLabel : only ? only.label : `${count} ${(unit ?? label).toLowerCase()}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-left shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
          count > 0 && "border-primary/40 bg-primary/5",
          className,
        )}
      >
        {icon && (
          <span className="flex aspect-square size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </span>
        )}
        <div className="min-w-0 leading-tight">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="max-w-[150px] truncate text-xs font-semibold">{value}</div>
        </div>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="max-h-80 w-64 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          {label}
          {count > 0 && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" /> {t("Bersihkan")}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {options.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {emptyText ?? t("Belum ada pilihan")}
          </p>
        )}

        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted"
          >
            <Checkbox
              checked={picked.has(o.value)}
              onCheckedChange={() => onChange(toggleFilterValue(picked, o.value))}
            />
            {o.icon ?? (o.color && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />)}
            <span className={cn("min-w-0 flex-1 truncate", o.muted && "italic text-muted-foreground")}>
              {o.label}
            </span>
            {o.count !== undefined && (
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{o.count}</span>
            )}
          </label>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
