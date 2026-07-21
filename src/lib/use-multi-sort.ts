import * as React from "react";

export type SortDir = "asc" | "desc";
export interface SortRule<K extends string = string> { key: K; dir: SortDir }

/**
 * Stacking multi-column sort. Clicking a new column ADDS it to the chain as a
 * tiebreaker instead of replacing the current sort — so "No" then "Nama" sorts
 * by No first, then Nama within equal No values.
 *
 * Click cycle per column: asc -> desc -> removed from the chain.
 */
export function useMultiSort<K extends string = string>(initial: SortRule<K>[] = []) {
  const [rules, setRules] = React.useState<SortRule<K>[]>(initial);

  const toggle = React.useCallback((key: K) => {
    setRules((prev) => {
      const i = prev.findIndex((r) => r.key === key);
      if (i === -1) return [...prev, { key, dir: "asc" as SortDir }];
      if (prev[i].dir === "asc") {
        const next = [...prev];
        next[i] = { key, dir: "desc" };
        return next;
      }
      return prev.filter((r) => r.key !== key);
    });
  }, []);

  const clear = React.useCallback(() => setRules([]), []);
  const dirOf = React.useCallback((key: K) => rules.find((r) => r.key === key)?.dir, [rules]);
  const rankOf = React.useCallback((key: K) => rules.findIndex((r) => r.key === key), [rules]);

  return { rules, toggle, clear, dirOf, rankOf, active: rules.length > 0 };
}

/** Apply a rule chain. `val` maps (row, key) to a comparable primitive. */
export function sortRows<T, K extends string>(
  rows: T[],
  rules: SortRule<K>[],
  val: (row: T, key: K) => string | number,
): T[] {
  if (!rules.length) return rows;
  return [...rows].sort((a, b) => {
    for (const r of rules) {
      const av = val(a, r.key);
      const bv = val(b, r.key);
      if (av < bv) return r.dir === "asc" ? -1 : 1;
      if (av > bv) return r.dir === "asc" ? 1 : -1;
    }
    return 0;
  });
}
