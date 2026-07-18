"use client";
import * as React from "react";
import { Check, ChevronsUpDown, CalendarRange } from "lucide-react";
import { setActiveEvent } from "@/lib/actions/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { OVEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<OVEvent["status"], { label: string; variant: "success" | "warning" | "info" }> = {
  active: { label: "Aktif", variant: "success" },
  planning: { label: "Rencana", variant: "warning" },
  done: { label: "Selesai", variant: "info" },
};

export function EventSwitcher({ events, activeId }: { events: OVEvent[]; activeId: string }) {
  const [pending, start] = React.useTransition();
  const active = events.find((e) => e.id === activeId) ?? events[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-1.5 text-left shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
          pending && "opacity-60",
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <CalendarRange className="size-4" />
        </span>
        <div className="hidden min-w-0 leading-tight md:block">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Ormawa Visit
          </div>
          <div className="truncate text-xs font-semibold">{active?.title}</div>
        </div>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>Pilih Ormawa Visit</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {events.map((e) => {
          const st = STATUS_LABEL[e.status];
          return (
            <DropdownMenuItem
              key={e.id}
              onSelect={() => start(() => setActiveEvent(e.id))}
              className="gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {e.title}
                  {e.id === active?.id && <Check className="size-3.5 text-primary" />}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {e.cabinet} · {e.code}
                </div>
              </div>
              <Badge variant={st.variant}>{st.label}</Badge>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
