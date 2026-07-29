import { describe, it, expect } from "vitest";
import { columnRoles, canMergeDown, mergedDown, splitCell, clampMerges } from "./rundown-merge";
import type { RundownItem } from "./types";

const row = (over: Partial<RundownItem> = {}): RundownItem => ({
  id: Math.random().toString(36).slice(2),
  event_id: "ov1",
  variant: "A",
  no: 1,
  time_start: "",
  time_end: "",
  duration: "",
  activity: "",
  keterangan: "",
  mc: "",
  operator: "",
  division_jobs: {},
  merges: {},
  ...over,
});

describe("columnRoles", () => {
  it("marks every row normal when nothing is merged", () => {
    const items = [row(), row(), row()];
    expect(columnRoles(items, "mc").map((r) => r.kind)).toEqual(["normal", "normal", "normal"]);
  });

  it("turns a span into one origin plus covered rows", () => {
    const items = [row({ merges: { mc: 3 } }), row(), row(), row()];
    const roles = columnRoles(items, "mc");
    expect(roles[0]).toEqual({ kind: "origin", span: 3 });
    expect(roles[1]).toEqual({ kind: "covered", originIndex: 0 });
    expect(roles[2]).toEqual({ kind: "covered", originIndex: 0 });
    expect(roles[3].kind).toBe("normal");
  });

  it("keeps columns independent", () => {
    const items = [row({ merges: { mc: 2 } }), row({ merges: { EVENT: 2 } }), row()];
    expect(columnRoles(items, "mc")[1].kind).toBe("covered");
    // The EVENT run starts on row 1, which MC covers — different column, so fine.
    expect(columnRoles(items, "EVENT")[1]).toEqual({ kind: "origin", span: 2 });
  });

  it("clamps a span that would run past the last row", () => {
    // A row deleted from inside a merged run leaves a stale span; an unclamped
    // rowSpan makes the browser drop the rest of the table.
    const items = [row({ merges: { mc: 5 } }), row()];
    expect(columnRoles(items, "mc")[0]).toEqual({ kind: "origin", span: 2 });
  });

  it("ignores an origin that starts inside another run", () => {
    const items = [row({ merges: { mc: 3 } }), row({ merges: { mc: 2 } }), row(), row()];
    const roles = columnRoles(items, "mc");
    expect(roles[0]).toEqual({ kind: "origin", span: 3 });
    expect(roles[1].kind).toBe("covered");
    expect(roles[3].kind).toBe("normal");
  });
});

describe("canMergeDown", () => {
  it("allows merging when a free row follows", () => {
    expect(canMergeDown([row(), row()], "mc", 0)).toBe(true);
  });

  it("refuses on the last row", () => {
    expect(canMergeDown([row(), row()], "mc", 1)).toBe(false);
  });

  it("refuses from inside an existing run", () => {
    const items = [row({ merges: { mc: 2 } }), row(), row()];
    expect(canMergeDown(items, "mc", 1)).toBe(false);
  });

  it("lets an existing run grow into the next free row", () => {
    const items = [row({ merges: { mc: 2 } }), row(), row()];
    expect(canMergeDown(items, "mc", 0)).toBe(true);
  });

  it("refuses to grow into a row owned by another run", () => {
    const items = [row({ merges: { mc: 2 } }), row(), row({ merges: { mc: 2 } }), row()];
    expect(canMergeDown(items, "mc", 0)).toBe(false);
  });
});

describe("mergedDown / splitCell", () => {
  it("grows a fresh cell to a span of two", () => {
    expect(mergedDown(row(), "mc")).toEqual({ mc: 2 });
  });

  it("grows an existing span by one and leaves other columns alone", () => {
    expect(mergedDown(row({ merges: { mc: 2, EVENT: 3 } }), "mc")).toEqual({ mc: 3, EVENT: 3 });
  });

  it("removes only the split column", () => {
    expect(splitCell(row({ merges: { mc: 3, EVENT: 2 } }), "mc")).toEqual({ EVENT: 2 });
  });
});

describe("clampMerges", () => {
  it("drops spans that collapse to a single row", () => {
    expect(clampMerges({ mc: 4 }, 1)).toEqual({});
  });
  it("clamps rather than discards when there is still room", () => {
    expect(clampMerges({ mc: 4, EVENT: 2 }, 3)).toEqual({ mc: 3, EVENT: 2 });
  });
});
