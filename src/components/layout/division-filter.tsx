"use client";
import * as React from "react";
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react";
import { setActiveDivision } from "@/lib/actions/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Division } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

export function DivisionFilter({ divisions, active }: { divisions: Division[]; active: string }) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const current = divisions.find((d) => d.key === active);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-left shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
          pending && "opacity-60",
        )}
      >
        <span
          className="flex size-6 items-center justify-center rounded-md text-white"
          style={{ backgroundColor: current?.color ?? "var(--muted-foreground)" }}
        >
          {current ? (
            <span className="text-[9px] font-bold">{current.short}</span>
          ) : (
            <LayoutGrid className="size-3.5" />
          )}
        </span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("Fokus divisi")}</div>
          <div className="truncate text-xs font-semibold">{current?.name ?? t("Semua Divisi")}</div>
        </div>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{t("Fokus ke divisi")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => start(() => setActiveDivision("all"))} className="gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-muted text-muted-foreground">
            <LayoutGrid className="size-3" />
          </span>
          <span className="flex-1">{t("Semua Divisi")}</span>
          {active === "all" && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>
        {divisions.map((d) => (
          <DropdownMenuItem key={d.key} onSelect={() => start(() => setActiveDivision(d.key))} className="gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="flex-1">{d.name}</span>
            {active === d.key && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
