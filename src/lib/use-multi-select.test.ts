import { describe, it, expect } from "vitest";
import { visibleSelection } from "./use-multi-select";

// ------------------------------------------------------------------
// The bug this guards: selections used to be wiped by an effect whenever the
// row array changed, so ticking a few rows and then typing in the search box
// lost everything. The fix is to intersect the selection with what is on
// screen instead of pruning the state - which is what makes a tick survive
// being filtered away and back.
// ------------------------------------------------------------------
describe("visibleSelection", () => {
  it("returns only the selected ids that are on screen", () => {
    expect(visibleSelection(new Set(["a", "c"]), ["a", "b", "c"])).toEqual(["a", "c"]);
  });

  it("keeps a selection alive while it is filtered out of view", () => {
    const selected = new Set(["a", "b"]);
    // "b" is filtered away: it does not count right now...
    expect(visibleSelection(selected, ["a"])).toEqual(["a"]);
    // ...but the state is untouched, so clearing the filter brings it back.
    expect(visibleSelection(selected, ["a", "b"])).toEqual(["a", "b"]);
  });

  it("ignores ids that no longer exist (e.g. just deleted)", () => {
    expect(visibleSelection(new Set(["gone", "a"]), ["a", "b"])).toEqual(["a"]);
  });

  it("follows the on-screen order, not insertion order", () => {
    // The bulk bar reads this list, so it should match what the user sees.
    expect(visibleSelection(new Set(["c", "a"]), ["a", "b", "c"])).toEqual(["a", "c"]);
  });

  it("handles the empty cases", () => {
    expect(visibleSelection(new Set(), ["a", "b"])).toEqual([]);
    expect(visibleSelection(new Set(["a"]), [])).toEqual([]);
  });
});
