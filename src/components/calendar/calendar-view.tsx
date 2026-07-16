"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StatusDot } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { Division, OVEvent, Task } from "@/lib/types";

const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView({
  tasks,
  divisions,
  event,
  initialMonth,
}: {
  tasks: Task[];
  divisions: Division[];
  event: OVEvent;
  initialMonth: string; // yyyy-mm
}) {
  const divMap = new Map(divisions.map((d) => [d.key, d]));
  const [ref, setRef] = React.useState(() => {
    const [y, m] = initialMonth.split("-").map(Number);
    return new Date(y, m - 1, 1);
  });
  const todayStr = ymd(new Date());

  const byDate = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.end_date) continue;
      const k = t.end_date;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return map;
  }, [tasks]);

  const year = ref.getFullYear();
  const month = ref.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          <h3 className="text-base font-semibold">
            {MONTHS[month]} {year}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setRef(new Date())}>
            Hari ini
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setRef(new Date(year, month - 1, 1))}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setRef(new Date(year, month + 1, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[11px] font-medium text-muted-foreground">
        {DOW.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === month;
          const key = ymd(day);
          const dayTasks = byDate.get(key) ?? [];
          const isToday = key === todayStr;
          const isEvent = event.event_date === key;
          return (
            <div
              key={i}
              className={cn(
                "min-h-[92px] border-b border-r border-border p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-muted/20 text-muted-foreground/50",
                isEvent && "bg-accent/40",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
                {isEvent && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
              </div>
              <div className="space-y-1">
                {isEvent && (
                  <div className="truncate rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    🎉 Hari-H OV
                  </div>
                )}
                {dayTasks.slice(0, 3).map((t) => {
                  const div = divMap.get(t.division);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]"
                      style={{ backgroundColor: `color-mix(in srgb, ${div?.color ?? "#888"} 12%, transparent)` }}
                      title={t.title}
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: div?.color }} />
                      <span className="truncate">{t.title}</span>
                    </div>
                  );
                })}
                {dayTasks.length > 3 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-full rounded px-1 text-left text-[10px] font-medium text-muted-foreground hover:text-foreground">
                        +{dayTasks.length - 3} lagi
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64">
                      <p className="mb-2 text-xs font-semibold">Deadline {day.getDate()} {MONTHS[month]}</p>
                      <div className="space-y-1.5">
                        {dayTasks.map((t) => {
                          const div = divMap.get(t.division);
                          return (
                            <div key={t.id} className="flex items-start gap-2 text-xs">
                              <StatusDot status={t.status} className="mt-1" />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{t.title}</p>
                                <p className="text-[10px] text-muted-foreground">{div?.name}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
