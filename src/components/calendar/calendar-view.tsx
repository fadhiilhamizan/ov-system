"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Star, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog";
import { StatusDot } from "@/components/status-badge";
import { DivisionBadge } from "@/components/division-badge";
import { EmptyState } from "@/components/ui/empty";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { AppUser, Division, OVEvent, Task } from "@/lib/types";

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
  events,
  event,
  activeEventId,
  user,
  initialMonth,
}: {
  tasks: Task[];
  divisions: Division[];
  events: OVEvent[];
  event: OVEvent;
  activeEventId: string;
  user: AppUser;
  initialMonth: string; // yyyy-mm
}) {
  const t = useT();
  const divMap = new Map(divisions.map((d) => [d.key, d]));
  const evMap = new Map(events.map((e) => [e.id, e]));
  const canAdd = can.manageTasks(user);
  const [ref, setRef] = React.useState(() => {
    const [y, m] = initialMonth.split("-").map(Number);
    return new Date(y, m - 1, 1);
  });
  const [selected, setSelected] = React.useState<Date | null>(null);
  const todayStr = ymd(new Date());

  const byDate = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.end_date) continue;
      if (!map.has(t.end_date)) map.set(t.end_date, []);
      map.get(t.end_date)!.push(t);
    }
    return map;
  }, [tasks]);

  const year = ref.getFullYear();
  const month = ref.getMonth();
  const gridStart = new Date(year, month, 1 - new Date(year, month, 1).getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));

  const selKey = selected ? ymd(selected) : "";
  const selTasks = selected ? byDate.get(selKey) ?? [] : [];

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            <h3 className="text-base font-semibold">{t(MONTHS[month])} {year}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setRef(new Date())} aria-keyshortcuts="T">{t("Hari ini")}</Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setRef(new Date(year, month - 1, 1))} aria-label={t("Bulan sebelumnya")} aria-keyshortcuts="Shift+ArrowLeft"><ChevronLeft /></Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setRef(new Date(year, month + 1, 1))} aria-label={t("Bulan berikutnya")} aria-keyshortcuts="Shift+ArrowRight"><ChevronRight /></Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[11px] font-medium text-muted-foreground">
          {DOW.map((d) => <div key={d} className="py-2">{t(d)}</div>)}
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
                role="button"
                tabIndex={0}
                onClick={() => setSelected(day)}
                aria-label={`${day.getDate()} ${t(MONTHS[day.getMonth()])}${dayTasks.length ? `, ${dayTasks.length} ${t("tugas")}` : ""}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(day); return; }
                  // Arrow keys walk the month grid like a date picker.
                  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
                  if (step === undefined) return;
                  const cells = e.currentTarget.parentElement?.children;
                  const next = cells?.[i + step] as HTMLElement | undefined;
                  if (next) { e.preventDefault(); next.focus(); }
                }}
                className={cn(
                  "group relative min-h-[60px] cursor-pointer border-b border-r border-border p-1 text-left transition hover:bg-muted/40 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring last:border-r-0 sm:min-h-[92px] sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/20 text-muted-foreground/50",
                  isEvent && "bg-accent/40",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs font-medium", isToday && "bg-primary text-primary-foreground")}>
                    {day.getDate()}
                  </span>
                  {isEvent && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                </div>
                {canAdd && (
                  <button
                    type="button"
                    aria-label={t("Tambah tugas di tanggal ini")}
                    title={t("Tambah tugas di tanggal ini")}
                    onClick={(e) => { e.stopPropagation(); setSelected(day); }}
                    className="absolute right-1 top-1 hidden size-5 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition hover:brightness-110 group-hover:flex focus:flex"
                  >
                    <Plus className="size-3.5" />
                  </button>
                )}
                {/* Phones: a row of coloured dots instead of titles that would be
                    cut to one letter. The day dialog lists them in full. */}
                {dayTasks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-0.5 px-0.5 sm:hidden">
                    {dayTasks.slice(0, 4).map((tk) => (
                      <span key={tk.id} className="size-1.5 rounded-full" style={{ backgroundColor: divMap.get(tk.division)?.color ?? "#888" }} />
                    ))}
                    {dayTasks.length > 4 && <span className="text-[9px] leading-none text-muted-foreground">+{dayTasks.length - 4}</span>}
                  </div>
                )}
                <div className="hidden space-y-1 sm:block">
                  {isEvent && (
                    <div className="truncate rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">🎉 {t("Hari-H")}</div>
                  )}
                  {dayTasks.slice(0, 3).map((t) => {
                    const div = divMap.get(t.division);
                    return (
                      <div key={t.id} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]"
                        style={{ backgroundColor: `color-mix(in srgb, ${div?.color ?? "#888"} 12%, transparent)` }}>
                        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: div?.color }} />
                        <span className="truncate">{t.title}</span>
                      </div>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <span className="px-1 text-[10px] font-medium text-muted-foreground">+{dayTasks.length - 3} {t("lagi")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Day detail dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selected && `${t(DOW[selected.getDay()])}, ${selected.getDate()} ${t(MONTHS[selected.getMonth()])} ${selected.getFullYear()}`}
            </DialogTitle>
          </DialogHeader>

          {selected && event.event_date === selKey && (
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
              🎉 {t("Hari pelaksanaan")} {event.title}
            </div>
          )}

          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {selTasks.length ? (
              selTasks.map((t) => {
                const div = divMap.get(t.division);
                return (
                  <TaskDetailDialog key={t.id} task={t} division={div} event={evMap.get(t.event_id)} user={user}>
                    <button className="flex w-full items-start gap-2.5 rounded-lg border border-border p-2.5 text-left transition hover:bg-muted/50">
                      <StatusDot status={t.status} className="mt-1.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t.title}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {div && <DivisionBadge division={div} />}
                          {t.pic && <span className="truncate text-[11px] text-muted-foreground">{t.pic}</span>}
                        </div>
                      </div>
                    </button>
                  </TaskDetailDialog>
                );
              })
            ) : (
              <EmptyState className="py-8" icon={<CalendarDays />} title={t("Tidak ada deadline")} description={t("Belum ada tugas dengan deadline di hari ini.")} />
            )}
          </div>

          {canAdd && selected && (
            <TaskFormDialog
              mode="create"
              divisions={divisions}
              events={events}
              activeEventId={activeEventId}
              defaultEndDate={selKey}
              user={user}
              trigger={
                <DialogTrigger asChild>
                  <Button className="w-full"><Plus className="size-4" /> {t("Tambah tugas di tanggal ini")}</Button>
                </DialogTrigger>
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
