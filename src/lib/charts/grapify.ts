import { School, type GrapifyPercentRow } from "grapify";

export interface PercentSlice {
  label: string;
  value: number;
  /** 0–100, share of the largest value in the set. */
  percent: number;
}

function isPercentRow(row: unknown): row is GrapifyPercentRow {
  return (
    typeof row === "object" &&
    row !== null &&
    typeof (row as GrapifyPercentRow).valuePercentage === "number" &&
    Number.isFinite((row as GrapifyPercentRow).valuePercentage)
  );
}

/**
 * Percentage-of-max for a labelled series, computed by the `grapify` package.
 *
 * grapify is fed through this one wrapper on purpose. Its API is comma-joined
 * strings and its validator state lives in module-level `let`s that are never
 * reset after a failure, so a single malformed call would poison every later
 * one in the same process. Everything below exists to guarantee grapify only
 * ever sees input it accepts:
 *  - labels are comma-stripped (comma is grapify's separator) and never empty,
 *  - the column count always equals both list lengths,
 *  - `maxRange` is the series max, so no value can exceed it,
 *  - an all-zero or empty series never reaches grapify (it would divide by 0),
 *  - the return is shape-checked, since grapify answers errors with a
 *    differently-shaped array and validation failures with `undefined`.
 */
export function percentOfMax(input: { label: string; value: number }[]): PercentSlice[] {
  const rows = input.map((d) => ({
    label: (d.label || "-").replace(/,/g, " "),
    value: Number.isFinite(d.value) ? Math.max(0, d.value) : 0,
  }));
  if (!rows.length) return [];

  const max = Math.max(...rows.map((r) => r.value));
  if (max <= 0) return rows.map((r) => ({ ...r, percent: 0 }));

  const out = School(
    rows.length,
    max,
    { ColumsNames: rows.map((r) => r.label).join(",") },
    { Values: rows.map((r) => r.value).join(",") },
  );

  // Fall back to the plain arithmetic if grapify hands back anything unexpected.
  return rows.map((r, i) => {
    const row = out?.[i];
    const pct = isPercentRow(row) ? row.valuePercentage : (r.value / max) * 100;
    return { label: r.label, value: r.value, percent: Math.round(pct * 10) / 10 };
  });
}
