"use client";
import * as React from "react";
import { ChevronsUpDown, Columns3, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { Division } from "@/lib/types";

/**
 * Choose which division columns the rundown shows.
 *
 * The rundown is the widest table in the app - one column per division - so on
 * a laptop or a phone most of it is off-screen. Ticking a couple of divisions
 * makes it readable without changing any data.
 *
 * `options` must already exclude divisions flagged `exclude_from_rundown`:
 * those never get a column, so offering them would do nothing.
 */
export function DivisionColumnFilter({
  options, focus, onChange,
}: {
  options: Division[];
  /** Ticked division keys. Empty = every column is shown. */
  focus: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const t = useT();

  function toggle(key: string) {
    const next = new Set(focus);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  const count = focus.size;
  const label =
    count === 0
      ? t("Semua Divisi")
      : count === 1
        ? options.find((d) => focus.has(d.key))?.name ?? `1 ${t("Divisi")}`
        : `${count} ${t("Divisi")}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-left shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
          count > 0 && "border-primary/40 bg-primary/5",
        )}
      >
        <span className="flex aspect-square size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Columns3 className="size-3.5" />
        </span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("Fokus divisi")}</div>
          <div className="max-w-[130px] truncate text-xs font-semibold">{label}</div>
        </div>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          {t("Kolom divisi")}
          {count > 0 && (
            <button
              onClick={() => onChange(new Set())}
              className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" /> {t("Tampilkan semua")}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {options.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {t("Tidak ada divisi yang diikutsertakan pada rundown.")}
          </p>
        ) : (
          options.map((d) => (
            // A label, not a DropdownMenuItem: menu items close on select, and
            // picking several divisions would mean reopening the menu each time.
            <label
              key={d.key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted"
            >
              <Checkbox checked={focus.has(d.key)} onCheckedChange={() => toggle(d.key)} />
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
            </label>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
