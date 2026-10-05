import { describe, it, expect } from "vitest";
import type { RundownItem } from "./types";
import { checkMove, mergedRowIds, planMove, planRemoval, moveIndex } from "./rundown-reorder";
import { computeDuration } from "./rundown-time";

function row(id: string, no: number, start: string, end: string, over: Partial<RundownItem> = {}): RundownItem {
  return {
    id, event_id: "ov1", variant: "A", no, time_start: start, time_end: end, duration: "",
    activity: id, keterangan: "", mc: "", operator: "", division_jobs: {}, merges: {}, ...over,
  };
}

/** Apply planMove's patches and return the rows in their new order. */
function applyMove(items: RundownItem[], from: number, to: number): RundownItem[] {
  const patches = new Map(planMove(items, from, to).map((p) => [p.id, p.fields]));
  return items.map((r) => ({ ...r, ...patches.get(r.id) })).sort((a, b) => a.no - b.no);
}

const day = () => [
  row("open", 1, "08.00", "08.30"),
  row("talk", 2, "08.30", "09.00"),
  row("panel", 3, "09.00", "10.00"),
  row("close", 4, "10.00", "10.15"),
];

describe("planMove", () => {
  it("renumbers 1..N in the new order", () => {
    const after = applyMove(day(), 2, 0);
    expect(after.map((r) => [r.id, r.no])).toEqual([["panel", 1], ["open", 2], ["talk", 3], ["close", 4]]);
  });

  it("keeps every row's duration and re-chains the clock from where the stretch began", () => {
    const after = applyMove(day(), 2, 0);
    expect(after.map((r) => `${r.time_start}-${r.time_end}`)).toEqual([
      "08.00-09.00", "09.00-09.30", "09.30-10.00", "10.00-10.15",
    ]);
    for (const r of after) {
      const before = day().find((x) => x.id === r.id)!;
      expect(computeDuration(r.time_start, r.time_end)).toBe(computeDuration(before.time_start, before.time_end));
    }
  });

  it("moving down works the same way", () => {
    const after = applyMove(day(), 0, 2);
    expect(after.map((r) => r.id)).toEqual(["talk", "panel", "open", "close"]);
    expect(after.map((r) => `${r.time_start}-${r.time_end}`)).toEqual([
      "08.00-08.30", "08.30-09.30", "09.30-10.00", "10.00-10.15",
    ]);
  });

  it("leaves rows outside the moved stretch untouched", () => {
    const ids = planMove(day(), 1, 2).map((p) => p.id);
    expect(ids).not.toContain("open");
    expect(ids).not.toContain("close");
  });

  it("keeps a break between activities where it was on the clock", () => {
    const items = [
      row("a", 1, "08.00", "09.00"),
      row("b", 2, "10.00", "10.30"), // an hour's break before it
      row("c", 3, "10.30", "11.00"),
    ];
    const after = applyMove(items, 2, 0);
    expect(after.map((r) => `${r.id} ${r.time_start}-${r.time_end}`)).toEqual([
      "c 08.00-08.30", "a 09.30-10.30", "b 10.30-11.00",
    ]);
  });

  it("does not invent times for a row that has none", () => {
    const items = [
      row("head", 1, "", ""),
      row("a", 2, "08.00", "08.30"),
      row("b", 3, "08.30", "09.30"),
    ];
    const after = applyMove(items, 2, 0);
    const head = after.find((r) => r.id === "head")!;
    expect(head.time_start).toBe("");
    expect(after.find((r) => r.id === "b")!.time_start).toBe("08.00");
    expect(after.find((r) => r.id === "a")!.time_start).toBe("09.00");
  });

  it("handles a schedule that crosses midnight", () => {
    const items = [row("a", 1, "23.00", "23.30"), row("b", 2, "23.30", "00.30")];
    const after = applyMove(items, 1, 0);
    expect(after.map((r) => `${r.time_start}-${r.time_end}`)).toEqual(["23.00-00.00", "00.00-00.30"]);
  });

  it("does not rewrite a time that is already right", () => {
    // Moving an untimed heading above "a" leaves a on the same minutes, so its
    // "8:00" is not rewritten to "08.00".
    const items = [row("a", 1, "8:00", "8:30"), row("head", 2, "", ""), row("c", 3, "8:30", "9:00")];
    const patches = planMove(items, 1, 0);
    expect(patches.every((p) => p.fields.time_start === undefined)).toBe(true);
    expect(patches.map((p) => p.id).sort()).toEqual(["a", "head"]);
  });
});

describe("merged rows", () => {
  const merged = () => [
    row("a", 1, "08.00", "08.30"),
    row("b", 2, "08.30", "09.00", { merges: { mc: 2 }, mc: "Dewi" }),
    row("c", 3, "09.00", "09.30"),
    row("d", 4, "09.30", "10.00"),
  ];

  it("finds every row of a run, hidden division columns included", () => {
    const items = merged();
    items[3] = { ...items[3], merges: { HIDDEN: 1 } };
    items[0] = { ...items[0], merges: { HIDDEN_DIV: 2 } };
    expect([...mergedRowIds(items)].sort()).toEqual(["a", "b", "c"]);
  });

  it("refuses to pick up a merged row", () => {
    expect(checkMove(merged(), 1, 3)).toBe("merged-row");
    expect(checkMove(merged(), 2, 0)).toBe("merged-row");
  });

  it("refuses a drop between two rows of one run", () => {
    // d moved up onto c lands between b and c.
    expect(checkMove(merged(), 3, 2)).toBe("inside-merge");
  });

  it("allows a drop right above or below a run", () => {
    expect(checkMove(merged(), 3, 1)).toBe("ok"); // above b
    expect(checkMove(merged(), 0, 2)).toBe("ok"); // below c
    expect(moveIndex(merged(), 0, 2).map((r) => r.id)).toEqual(["b", "c", "a", "d"]);
  });
});

describe("planRemoval", () => {
  const items = () => [
    row("a", 1, "", "", { merges: { mc: 3, LO: 2 }, mc: "Dewi", division_jobs: { LO: "Jaga" } }),
    row("b", 2, "", ""),
    row("c", 3, "", ""),
    row("d", 4, "", ""),
  ];

  it("shrinks a run that loses a covered row", () => {
    const p = planRemoval(items(), new Set(["b"]));
    expect(p).toEqual([{ id: "a", merges: { mc: 2 }, fields: {}, jobs: {} }]);
  });

  it("hands the run to the next row, value and all, when its top row goes", () => {
    const p = planRemoval(items(), new Set(["a"]));
    const b = p.find((x) => x.id === "b")!;
    expect(b.merges).toEqual({ mc: 2 });
    expect(b.fields).toEqual({ mc: "Dewi" });
    expect(b.jobs).toEqual({ LO: "Jaga" }); // its LO run is down to one row: no merge, but the value stays
  });

  it("does nothing for rows outside any run", () => {
    expect(planRemoval(items(), new Set(["d"]))).toEqual([]);
  });
});
