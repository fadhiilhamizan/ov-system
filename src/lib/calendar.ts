// ============================================================
// Calendar maths, kept pure so it can be tested without a browser.
//
// The calendar has six views (day, 4 days, week, month, year, schedule). They
// all reduce to the same three questions: which dates does this view cover,
// where does "previous/next" go, and what sits on each date. Dates here are
// LOCAL calendar dates handled as "yyyy-mm-dd" strings, never instants: a
// deadline is a day, not a moment, and the server and the browser may sit in
// different timezones (see no-host-timezone.test.ts).
// ============================================================

import { parseTime } from "./rundown-time";

export type CalView = "day" | "4day" | "week" | "month" | "year" | "schedule";
export const CAL_VIEWS: CalView[] = ["day", "4day", "week", "month", "year", "schedule"];

export const DOW_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const DOW_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function isCalView(v: unknown): v is CalView {
  return typeof v === "string" && (CAL_VIEWS as string[]).includes(v);
}

/** "2026-09-30" for a local Date. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local Date at midnight for "yyyy-mm-dd" (or null when it is not one). */
export function parseYmd(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Every date from `start`, `count` of them. */
export function daysFrom(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** The dates a view shows around `ref`. Month = the 6x7 grid. */
export function viewDays(view: CalView, ref: Date): Date[] {
  switch (view) {
    case "day": return [new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())];
    case "4day": return daysFrom(ref, 4);
    case "week": return daysFrom(addDays(ref, -ref.getDay()), 7);
    case "month": {
      const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
      return daysFrom(addDays(first, -first.getDay()), 42);
    }
    case "year":
    case "schedule": {
      const first = new Date(ref.getFullYear(), view === "year" ? 0 : ref.getMonth(), 1);
      const last = view === "year"
        ? new Date(ref.getFullYear(), 11, 31)
        : new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      return daysFrom(first, Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1);
    }
  }
}

/** Where "next" (dir 1) or "previous" (dir -1) lands. */
export function step(view: CalView, ref: Date, dir: 1 | -1): Date {
  switch (view) {
    case "day": return addDays(ref, dir);
    case "4day": return addDays(ref, 4 * dir);
    case "week": return addDays(ref, 7 * dir);
    case "month":
    case "schedule": return new Date(ref.getFullYear(), ref.getMonth() + dir, 1);
    case "year": return new Date(ref.getFullYear() + dir, 0, 1);
  }
}

/** The heading for the current range, with month/day names left untranslated
 *  (the caller passes `t`). */
export function rangeTitle(view: CalView, ref: Date, t: (s: string) => string = (s) => s): string {
  const mon = (d: Date) => t(MONTHS[d.getMonth()]);
  switch (view) {
    case "day":
      return `${t(DOW_LONG[ref.getDay()])}, ${ref.getDate()} ${mon(ref)} ${ref.getFullYear()}`;
    case "year":
      return String(ref.getFullYear());
    case "month":
    case "schedule":
      return `${mon(ref)} ${ref.getFullYear()}`;
    default: {
      const days = viewDays(view, ref);
      const a = days[0], b = days[days.length - 1];
      if (a.getMonth() === b.getMonth()) return `${a.getDate()} - ${b.getDate()} ${mon(a)} ${a.getFullYear()}`;
      if (a.getFullYear() === b.getFullYear()) return `${a.getDate()} ${mon(a)} - ${b.getDate()} ${mon(b)} ${b.getFullYear()}`;
      return `${a.getDate()} ${mon(a)} ${a.getFullYear()} - ${b.getDate()} ${mon(b)} ${b.getFullYear()}`;
    }
  }
}

// ---------------- items on dates ----------------

export interface DatedTask {
  id: string;
  start_date: string | null;
  end_date: string | null;
}

/** Tasks whose DEADLINE is on each date. */
export function deadlinesByDate<T extends DatedTask>(tasks: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const t of tasks) {
    if (!t.end_date) continue;
    const list = map.get(t.end_date) ?? [];
    list.push(t);
    map.set(t.end_date, list);
  }
  return map;
}

/**
 * Tasks being worked on during `date`: start <= date <= deadline. A task with
 * no start is only "on" its deadline day; one with no deadline is nowhere.
 */
export function activeOn<T extends DatedTask>(tasks: readonly T[], date: string): T[] {
  return tasks.filter((t) => {
    if (!t.end_date) return false;
    const start = t.start_date && t.start_date <= t.end_date ? t.start_date : t.end_date;
    return start <= date && date <= t.end_date;
  });
}

// ---------------- the rundown on the time grid ----------------

export interface TimedBlock<T> {
  item: T;
  /** Minutes from midnight. */
  start: number;
  end: number;
  /** Side-by-side placement when blocks overlap. */
  lane: number;
  lanes: number;
}

/**
 * Lay rundown sessions out on a day's time grid. Sessions without a start are
 * skipped; one without an end gets 30 minutes. Overlapping sessions are put in
 * lanes, side by side, the way every calendar does it.
 */
export function layoutTimed<T extends { time_start: string; time_end: string }>(items: readonly T[]): TimedBlock<T>[] {
  const blocks = items
    .map((item) => {
      const s = parseTime(item.time_start);
      if (s === null) return null;
      let e = parseTime(item.time_end);
      if (e === null || e <= s) e = e !== null && e < s ? 24 * 60 : s + 30;
      return { item, start: s, end: Math.min(e, 24 * 60), lane: 0, lanes: 1 };
    })
    .filter((b): b is TimedBlock<T> => b !== null)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  // Group into clusters of mutually overlapping blocks, then lane inside each.
  let cluster: TimedBlock<T>[] = [];
  let clusterEnd = -1;
  const finish = () => {
    const laneEnds: number[] = [];
    for (const b of cluster) {
      let lane = laneEnds.findIndex((end) => end <= b.start);
      if (lane < 0) { lane = laneEnds.length; laneEnds.push(b.end); } else laneEnds[lane] = b.end;
      b.lane = lane;
    }
    for (const b of cluster) b.lanes = laneEnds.length;
    cluster = [];
  };
  for (const b of blocks) {
    if (cluster.length && b.start >= clusterEnd) finish();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  if (cluster.length) finish();
  return blocks;
}

/** The hour range a time grid should show: the blocks plus a margin, at least 07-19. */
export function hourRange(blocks: readonly { start: number; end: number }[]): [number, number] {
  if (!blocks.length) return [7, 19];
  const first = Math.min(...blocks.map((b) => b.start));
  const last = Math.max(...blocks.map((b) => b.end));
  return [Math.max(0, Math.min(7, Math.floor(first / 60) - 1)), Math.min(24, Math.max(19, Math.ceil(last / 60) + 1))];
}
