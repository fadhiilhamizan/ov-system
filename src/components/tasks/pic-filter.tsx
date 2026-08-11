"use client";
import * as React from "react";
import { ChevronsUpDown, Users, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar } from "@/components/ui/avatar";
import { NO_PIC } from "@/lib/task-filters";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Focus the Work Breakdown on one or more PICs.
 *
 * Checkboxes rather than a single-select: "show me Ali's and Budi's tasks" is
 * the normal question, and the menu deliberately stays open while ticking so
 * several people can be chosen in one go.
 *
 * Values are stored lower-cased (plus the `NO_PIC` sentinel) because the PIC
 * column is free text — see `matchesPics`.
 */
export function PicFilter({
  options, picked, onChange, hasUnassigned,
}: {
  /** Distinct PIC names, already sorted. */
  options: string[];
  picked: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Only offer "Tanpa PIC" when some task actually has none. */
  hasUnassigned: boolean;
}) {
  const t = useT();

  function toggle(value: string) {
    const next = new Set(picked);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  const count = picked.size;
  const label =
    count === 0
      ? t("Semua PIC")
      : count === 1
        ? (picked.has(NO_PIC) ? t("Tanpa PIC") : options.find((o) => picked.has(o.toLowerCase())) ?? `1 ${t("PIC")}`)
        : `${count} ${t("PIC")}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-left shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
          count > 0 && "border-primary/40 bg-primary/5",
        )}
      >
        <span className="flex aspect-square size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Users className="size-3.5" />
        </span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("Fokus PIC")}</div>
          <div className="max-w-[130px] truncate text-xs font-semibold">{label}</div>
        </div>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          {t("Fokus ke PIC")}
          {count > 0 && (
            <button
              onClick={() => onChange(new Set())}
              className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" /> {t("Bersihkan")}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {options.length === 0 && !hasUnassigned && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">{t("Belum ada PIC")}</p>
        )}

        {options.map((name) => {
          const value = name.toLowerCase();
          return (
            // Not a DropdownMenuItem: those close on select, and ticking several
            // people one at a time would mean reopening the menu each time.
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted"
            >
              <Checkbox checked={picked.has(value)} onCheckedChange={() => toggle(value)} />
              <Avatar name={name} size={20} />
              <span className="min-w-0 flex-1 truncate">{name}</span>
            </label>
          );
        })}

        {hasUnassigned && (
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted">
            <Checkbox checked={picked.has(NO_PIC)} onCheckedChange={() => toggle(NO_PIC)} />
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">?</span>
            <span className="flex-1 italic text-muted-foreground">{t("Tanpa PIC")}</span>
          </label>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
