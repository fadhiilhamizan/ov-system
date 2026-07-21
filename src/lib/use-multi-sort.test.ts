import { describe, it, expect } from "vitest";
import { sortRows, type SortRule } from "./use-multi-sort";

type Row = { no: number; name: string };
const rows: Row[] = [
  { no: 2, name: "budi" },
  { no: 1, name: "citra" },
  { no: 2, name: "andi" },
  { no: 1, name: "andi" },
];
const val = (r: Row, k: "no" | "name") => (k === "no" ? r.no : r.name);

describe("sortRows (stacking multi-sort)", () => {
  it("returns the original array when there are no rules", () => {
    expect(sortRows(rows, [], val)).toBe(rows);
  });

  it("sorts by a single rule", () => {
    const out = sortRows(rows, [{ key: "no", dir: "asc" }], val);
    expect(out.map((r) => r.no)).toEqual([1, 1, 2, 2]);
  });

  it("keeps the first column as primary and uses the second as a tiebreaker", () => {
    // This is the reported bug: adding "name" must NOT reset the "no" sort.
    const rules: SortRule<"no" | "name">[] = [
      { key: "no", dir: "asc" },
      { key: "name", dir: "asc" },
    ];
    const out = sortRows(rows, rules, val);
    expect(out).toEqual([
      { no: 1, name: "andi" },
      { no: 1, name: "citra" },
      { no: 2, name: "andi" },
      { no: 2, name: "budi" },
    ]);
  });

  it("honours per-column direction independently", () => {
    const out = sortRows(
      rows,
      [{ key: "no", dir: "asc" }, { key: "name", dir: "desc" }],
      val,
    );
    expect(out.map((r) => `${r.no}${r.name}`)).toEqual(["1citra", "1andi", "2budi", "2andi"]);
  });

  it("does not mutate the input", () => {
    const copy = [...rows];
    sortRows(rows, [{ key: "name", dir: "asc" }], val);
    expect(rows).toEqual(copy);
  });
});
