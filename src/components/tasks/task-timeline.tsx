"use client";
import * as React from "react";
import { CalendarRange } from "lucide-react";
import { TaskDetailDialog } from "./task-detail-dialog";
import { StatusDot } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDate } from "@/lib/format";
import { STATUS_META } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { AppUser, Division, OVEvent, Task } from "@/lib/types";

const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

const DAY = 86_400_000;
/** Width of the sticky task-name column. */
const LABEL_W = 240;
/** Horizontal pixels per day. Wide enough that a 1-day task is still visible. */
const PX_PER_DAY = 26;
/** Breathing room either side of the first/last task. */
const PAD_DAYS = 2;

/**
 * Where the floating date banner should sit: just under whatever chrome is
 * pinned to the top of the screen.
 *
 * Measured, never hardcoded. A fixed 64px (the topbar's own height) put the
 * banner *behind* the topbar as soon as anything pushed the header down — the
 * Demo strip, the archive strip, or the role-request strip. Reading the header's
 * real bottom edge handles every combination, including none of them.
 */
function chromeBottom(): number {
  if (typeof document === "undefined") return 72;
  const header = document.querySelector("header");
  const bottom = header?.getBoundingClientRect().bottom ?? 64;
  // Never negative: once scrolled, a sticky header's bottom is its height.
  return Math.max(0, bottom) + 8;
}

/** Midnight local time — timeline maths must be day-aligned, not time-of-day. */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The current date never changes mid-session, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};

/**
 * Local `YYYY-MM-DD`.
 *
 * NOT `toISOString().slice(0,10)`: that converts to UTC first, so local midnight
 * in UTC+7 becomes 17:00 the previous day and the readout is a day early.
 */
function localISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function TaskTimeline({
  tasks,
  divisions,
  events,
  user,
}: {
  tasks: Task[];
  divisions: Division[];
  events: OVEvent[];
  user: AppUser;
}) {
  const tr = useT();
  const divMap = React.useMemo(() => new Map(divisions.map((d) => [d.key, d])), [divisions]);
  const evMap = React.useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const dated = React.useMemo(
    () =>
      tasks
        .map((t) => {
          const s = t.start_date ?? t.end_date;
          const e = t.end_date ?? t.start_date;
          if (!s || !e) return null;
          // Guard against an end date that precedes the start date.
          const a = startOfDay(new Date(s).getTime());
          const b = startOfDay(new Date(e).getTime());
          return { task: t, start: Math.min(a, b), end: Math.max(a, b) };
        })
        .filter((x): x is { task: Task; start: number; end: number } => !!x)
        .sort((a, b) => a.start - b.start || a.end - b.end),
    [tasks],
  );

  const undated = React.useMemo(
    () => tasks.filter((t) => !t.start_date && !t.end_date),
    [tasks],
  );

  // --- hover state: a vertical guide line that follows the cursor ---
  // Two coordinates are kept for one cursor:
  //   x       — relative to the track's content box, positions the LINE and
  //             stays correct while the timeline is scrolled sideways.
  //   clientX — viewport coordinate, positions the floating date banner.
  // The banner has to be `position: fixed`, because `sticky` cannot escape the
  // `overflow-x-auto` wrapper (an element with overflow-x:auto is a scrollport
  // on BOTH axes, so a sticky child sticks to *it*, not to the page — and it
  // never scrolls vertically, so the banner would simply scroll away).
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = React.useState<number | null>(null);
  const [hoverClientX, setHoverClientX] = React.useState<number | null>(null);
  const [bannerTop, setBannerTop] = React.useState(72);

  const bounds = React.useMemo(() => {
    if (!dated.length) return null;
    const min = startOfDay(Math.min(...dated.map((d) => d.start))) - PAD_DAYS * DAY;
    const max = startOfDay(Math.max(...dated.map((d) => d.end))) + PAD_DAYS * DAY;
    const days = Math.max(1, Math.round((max - min) / DAY));
    return { min, max, days, width: days * PX_PER_DAY };
  }, [dated]);

  /**
   * One tick per day. The old axis only marked month boundaries, which left a
   * short range (anything inside a single month) with no date reference at all,
   * and drew the 1st-of-month tick at a NEGATIVE offset whenever it fell before
   * the range — that stray line to the left of the chart was the "left border"
   * bug. Every tick here is inside the track by construction.
   */
  const dayCols = React.useMemo(() => {
    if (!bounds) return [];
    const out: {
      x: number;
      day: number;
      isMonthStart: boolean;
      isWeekStart: boolean;
      monthLabel: string | null;
    }[] = [];
    for (let i = 0; i < bounds.days; i++) {
      const d = new Date(bounds.min + i * DAY);
      const isMonthStart = d.getDate() === 1;
      out.push({
        x: i * PX_PER_DAY,
        day: d.getDate(),
        isMonthStart,
        isWeekStart: d.getDay() === 1,
        // Label the first column too, so the month is always named even when the
        // range sits entirely inside one month.
        monthLabel:
          isMonthStart || i === 0
            ? `${tr(ID_MONTHS[d.getMonth()])} ${String(d.getFullYear()).slice(2)}`
            : null,
      });
    }
    return out;
  }, [bounds, tr]);

  // "Today" comes from useSyncExternalStore, not from render or an effect: the
  // clock is impure, and rendering it on the server would risk a hydration
  // mismatch across midnight. The server snapshot is null, so the marker simply
  // appears after hydration. getSnapshot is stable — it returns the same
  // millisecond value for the whole day.
  const today = React.useSyncExternalStore(
    subscribeNever,
    () => startOfDay(Date.now()),
    () => null,
  );

  const todayX = React.useMemo(() => {
    if (!bounds || today == null) return null;
    if (today < bounds.min || today > bounds.max) return null;
    return ((today - bounds.min) / DAY) * PX_PER_DAY;
  }, [bounds, today]);

  /**
   * Date under the cursor.
   *
   * `hoverX` is measured from the left edge of the row container, which INCLUDES
   * the sticky task-name column — so LABEL_W has to come off before converting
   * to days, or the readout lands ~9 days late. The subtraction is also correct
   * while scrolled horizontally: the chart always begins at content-x LABEL_W.
   */
  const hoverDate = React.useMemo(() => {
    if (hoverX == null || !bounds) return null;
    const dayIndex = Math.floor((hoverX - LABEL_W) / PX_PER_DAY);
    if (dayIndex < 0 || dayIndex >= bounds.days) return null;
    return new Date(bounds.min + dayIndex * DAY);
  }, [hoverX, bounds]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = trackRef.current;
    if (!el) return;
    // getBoundingClientRect already accounts for horizontal scrolling.
    setHoverX(e.clientX - el.getBoundingClientRect().left);
    setHoverClientX(e.clientX);
    // Re-measured on every move so the banner keeps clearing the header while
    // the page scrolls and the top strips slide away.
    setBannerTop(chromeBottom());
  }

  function onLeave() {
    setHoverX(null);
    setHoverClientX(null);
  }

  if (!dated.length || !bounds) {
    return (
      <EmptyState
        icon={<CalendarRange />}
        title={tr("Belum ada tugas berjadwal")}
        description={tr("Tambahkan tanggal mulai/deadline pada tugas untuk melihat timeline.")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Floating date readout for the cursor guide.
          `fixed`, and rendered outside the scroll container, for two reasons:
          it stays visible however far down the task list you have scrolled, and
          it escapes the `overflow-x-auto` wrapper that would otherwise clip and
          un-stick it. Parked just under the app topbar (h-16) at a lower
          z-index, so it passes behind the topbar rather than over it. */}
      {hoverClientX != null && hoverDate != null && (
        <div
          className="pointer-events-none fixed z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-semibold text-background shadow-lg"
          style={{ left: hoverClientX, top: bannerTop }}
        >
          {formatDate(localISODate(hoverDate), { long: true })}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* One scroll container holds BOTH the axis and the rows, so a month
            label can never drift out of line with the bars underneath it —
            they share the same origin and the same pixel scale. */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: LABEL_W + bounds.width }}>
            {/* ---- axis: month row on top, day numbers underneath ---- */}
            <div className="flex border-b border-border">
              <div
                className="sticky left-0 z-20 flex shrink-0 items-end border-r border-border bg-card px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ width: LABEL_W }}
              >
                {tr("Tugas")}
              </div>
              <div className="relative h-11" style={{ width: bounds.width }}>
                {dayCols.map((d) => (
                  <React.Fragment key={d.x}>
                    {d.monthLabel && (
                      <span
                        className="absolute top-1 whitespace-nowrap px-1 text-[10px] font-semibold text-foreground"
                        style={{ left: d.x }}
                      >
                        {d.monthLabel}
                      </span>
                    )}
                    <span
                      className={cn(
                        "absolute bottom-1 text-center text-[10px] tabular-nums",
                        d.isMonthStart || d.isWeekStart
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground",
                      )}
                      style={{ left: d.x, width: PX_PER_DAY }}
                    >
                      {d.day}
                    </span>
                    <span
                      className={cn(
                        "absolute bottom-0 top-5 w-px",
                        d.isMonthStart ? "bg-border" : "bg-border/40",
                      )}
                      style={{ left: d.x }}
                    />
                  </React.Fragment>
                ))}
                {todayX != null && (
                  <div className="absolute inset-y-0 z-10 w-px bg-primary" style={{ left: todayX }}>
                    <span className="absolute top-0 left-1 whitespace-nowrap rounded bg-primary px-1 py-px text-[9px] font-semibold text-primary-foreground">
                      {tr("Hari ini")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ---- rows ---- */}
            <div
              ref={trackRef}
              className="relative"
              onMouseMove={onMove}
              onMouseLeave={onLeave}
            >
              {/* Cursor date guide.
                  z-0 keeps it BEHIND the sticky task-name column (z-20), so the
                  line slides under the names instead of striking through them.
                  The date label is NOT here — see the fixed banner below. */}
              {hoverX != null && hoverDate != null && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-0 w-px bg-foreground/40"
                  style={{ left: hoverX }}
                />
              )}

              {dated.map(({ task, start, end }) => {
                const div = divMap.get(task.division);
                const left = ((start - bounds.min) / DAY) * PX_PER_DAY;
                // Inclusive of the end day, so a same-day task is one day wide
                // rather than zero — this is what made short bars look like
                // they sat on the wrong date.
                const days = Math.round((end - start) / DAY) + 1;
                const width = Math.max(PX_PER_DAY * 0.8, days * PX_PER_DAY);
                const color = div?.color ?? "var(--primary)";
                const range = `${formatDate(task.start_date) ?? "—"} → ${formatDate(task.end_date) ?? "—"}`;
                return (
                  <div key={task.id} className="flex border-b border-border/50 last:border-b-0">
                    <div
                      className="sticky left-0 z-20 flex shrink-0 items-center border-r border-border bg-card px-3 py-1.5"
                      style={{ width: LABEL_W }}
                    >
                      <TaskDetailDialog task={task} division={div} event={evMap.get(task.event_id)} user={user}>
                        <button className="flex min-w-0 items-center gap-1.5 text-left">
                          <StatusDot status={task.status} />
                          <span className="truncate text-xs font-medium hover:text-primary">
                            {task.title}
                          </span>
                        </button>
                      </TaskDetailDialog>
                    </div>

                    <div className="relative h-8" style={{ width: bounds.width }}>
                      {dayCols.map((d) => (
                        <div
                          key={d.x}
                          className={cn("absolute inset-y-0 w-px", d.isMonthStart ? "bg-border" : "bg-border/30")}
                          style={{ left: d.x }}
                        />
                      ))}
                      {todayX != null && (
                        <div className="absolute inset-y-0 w-px bg-primary/40" style={{ left: todayX }} />
                      )}
                      <TaskDetailDialog task={task} division={div} event={evMap.get(task.event_id)} user={user}>
                        <button
                          className={cn(
                            "group absolute top-1/2 h-4 -translate-y-1/2 rounded-full transition",
                            "hover:z-10 hover:h-5 hover:brightness-110 hover:ring-2 hover:ring-foreground/20",
                          )}
                          style={{
                            left,
                            width,
                            backgroundColor: color,
                            opacity: task.status === "done" ? 1 : 0.8,
                          }}
                        >
                          {/* Hover card. `pointer-events-none` so it can never
                              swallow the click that opens the task. */}
                          <span className="pointer-events-none absolute bottom-full left-0 z-40 mb-1.5 hidden w-max max-w-[280px] flex-col gap-0.5 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-left shadow-lg group-hover:flex">
                            <span className="text-xs font-semibold text-popover-foreground">{task.title}</span>
                            <span className="text-[11px] text-muted-foreground">{range}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {days} {tr("hari")}
                              {div ? ` · ${div.name}` : ""} · {STATUS_META[task.status].label}
                            </span>
                            {task.pic && (
                              <span className="text-[11px] text-muted-foreground">PIC: {task.pic}</span>
                            )}
                          </span>
                        </button>
                      </TaskDetailDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {tr("Tanpa tanggal")} ({undated.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {undated.slice(0, 40).map((t) => {
              const div = divMap.get(t.division);
              return (
                <TaskDetailDialog key={t.id} task={t} division={div} event={evMap.get(t.event_id)} user={user}>
                  <button className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-xs transition hover:border-primary/40">
                    <StatusDot status={t.status} />
                    <span className="truncate">{t.title}</span>
                  </button>
                </TaskDetailDialog>
              );
            })}
          </div>
        </div>
      )}

      {/* legend */}
      <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 shrink-0 rounded-full", m.dot)} /> {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
