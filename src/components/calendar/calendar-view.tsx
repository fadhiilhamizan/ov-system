"use client";
import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, CalendarDays, Star, Plus, Flag, Clock, LayoutGrid, ListOrdered,
  CalendarRange, Columns4, CalendarClock, CalendarSearch, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog";
import { StatusDot } from "@/components/status-badge";
import { DivisionBadge } from "@/components/division-badge";
import { EmptyState } from "@/components/ui/empty";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import {
  CAL_VIEWS, DOW_LONG, DOW_SHORT, MONTHS, activeOn, addDays, deadlinesByDate, hourRange, layoutTimed,
  parseYmd, rangeTitle, step, viewDays, ymd, type CalView,
} from "@/lib/calendar";
import type { AppUser, Division, OVEvent, RundownItem, Task } from "@/lib/types";

// ============================================================
// The calendar, in six views: Sehari, 4 Hari, Seminggu, Sebulan, Setahun, Jadwal.
//
// What it shows:
//   - task DEADLINES (every view),
//   - task RANGES, start to deadline, as all-day bars (day / 4 days / week),
//   - the Hari-H itself, and on that day the RUNDOWN sessions placed by the
//     clock on a time grid, so the event day reads like a real schedule.
//
// The view and the date live in the URL (?view=week&date=2026-09-20), written
// with history.replaceState (no server round trip), so a reload or a shared
// link opens the same place. The maths is in lib/calendar.ts (tested).
// ============================================================

const VIEW_META: Record<CalView, { label: string; icon: React.ReactNode }> = {
  day: { label: "Sehari", icon: <CalendarClock className="size-4" /> },
  "4day": { label: "4 Hari", icon: <Columns4 className="size-4" /> },
  week: { label: "Seminggu", icon: <CalendarRange className="size-4" /> },
  month: { label: "Sebulan", icon: <LayoutGrid className="size-4" /> },
  year: { label: "Setahun", icon: <CalendarSearch className="size-4" /> },
  schedule: { label: "Jadwal", icon: <ListOrdered className="size-4" /> },
};

const HOUR_PX = 48;

/** The current minute, client-only (null on the server, so hydration matches). */
const clock = {
  value: null as number | null,
  listeners: new Set<() => void>(),
  timer: null as ReturnType<typeof setInterval> | null,
};
function nowMinute() {
  return Math.floor(Date.now() / 60_000);
}
function subscribeClock(cb: () => void) {
  clock.listeners.add(cb);
  if (!clock.timer) {
    clock.value = nowMinute();
    clock.timer = setInterval(() => {
      clock.value = nowMinute();
      clock.listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    clock.listeners.delete(cb);
    if (!clock.listeners.size && clock.timer) { clearInterval(clock.timer); clock.timer = null; }
  };
}
function useNow(): Date | null {
  const m = React.useSyncExternalStore(subscribeClock, () => clock.value ?? nowMinute(), () => null);
  return m === null ? null : new Date(m * 60_000);
}

type DayInfo = {
  deadlines: Task[];
  active: Task[];
  isEvent: boolean;
};

export function CalendarView({
  tasks,
  divisions,
  events,
  event,
  rundown = [],
  activeEventId,
  user,
  initialView = "month",
  initialDate,
}: {
  tasks: Task[];
  divisions: Division[];
  events: OVEvent[];
  event: OVEvent;
  /** The edition's rundown, placed on the time grid of its Hari-H. */
  rundown?: RundownItem[];
  activeEventId: string;
  user: AppUser;
  initialView?: CalView;
  /** yyyy-mm-dd the calendar opens on. */
  initialDate: string;
}) {
  const t = useT();
  const canAdd = can.manageTasks(user);
  const [view, setView] = React.useState<CalView>(initialView);
  const [ref, setRef] = React.useState<Date>(() => parseYmd(initialDate) ?? new Date());
  const [selected, setSelected] = React.useState<Date | null>(null);
  const [divFocus, setDivFocus] = React.useState<Set<string>>(new Set());
  const now = useNow();
  const todayStr = now ? ymd(now) : "";

  // Keep the URL in step, without a navigation.
  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    url.searchParams.set("date", ymd(ref));
    window.history.replaceState(window.history.state, "", url);
  }, [view, ref]);

  const divMap = React.useMemo(() => new Map(divisions.map((d) => [d.key, d])), [divisions]);
  const evMap = React.useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const shown = React.useMemo(
    () => (divFocus.size ? tasks.filter((x) => divFocus.has(x.division)) : tasks),
    [tasks, divFocus],
  );
  const byDeadline = React.useMemo(() => deadlinesByDate(shown), [shown]);
  const blocks = React.useMemo(() => layoutTimed(rundown), [rundown]);
  const info = React.useCallback(
    (date: string): DayInfo => ({
      deadlines: byDeadline.get(date) ?? [],
      active: activeOn(shown, date),
      isEvent: event.event_date === date,
    }),
    [byDeadline, shown, event.event_date],
  );

  const days = React.useMemo(() => viewDays(view, ref), [view, ref]);

  function go(dir: 1 | -1) { setRef((r) => step(view, r, dir)); }
  function openDay(d: Date) { setRef(d); setView("day"); }

  const divOptions = divisions
    .filter((d) => tasks.some((x) => x.division === d.key))
    .map((d) => ({ value: d.key, label: d.name, color: d.color }));

  const renderTask = (task: Task, compact = false) => {
    const div = divMap.get(task.division);
    return (
      <TaskDetailDialog key={task.id} task={task} division={div} event={evMap.get(task.event_id)} user={user}>
        <button
          type="button"
          className={cn(
            "flex w-full min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            compact && "py-px text-[10px]",
          )}
          style={{ backgroundColor: `color-mix(in srgb, ${div?.color ?? "#888"} 14%, transparent)` }}
          title={task.title}
        >
          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: div?.color ?? "#888" }} />
          <span className="truncate">{task.title}</span>
        </button>
      </TaskDetailDialog>
    );
  };

  return (
    <>
      <Card className="overflow-hidden">
        {/* ---- toolbar ---- */}
        <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setRef(now ?? new Date())} aria-keyshortcuts="T">{t("Hari ini")}</Button>
            <Button variant="ghost" size="icon-sm" onClick={() => go(-1)} aria-label={t("Sebelumnya")} aria-keyshortcuts="Shift+ArrowLeft"><ChevronLeft /></Button>
            <Button variant="ghost" size="icon-sm" onClick={() => go(1)} aria-label={t("Berikutnya")} aria-keyshortcuts="Shift+ArrowRight"><ChevronRight /></Button>
            <h3 className="ml-1 min-w-0 text-sm font-semibold leading-tight sm:text-base" aria-live="polite">{rangeTitle(view, ref, t)}</h3>
          </div>
          <div className="toolbar-scroll flex items-center gap-2 sm:flex-wrap">
            {divOptions.length > 1 && (
              <FilterMultiSelect
                label={t("Divisi")}
                allLabel={t("Semua Divisi")}
                unit={t("divisi")}
                options={divOptions}
                picked={divFocus}
                onChange={setDivFocus}
                align="end"
              />
            )}
            <div className="inline-flex shrink-0 rounded-lg border border-border bg-card p-0.5" role="group" aria-label={t("Tampilan")}>
              {CAL_VIEWS.map((v, i) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  aria-label={t(VIEW_META[v].label)}
                  aria-keyshortcuts={String(i + 1)}
                  data-shortcut-label={`${t("Tampilan")} ${t(VIEW_META[v].label)}`}
                  title={t(VIEW_META[v].label)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition",
                    view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {VIEW_META[v].icon}
                  <span className="hidden xl:inline">{t(VIEW_META[v].label)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === "month" && (
          <MonthGrid days={days} month={ref.getMonth()} todayStr={todayStr} info={info} divMap={divMap} onPick={setSelected} canAdd={canAdd} />
        )}
        {(view === "day" || view === "4day" || view === "week") && (
          <TimeGrid
            days={days}
            todayStr={todayStr}
            now={now}
            info={info}
            event={event}
            blocks={blocks}
            renderTask={renderTask}
            onOpenDay={view === "day" ? undefined : openDay}
          />
        )}
        {view === "year" && (
          <YearGrid year={ref.getFullYear()} todayStr={todayStr} info={info} onPick={openDay} />
        )}
        {view === "schedule" && (
          <Agenda days={days} info={info} event={event} blocks={blocks} divMap={divMap} renderTask={renderTask} todayStr={todayStr} />
        )}
      </Card>

      {/* Day detail dialog (month view) */}
      <DayDialog
        selected={selected}
        onClose={() => setSelected(null)}
        info={info}
        event={event}
        divMap={divMap}
        evMap={evMap}
        user={user}
        canAdd={canAdd}
        divisions={divisions}
        events={events}
        activeEventId={activeEventId}
        onOpenDay={(d) => { setSelected(null); openDay(d); }}
      />
    </>
  );
}

// ---------------- Bulan ----------------

function MonthGrid({
  days, month, todayStr, info, divMap, onPick, canAdd,
}: {
  days: Date[];
  month: number;
  todayStr: string;
  info: (date: string) => DayInfo;
  divMap: Map<string, Division>;
  onPick: (d: Date) => void;
  canAdd: boolean;
}) {
  const t = useT();
  return (
    <>
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[11px] font-medium text-muted-foreground">
        {DOW_SHORT.map((d) => <div key={d} className="py-2">{t(d)}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === month;
          const key = ymd(day);
          const { deadlines, isEvent } = info(key);
          const isToday = key === todayStr;
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onPick(day)}
              aria-label={`${day.getDate()} ${t(MONTHS[day.getMonth()])}${deadlines.length ? `, ${deadlines.length} ${t("tugas")}` : ""}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(day); return; }
                // Arrow keys walk the month grid like a date picker.
                const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
                if (delta === undefined) return;
                const next = e.currentTarget.parentElement?.children?.[i + delta] as HTMLElement | undefined;
                if (next) { e.preventDefault(); next.focus(); }
              }}
              className={cn(
                "group relative min-h-[60px] cursor-pointer border-b border-r border-border p-1 text-left transition hover:bg-muted/40 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-[104px] sm:p-1.5 3xl:min-h-[136px] [&:nth-child(7n)]:border-r-0",
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
                <span
                  aria-hidden
                  className="absolute right-1 top-1 hidden size-5 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm group-hover:flex"
                >
                  <Plus className="size-3.5" />
                </span>
              )}
              {/* Phones: coloured dots; the day dialog lists them in full. */}
              {deadlines.length > 0 && (
                <div className="flex flex-wrap items-center gap-0.5 px-0.5 sm:hidden">
                  {deadlines.slice(0, 4).map((tk) => (
                    <span key={tk.id} className="size-1.5 rounded-full" style={{ backgroundColor: divMap.get(tk.division)?.color ?? "#888" }} />
                  ))}
                  {deadlines.length > 4 && <span className="text-[9px] leading-none text-muted-foreground">+{deadlines.length - 4}</span>}
                </div>
              )}
              <div className="hidden space-y-1 sm:block">
                {isEvent && (
                  <div className="truncate rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">🎉 {t("Hari-H")}</div>
                )}
                {deadlines.slice(0, 3).map((tk) => {
                  const div = divMap.get(tk.division);
                  return (
                    <div key={tk.id} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]"
                      style={{ backgroundColor: `color-mix(in srgb, ${div?.color ?? "#888"} 12%, transparent)` }}>
                      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: div?.color }} />
                      <span className="truncate">{tk.title}</span>
                    </div>
                  );
                })}
                {deadlines.length > 3 && (
                  <span className="px-1 text-[10px] font-medium text-muted-foreground">+{deadlines.length - 3} {t("lagi")}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------- Hari / 4 Hari / Minggu ----------------

function TimeGrid({
  days, todayStr, now, info, event, blocks, renderTask, onOpenDay,
}: {
  days: Date[];
  todayStr: string;
  now: Date | null;
  info: (date: string) => DayInfo;
  event: OVEvent;
  blocks: ReturnType<typeof layoutTimed<RundownItem>>;
  renderTask: (task: Task, compact?: boolean) => React.ReactNode;
  onOpenDay?: (d: Date) => void;
}) {
  const t = useT();
  const hasEventDay = days.some((d) => ymd(d) === event.event_date);
  const shownBlocks = hasEventDay ? blocks : [];
  const [from, to] = hourRange(shownBlocks);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const scroller = React.useRef<HTMLDivElement>(null);
  const cols = `3.25rem repeat(${days.length}, minmax(0, 1fr))`;
  const wide = days.length === 7;

  // Open the grid at the first session (or 08.00), not at midnight.
  const firstStart = shownBlocks.length ? Math.min(...shownBlocks.map((b) => b.start)) : 8 * 60;
  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = Math.max(0, ((firstStart - from * 60) / 60) * HOUR_PX - 24);
  }, [firstStart, from, days]);

  const MAX_ALLDAY = 4;
  return (
    <div className={cn(wide && "overflow-x-auto")}>
      <div className={cn(wide && "min-w-[720px]")}>
        {/* Day headers */}
        <div className="grid border-b border-border bg-muted/30" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => {
            const key = ymd(d);
            const isToday = key === todayStr;
            const head = (
              <>
                <span className="text-[11px] text-muted-foreground">{t(DOW_SHORT[d.getDay()])}</span>
                <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold", isToday && "bg-primary text-primary-foreground")}>
                  {d.getDate()}
                </span>
              </>
            );
            return (
              <div key={key} className="border-l border-border py-1.5 text-center">
                {onOpenDay ? (
                  <button type="button" onClick={() => onOpenDay(d)} className="inline-flex flex-col items-center rounded-lg px-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${t(DOW_LONG[d.getDay()])}, ${d.getDate()} ${t(MONTHS[d.getMonth()])}`}>
                    {head}
                  </button>
                ) : (
                  <div className="inline-flex flex-col items-center">{head}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* All-day lane: Hari-H, tasks running that day, deadlines flagged */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
          <div className="px-1 py-1.5 text-right text-[10px] leading-tight text-muted-foreground">{t("Sepanjang hari")}</div>
          {days.map((d) => {
            const key = ymd(d);
            const { active, deadlines, isEvent } = info(key);
            const dueIds = new Set(deadlines.map((x) => x.id));
            const list = [...active].sort((a, b) => Number(dueIds.has(b.id)) - Number(dueIds.has(a.id)));
            return (
              <div key={key} className={cn("min-h-[44px] space-y-0.5 border-l border-border p-1", isEvent && "bg-accent/40")}>
                {isEvent && (
                  <div className="truncate rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">🎉 {t("Hari-H")}</div>
                )}
                {list.slice(0, MAX_ALLDAY).map((task) => (
                  <div key={task.id} className="flex items-center gap-0.5">
                    {dueIds.has(task.id) && <Flag className="size-3 shrink-0 text-danger" aria-label={t("Deadline")} />}
                    <div className="min-w-0 flex-1">{renderTask(task, true)}</div>
                  </div>
                ))}
                {list.length > MAX_ALLDAY && (
                  onOpenDay
                    ? <button type="button" onClick={() => onOpenDay(d)} className="px-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">+{list.length - MAX_ALLDAY} {t("lagi")}</button>
                    : <span className="px-1 text-[10px] font-medium text-muted-foreground">+{list.length - MAX_ALLDAY} {t("lagi")}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Hour grid with the rundown on Hari-H */}
        <div ref={scroller} className="max-h-[65vh] overflow-y-auto overscroll-contain">
          <div className="relative grid" style={{ gridTemplateColumns: cols }}>
            <div>
              {hours.map((h) => (
                <div key={h} className="relative pr-1.5 text-right text-[10px] text-muted-foreground" style={{ height: HOUR_PX }}>
                  <span className="relative -top-1.5">{String(h).padStart(2, "0")}.00</span>
                </div>
              ))}
            </div>
            {days.map((d) => {
              const key = ymd(d);
              const isEventDay = key === event.event_date;
              const showNow = now && key === todayStr;
              const nowMin = now ? now.getHours() * 60 + now.getMinutes() : 0;
              return (
                <div key={key} className="relative border-l border-border">
                  {hours.map((h) => <div key={h} className="border-b border-border/50" style={{ height: HOUR_PX }} />)}
                  {isEventDay && shownBlocks.map((b) => (
                    <RundownBlock key={b.item.id} block={b} from={from} />
                  ))}
                  {showNow && nowMin >= from * 60 && nowMin <= to * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((nowMin - from * 60) / 60) * HOUR_PX }}>
                      <span className="-ml-1 size-2 rounded-full bg-danger" />
                      <span className="h-px flex-1 bg-danger" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {!hasEventDay && (
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            {t("Sesi rundown tampil per jam pada Hari-H.")}{" "}
            {event.event_date && <>{t("Hari-H edisi ini")}: {formatDate(parseYmd(event.event_date), t)}.</>}
          </p>
        )}
      </div>
    </div>
  );
}

function formatDate(d: Date | null, t: (s: string) => string) {
  if (!d) return "";
  return `${t(DOW_LONG[d.getDay()])}, ${d.getDate()} ${t(MONTHS[d.getMonth()])} ${d.getFullYear()}`;
}

function RundownBlock({ block, from }: { block: ReturnType<typeof layoutTimed<RundownItem>>[number]; from: number }) {
  const t = useT();
  const { item, start, end, lane, lanes } = block;
  const top = ((start - from * 60) / 60) * HOUR_PX;
  const height = Math.max(18, ((end - start) / 60) * HOUR_PX - 2);
  const width = 100 / lanes;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="absolute overflow-hidden rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-left text-[11px] leading-tight text-foreground shadow-sm transition hover:bg-primary/20 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ top, height, left: `calc(${lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
          aria-label={`${item.time_start}${item.time_end ? `-${item.time_end}` : ""} ${item.activity || t("Kegiatan")}`}
        >
          <span className="block truncate font-medium">{item.activity || t("Kegiatan")}</span>
          {height > 30 && <span className="block truncate text-[10px] text-muted-foreground">{item.time_start}{item.time_end ? ` - ${item.time_end}` : ""}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2 p-3 text-sm">
        <p className="font-semibold">{item.activity || t("Kegiatan")}</p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> {item.time_start}{item.time_end ? ` - ${item.time_end}` : ""}{item.duration ? ` (${item.duration})` : ""}
        </p>
        {item.mc && <p className="text-xs"><span className="text-muted-foreground">MC: </span>{item.mc}</p>}
        {item.keterangan && <p className="whitespace-pre-line text-xs text-muted-foreground">{item.keterangan}</p>}
        <Link href="/rundown" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {t("Buka Rundown")} <ExternalLink className="size-3" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}

// ---------------- Tahun ----------------

function YearGrid({
  year, todayStr, info, onPick,
}: {
  year: number;
  todayStr: string;
  info: (date: string) => DayInfo;
  onPick: (d: Date) => void;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-6">
      {MONTHS.map((name, m) => {
        const first = new Date(year, m, 1);
        const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i - first.getDay()));
        let total = 0;
        return (
          <section key={name} aria-label={`${t(name)} ${year}`} className="rounded-lg border border-border p-2.5">
            <h4 className="mb-1.5 text-sm font-semibold">{t(name)}</h4>
            <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">
              {DOW_SHORT.map((d) => <span key={d}>{t(d).slice(0, 2)}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {cells.map((d) => {
                const key = ymd(d);
                const inMonth = d.getMonth() === m;
                if (!inMonth) return <span key={key} />;
                const { deadlines, isEvent } = info(key);
                total += deadlines.length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onPick(d)}
                    aria-label={`${d.getDate()} ${t(name)}${deadlines.length ? `, ${deadlines.length} ${t("tugas")}` : ""}`}
                    className={cn(
                      "relative mx-auto flex size-7 items-center justify-center rounded-full text-[11px] transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      key === todayStr && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                      isEvent && key !== todayStr && "bg-amber-100 font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
                    )}
                  >
                    {d.getDate()}
                    {deadlines.length > 0 && (
                      <span
                        className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"
                        style={{ opacity: Math.min(1, 0.4 + deadlines.length * 0.2) }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">{total ? `${total} ${t("deadline")}` : " "}</p>
          </section>
        );
      })}
    </div>
  );
}

// ---------------- Jadwal ----------------

function Agenda({
  days, info, event, blocks, divMap, renderTask, todayStr,
}: {
  days: Date[];
  info: (date: string) => DayInfo;
  event: OVEvent;
  blocks: ReturnType<typeof layoutTimed<RundownItem>>;
  divMap: Map<string, Division>;
  renderTask: (task: Task, compact?: boolean) => React.ReactNode;
  todayStr: string;
}) {
  const t = useT();
  const rows = days
    .map((d) => {
      const key = ymd(d);
      const i = info(key);
      const starts = i.active.filter((x) => x.start_date === key && x.end_date !== key);
      const isEvent = i.isEvent;
      return { d, key, deadlines: i.deadlines, starts, isEvent, sessions: isEvent ? blocks : [] };
    })
    .filter((r) => r.deadlines.length || r.starts.length || r.isEvent);

  if (!rows.length) {
    return <EmptyState className="py-12" icon={<CalendarDays />} title={t("Tidak ada jadwal")} description={t("Belum ada deadline, tugas yang dimulai, atau Hari-H di bulan ini.")} />;
  }
  return (
    <ol className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.key} className={cn("grid grid-cols-[4.5rem_1fr] gap-3 px-3 py-3 sm:grid-cols-[7rem_1fr] sm:px-4", r.isEvent && "bg-accent/30")}>
          <div className="pt-0.5">
            <div className={cn("text-2xl font-bold leading-none tabular-nums", r.key === todayStr && "text-primary")}>{r.d.getDate()}</div>
            <div className="text-[11px] text-muted-foreground">{t(DOW_SHORT[r.d.getDay()])}, {t(MONTHS[r.d.getMonth()]).slice(0, 3)}</div>
          </div>
          <div className="min-w-0 space-y-1.5">
            {r.isEvent && (
              <p className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold text-primary">
                🎉 {t("Hari pelaksanaan")} {event.title}
              </p>
            )}
            {r.sessions.map((b) => (
              <div key={b.item.id} className="flex items-baseline gap-2 text-xs">
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{b.item.time_start}{b.item.time_end ? ` - ${b.item.time_end}` : ""}</span>
                <span className="min-w-0 truncate font-medium">{b.item.activity || t("Kegiatan")}</span>
              </div>
            ))}
            {r.deadlines.map((task) => (
              <div key={`d-${task.id}`} className="flex items-center gap-2">
                <span className="inline-flex w-24 shrink-0 items-center gap-1 text-[11px] font-medium text-danger"><Flag className="size-3" /> {t("Deadline")}</span>
                <div className="min-w-0 flex-1">{renderTask(task)}</div>
                <StatusDot status={task.status} />
              </div>
            ))}
            {r.starts.map((task) => (
              <div key={`s-${task.id}`} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{t("Mulai")}</span>
                <div className="min-w-0 flex-1">{renderTask(task)}</div>
                {divMap.get(task.division) && <span className="hidden sm:inline"><DivisionBadge division={divMap.get(task.division)!} /></span>}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------- day dialog (month view) ----------------

function DayDialog({
  selected, onClose, info, event, divMap, evMap, user, canAdd, divisions, events, activeEventId, onOpenDay,
}: {
  selected: Date | null;
  onClose: () => void;
  info: (date: string) => DayInfo;
  event: OVEvent;
  divMap: Map<string, Division>;
  evMap: Map<string, OVEvent>;
  user: AppUser;
  canAdd: boolean;
  divisions: Division[];
  events: OVEvent[];
  activeEventId: string;
  onOpenDay: (d: Date) => void;
}) {
  const t = useT();
  const key = selected ? ymd(selected) : "";
  const selTasks = selected ? info(key).deadlines : [];
  return (
    <Dialog open={!!selected} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatDate(selected, t)}</DialogTitle>
        </DialogHeader>

        {selected && event.event_date === key && (
          <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            🎉 {t("Hari pelaksanaan")} {event.title}
          </div>
        )}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {selTasks.length ? (
            selTasks.map((task) => {
              const div = divMap.get(task.division);
              return (
                <TaskDetailDialog key={task.id} task={task} division={div} event={evMap.get(task.event_id)} user={user}>
                  <button className="flex w-full items-start gap-2.5 rounded-lg border border-border p-2.5 text-left transition hover:bg-muted/50">
                    <StatusDot status={task.status} className="mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{task.title}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        {div && <DivisionBadge division={div} />}
                        {task.pic && <span className="truncate text-[11px] text-muted-foreground">{task.pic}</span>}
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

        <div className="flex flex-col gap-2 sm:flex-row">
          {selected && (
            <Button variant="outline" className="flex-1" onClick={() => onOpenDay(selected)}>
              <CalendarClock className="size-4" /> {t("Buka tampilan Sehari")}
            </Button>
          )}
          {canAdd && selected && (
            <TaskFormDialog
              mode="create"
              divisions={divisions}
              events={events}
              activeEventId={activeEventId}
              defaultEndDate={key}
              user={user}
              trigger={
                <DialogTrigger asChild>
                  <Button className="flex-1"><Plus className="size-4" /> {t("Tambah tugas di tanggal ini")}</Button>
                </DialogTrigger>
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
