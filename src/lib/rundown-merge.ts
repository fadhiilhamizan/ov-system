import type { RundownItem } from "./types";

// ============================================================
// Merged rundown cells.
//
// A division often does the SAME thing across several consecutive time slots.
// Repeating the text on every row loses the distinction between "three separate
// activities that happen to match" and "one activity spanning three slots".
//
// Storage mirrors an HTML rowspan and lives on the TOP row of the run:
//   item.merges = { MC: 3 }  ->  that row's MC cell spans itself + 2 rows below.
// Covered rows store nothing; their value is read from the origin row.
//
// Pure functions only - no React - so the rules are unit-testable.
// ============================================================

/** Columns that may be merged. Catatan is deliberately excluded: it is per-row. */
export const MERGE_MC = "mc";
export const MERGE_OPERATOR = "operator";

export type MergeMap = Record<string, number>;

/** How a single cell participates in its column. */
export type CellRole =
  | { kind: "normal" }
  /** Top of a run: render with this rowSpan. */
  | { kind: "origin"; span: number }
  /** Swallowed by an origin above: render nothing at all. */
  | { kind: "covered"; originIndex: number };

function spanAt(items: RundownItem[], index: number, col: string): number {
  const raw = items[index]?.merges?.[col];
  const n = typeof raw === "number" ? Math.floor(raw) : 1;
  // A span can never run past the end of the list - a row deleted from the
  // middle of a merged run would otherwise leave a rowSpan pointing at nothing,
  // and the browser silently drops the rest of the table.
  return Math.max(1, Math.min(n, items.length - index));
}

/**
 * Resolve every row's role in one column, top to bottom.
 *
 * Overlaps cannot happen by construction: once a run claims rows, later origins
 * inside it are ignored rather than trusted. That keeps a hand-edited or
 * half-migrated `merges` value from corrupting the whole table's layout.
 */
export function columnRoles(items: RundownItem[], col: string): CellRole[] {
  const roles: CellRole[] = items.map(() => ({ kind: "normal" }));
  let i = 0;
  while (i < items.length) {
    const span = spanAt(items, i, col);
    if (span > 1) {
      roles[i] = { kind: "origin", span };
      for (let k = 1; k < span; k++) roles[i + k] = { kind: "covered", originIndex: i };
      i += span;
    } else {
      i += 1;
    }
  }
  return roles;
}

/** Can the cell at `index` swallow one more row below it? */
export function canMergeDown(items: RundownItem[], col: string, index: number): boolean {
  const roles = columnRoles(items, col);
  const role = roles[index];
  if (!role || role.kind === "covered") return false;
  const span = role.kind === "origin" ? role.span : 1;
  const next = index + span;
  // The next row has to exist AND be entirely free - not covered by another run,
  // and not the origin of one either. Swallowing another origin would make
  // columnRoles() discard that run, silently destroying a merge the user made.
  return next < items.length && roles[next].kind === "normal";
}

/** The merges map for `item` after growing `col` by one row. */
export function mergedDown(item: RundownItem, col: string): MergeMap {
  const current = Math.max(1, Math.floor(item.merges?.[col] ?? 1));
  return { ...(item.merges ?? {}), [col]: current + 1 };
}

/** The merges map for `item` after splitting `col` back into single rows. */
export function splitCell(item: RundownItem, col: string): MergeMap {
  const next = { ...(item.merges ?? {}) };
  delete next[col];
  return next;
}

/**
 * Merges to keep on a row once the list changes shape.
 * Spans that would overrun the end are clamped rather than dropped, so shrinking
 * then re-adding rows doesn't silently lose the merge.
 */
export function clampMerges(merges: MergeMap | undefined, roomBelow: number): MergeMap {
  const out: MergeMap = {};
  for (const [col, raw] of Object.entries(merges ?? {})) {
    const n = Math.max(1, Math.min(Math.floor(raw), roomBelow));
    if (n > 1) out[col] = n;
  }
  return out;
}
