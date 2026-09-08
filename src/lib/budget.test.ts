import { describe, it, expect } from "vitest";
import { categoryDropId, planAfterDrag, planTotal, primaryBudgetPlan } from "./budget";
import type { BudgetItem, BudgetPlan } from "./types";

// ============================================================
// Dragging an item around the RAB table.
//
// The invariant every case here defends is the same one: the category headings
// are DERIVED from item order, so each category's rows have to stay contiguous.
// Break it and nothing throws, the table just prints one category twice with
// different rows under each heading.
// ============================================================

const item = (id: string, category: string, name = id): BudgetItem => ({
  id, category, no: 0, name, qty: 1, unit: "", unit_price: 1000, total: 1000, category_color: null,
});

/** KONSUMSI: a, b · LAIN-LAIN: c, d */
const plan = (): BudgetItem[] => [
  item("a", "KONSUMSI"),
  item("b", "KONSUMSI"),
  item("c", "LAIN-LAIN"),
  item("d", "LAIN-LAIN"),
];

const shape = (items: BudgetItem[]) => items.map((i) => `${i.category}/${i.id}`).join(" ");
/** Every category appears as ONE unbroken run. */
const contiguous = (items: BudgetItem[]) => {
  const seen = new Set<string>();
  let last = "";
  for (const i of items) {
    if (i.category !== last) {
      if (seen.has(i.category)) return false;
      seen.add(i.category);
      last = i.category;
    }
  }
  return true;
};

describe("planAfterDrag - within one category", () => {
  it("reorders without touching any category", () => {
    const r = planAfterDrag(plan(), "a", "b");
    expect(r).not.toBeNull();
    expect(r!.changedCategory).toBe(false);
    expect(shape(r!.items)).toBe("KONSUMSI/b KONSUMSI/a LAIN-LAIN/c LAIN-LAIN/d");
  });

  it("is a no-op when the item is dropped on itself", () => {
    expect(planAfterDrag(plan(), "a", "a")).toBeNull();
  });

  it("is a no-op for an id that is not in the plan", () => {
    expect(planAfterDrag(plan(), "a", "zz")).toBeNull();
    expect(planAfterDrag(plan(), "zz", "a")).toBeNull();
  });
});

describe("planAfterDrag - across categories", () => {
  it("adopts the category of the row it lands on", () => {
    const r = planAfterDrag(plan(), "a", "d")!;
    expect(r.changedCategory).toBe(true);
    expect(r.category).toBe("LAIN-LAIN");
    expect(shape(r.items)).toBe("KONSUMSI/b LAIN-LAIN/c LAIN-LAIN/d LAIN-LAIN/a");
  });

  it("keeps every category in one unbroken run, both directions", () => {
    const down = planAfterDrag(plan(), "a", "c")!;
    const up = planAfterDrag(plan(), "d", "a")!;
    expect(contiguous(down.items)).toBe(true);
    expect(contiguous(up.items)).toBe(true);
  });

  it("moves an item up into the earlier category", () => {
    const r = planAfterDrag(plan(), "d", "b")!;
    expect(r.category).toBe("KONSUMSI");
    expect(shape(r.items)).toBe("KONSUMSI/a KONSUMSI/d KONSUMSI/b LAIN-LAIN/c");
  });
});

describe("planAfterDrag - dropping on a category heading", () => {
  it("lands at the TOP of that category", () => {
    const r = planAfterDrag(plan(), "d", categoryDropId("KONSUMSI"))!;
    expect(r.changedCategory).toBe(true);
    expect(shape(r.items)).toBe("KONSUMSI/d KONSUMSI/a KONSUMSI/b LAIN-LAIN/c");
  });

  it("still counts as a move when the item is already the first row of another category", () => {
    // `c` is at index 2 and the KONSUMSI block starts at 0, so this is a real
    // change of both position and category.
    const r = planAfterDrag(plan(), "c", categoryDropId("KONSUMSI"))!;
    expect(r.category).toBe("KONSUMSI");
    expect(contiguous(r.items)).toBe(true);
  });

  it("is a no-op when the item is already the first row of that same category", () => {
    expect(planAfterDrag(plan(), "a", categoryDropId("KONSUMSI"))).toBeNull();
  });

  it("ignores a heading for a category that has no rows", () => {
    expect(planAfterDrag(plan(), "a", categoryDropId("TIDAK ADA"))).toBeNull();
  });

  it("cannot be confused by an item whose id looks like a heading id", () => {
    // The prefix is what keeps the two id spaces apart; without it an item
    // literally named "cat:KONSUMSI" would be read as a heading.
    const items = [...plan(), item("cat:KONSUMSI", "LAIN-LAIN")];
    const r = planAfterDrag(items, "a", categoryDropId("LAIN-LAIN"))!;
    expect(r.category).toBe("LAIN-LAIN");
  });
});

// ============================================================
// Which plan the edition's figure comes from.
//
// Dashboard used to SUM every plan, which misreads what a plan is: "RAB
// Minimal" and "RAB Maksimal" are two scenarios for the same money, so the
// figure was roughly double and grew again with every scenario drafted.
// ============================================================

const budgetPlan = (
  id: string, name: string, total: number, is_primary = false,
): BudgetPlan => ({
  id, name, event_id: "ov1", is_primary,
  items: total ? [{ ...item("x", "KONSUMSI"), id: `${id}-i`, total }] : [],
});

describe("primaryBudgetPlan", () => {
  it("has no answer when there are no plans", () => {
    expect(primaryBudgetPlan([])).toBeNull();
  });

  it("uses the single plan without needing it marked", () => {
    // "One plan means that plan" - making somebody press a button to confirm
    // the obvious would be a ritual.
    expect(primaryBudgetPlan([budgetPlan("a", "RAB", 500)])?.id).toBe("a");
  });

  it("prefers the marked plan even when it is not the biggest", () => {
    const picked = primaryBudgetPlan([
      budgetPlan("a", "RAB Maksimal", 900),
      budgetPlan("b", "RAB Fix", 400, true),
    ]);
    expect(picked?.id).toBe("b");
  });

  it("falls back to the biggest plan when nothing is marked", () => {
    // The same rule migration 0048 backfills with, so an edition that has not
    // been through it (the demo project, or one cloned from another edition -
    // the clone deliberately does not carry the flag) still reports the plan
    // the database would have chosen.
    const picked = primaryBudgetPlan([
      budgetPlan("a", "RAB Minimal", 400),
      budgetPlan("b", "RAB Maksimal", 900),
      budgetPlan("c", "RAB Draft", 100),
    ]);
    expect(picked?.id).toBe("b");
  });

  it("breaks a tie the same way every time", () => {
    const plans = [budgetPlan("z", "Beta", 500), budgetPlan("y", "Alfa", 500)];
    expect(primaryBudgetPlan(plans)?.id).toBe("y");
    expect(primaryBudgetPlan([...plans].reverse())?.id).toBe("y");
  });

  it("never sums the scenarios", () => {
    // The whole point: two scenarios for the same money is ONE figure.
    const plans = [budgetPlan("a", "RAB Minimal", 400), budgetPlan("b", "RAB Maksimal", 900)];
    expect(planTotal(primaryBudgetPlan(plans)!)).toBe(900);
  });
});
