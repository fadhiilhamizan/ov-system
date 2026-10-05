import type { RundownItem } from "./types";
import { columnRoles, type MergeMap } from "./rundown-merge";
import { parseTime, formatDuration } from "./rundown-time";

// ============================================================
// Moving and removing rundown rows.
//
// Two things make this more than `arrayMove`:
//
// 1. Merged cells. A merge is stored as a rowspan on the TOP row of the run
//    (see rundown-merge.ts), so it only means something while the rows it
//    covers stay together, in order, directly under it. A row that is part of a
//    run therefore cannot be dragged, and nothing may be dropped between two
//    rows of the same run. Removing rows shrinks the run instead of letting it
//    swallow whatever row slides up into the gap.
//
// 2. Time. Every row keeps its own length when it moves, and the stretch of the
//    schedule between the old and new position is laid out again from the time
//    that stretch started at, so "Durasi" stays exactly what it was for every
//    row and the clock still runs forward. Gaps between activities (a break
//    that has no row of its own) stay where they were on the clock.
//
// Pure functions only: no React, unit-tested in rundown-reorder.test.ts.
// ============================================================

/** Every column that currently holds a real merge on some row. Includes
 *  division columns hidden by the column filter: hiding a column does not
 *  unmerge it. */
export function mergedColumns(items: RundownItem[]): string[] {
  const cols = new Set<string>();
  for (const it of items) {
    for (const [col, n] of Object.entries(it.merges ?? {})) if (Math.floor(n) > 1) cols.add(col);
  }
  return [...cols];
}

/** Ids of rows that belong to a merged run in any column (origin or covered). */
export function mergedRowIds(items: RundownItem[]): Set<string> {
  const out = new Set<string>();
  for (const col of mergedColumns(items)) {
    columnRoles(items, col).forEach((r, i) => { if (r.kind !== "normal") out.add(items[i].id); });
  }
  return out;
}

/** Each merged run as the ids it covers, top to bottom. */
function runs(items: RundownItem[]): string[][] {
  const out: string[][] = [];
  for (const col of mergedColumns(items)) {
    const roles = columnRoles(items, col);
    roles.forEach((r, i) => {
      if (r.kind === "origin") out.push(items.slice(i, i + r.span).map((x) => x.id));
    });
  }
  return out;
}

/** Move one element, like dnd-kit's arrayMove. */
export function moveIndex<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export type MoveCheck = "ok" | "merged-row" | "inside-merge" | "noop";

/**
 * May the row at `from` be moved to `to`?
 * "merged-row": the dragged row is part of a merged run.
 * "inside-merge": the drop would land between two rows of one run.
 */
export function checkMove(items: RundownItem[], from: number, to: number): MoveCheck {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return "noop";
  if (mergedRowIds(items).has(items[from].id)) return "merged-row";
  const order = moveIndex(items, from, to).map((r) => r.id);
  const pos = new Map(order.map((id, i) => [id, i]));
  for (const run of runs(items)) {
    const first = pos.get(run[0])!;
    if (run.some((id, k) => pos.get(id) !== first + k)) return "inside-merge";
  }
  return "ok";
}

const DAY = 24 * 60;

/** Minutes a row lasts, or null when its start/end do not both parse. */
function lengthOf(r: RundownItem): number | null {
  const a = parseTime(r.time_start), b = parseTime(r.time_end);
  if (a === null || b === null) return null;
  return (b - a + DAY) % DAY;
}

const clock = (m: number) => {
  const x = ((m % DAY) + DAY) % DAY;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}.${String(x % 60).padStart(2, "0")}`;
};

/** Signed distance between an end and the next start, kept within half a day
 *  so a schedule that crosses midnight is not read as a 23-hour gap. */
function gapBetween(end: string, start: string): number {
  const a = parseTime(end), b = parseTime(start);
  if (a === null || b === null) return 0;
  let g = b - a;
  if (g > DAY / 2) g -= DAY;
  if (g < -DAY / 2) g += DAY;
  return g;
}

export interface RowPatch {
  id: string;
  fields: Partial<Pick<RundownItem, "no" | "time_start" | "time_end" | "duration">>;
}

/**
 * The writes a move needs: a fresh 1..N `no` for every row whose number
 * changes, and new times for the rows inside the moved stretch.
 *
 * Only rows with a parseable start AND end are re-timed (a heading row with no
 * times stays blank). They are laid out from the start of the first timed row
 * of the stretch in the OLD order, each keeping its own length, with the old
 * gaps between consecutive timed slots kept in place.
 */
export function planMove(items: RundownItem[], from: number, to: number): RowPatch[] {
  const next = moveIndex(items, from, to);
  const patches = new Map<string, RowPatch["fields"]>();
  const put = (id: string, f: RowPatch["fields"]) => patches.set(id, { ...patches.get(id), ...f });

  next.forEach((r, i) => { if (r.no !== i + 1) put(r.id, { no: i + 1 }); });

  const lo = Math.min(from, to), hi = Math.max(from, to);
  const oldTimed = items.slice(lo, hi + 1).filter((r) => lengthOf(r) !== null);
  const newTimed = next.slice(lo, hi + 1).filter((r) => lengthOf(r) !== null);
  if (oldTimed.length) {
    const gaps = oldTimed.slice(1).map((r, k) => gapBetween(oldTimed[k].time_end, r.time_start));
    let cursor = parseTime(oldTimed[0].time_start)!;
    newTimed.forEach((r, k) => {
      const len = lengthOf(r)!;
      const start = cursor, end = cursor + len;
      // Leave a row alone when it already sits on these minutes, so a cell
      // typed as "7:30" is not rewritten to "07.30" for no reason.
      if (parseTime(r.time_start) !== ((start % DAY) + DAY) % DAY || parseTime(r.time_end) !== ((end % DAY) + DAY) % DAY) {
        put(r.id, { time_start: clock(start), time_end: clock(end), duration: formatDuration(len) });
      }
      cursor = end + (gaps[k] ?? 0);
    });
  }
  return [...patches.entries()].map(([id, fields]) => ({ id, fields }));
}

export interface RemovalPatch {
  id: string;
  merges: MergeMap;
  /** Values a new run origin must carry, because covered rows store nothing. */
  fields: Partial<Pick<RundownItem, "mc" | "operator">>;
  jobs: Record<string, string>;
}

/**
 * Merge fixes for the rows that SURVIVE removing `removed`.
 *
 * A run loses exactly the rows that were removed from it. When its top row is
 * among them, the first surviving row becomes the new top and inherits the
 * run's value (a covered row's own value was never shown). A run left with one
 * row is no longer a merge.
 */
export function planRemoval(items: RundownItem[], removed: ReadonlySet<string>): RemovalPatch[] {
  const out = new Map<string, RemovalPatch>();
  const get = (r: RundownItem) => {
    let p = out.get(r.id);
    if (!p) { p = { id: r.id, merges: { ...(r.merges ?? {}) }, fields: {}, jobs: {} }; out.set(r.id, p); }
    return p;
  };
  for (const col of mergedColumns(items)) {
    columnRoles(items, col).forEach((role, i) => {
      if (role.kind !== "origin") return;
      const run = items.slice(i, i + role.span);
      const left = run.filter((r) => !removed.has(r.id));
      const lost = run.length - left.length;
      if (!lost || !left.length) return;
      const origin = run[0];
      const top = left[0];
      const p = get(top);
      if (left.length > 1) p.merges[col] = left.length; else delete p.merges[col];
      if (top.id !== origin.id) {
        if (col === "mc") p.fields.mc = origin.mc;
        else if (col === "operator") p.fields.operator = origin.operator ?? "";
        else p.jobs[col] = origin.division_jobs?.[col] ?? "";
      }
    });
  }
  return [...out.values()];
}
