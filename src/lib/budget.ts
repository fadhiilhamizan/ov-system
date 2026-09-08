import type { BudgetItem, BudgetPlan } from "./types";

// ============================================================
// Pure helpers for Anggaran (RAB).
//
// The one rule that is easy to get wrong lives here rather than inside the drag
// handler: a plan's items are ONE list, and the category headings in the table
// are DERIVED from their order, so every group has to stay contiguous. Getting
// that wrong does not throw, it just prints "KONSUMSI" twice with different
// rows under each, which is the kind of thing a test catches and a reviewer
// does not.
// ============================================================

/** What a plan actually adds up to. */
export function planTotal(plan: Pick<BudgetPlan, "items">): number {
  return plan.items.reduce((sum, i) => sum + (i.total ?? 0), 0);
}

/**
 * The edition's MAIN budget plan: the single plan Dashboard reports.
 *
 * Dashboard used to SUM every plan of an edition, which misreads what a plan is.
 * "RAB Minimal" and "RAB Maksimal" are two scenarios for the same money, not two
 * separate pots, so adding them produced a figure nobody will ever spend.
 *
 * Three rules, in order, and the fallbacks are not decoration:
 *   1. the plan somebody actually marked (`is_primary`);
 *   2. the only plan there is, because with one plan there is no choice to make
 *      and asking for one would be a ritual;
 *   3. the biggest plan, when an edition has several and none is marked.
 *
 * Rule 3 is the same rule migration 0048 backfills with, so an edition that has
 * not been through that migration (the demo project, an edition cloned from
 * another - `cloneEventData` deliberately does not carry the flag over) still
 * reports the same plan the database would have chosen. It also means deleting
 * the marked plan degrades quietly instead of leaving Dashboard with nothing to
 * show. The tie-break is name then id so the answer never flickers between two
 * plans that happen to cost the same.
 *
 * Returns null only when there are no plans at all.
 */
export function primaryBudgetPlan(plans: readonly BudgetPlan[]): BudgetPlan | null {
  if (!plans.length) return null;
  const marked = plans.find((p) => p.is_primary);
  if (marked) return marked;
  if (plans.length === 1) return plans[0];
  return plans.reduce((best, p) => {
    const d = planTotal(p) - planTotal(best);
    if (d !== 0) return d > 0 ? p : best;
    const byName = p.name.localeCompare(best.name);
    if (byName !== 0) return byName < 0 ? p : best;
    return p.id < best.id ? p : best;
  });
}

/**
 * The droppable id of a category HEADING row.
 *
 * A heading is a drop target in its own right, not just a label: without one,
 * the only way into a category is to aim at one of its existing rows, and the
 * slot ABOVE the first row of a category has no row to aim at.
 */
export const CAT_PREFIX = "cat:";

export const categoryDropId = (category: string) => `${CAT_PREFIX}${category}`;

/** Move `from` to `to`, shifting everything in between. */
function shift<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  out.splice(to, 0, out.splice(from, 1)[0]);
  return out;
}

export type BudgetMove = {
  /** The plan's whole sequence after the drop, in render order. */
  items: BudgetItem[];
  /** The category the dragged item ended up in. */
  category: string;
  /** True when that is a DIFFERENT category from the one it started in, which
   *  is what decides between a plain reorder and a move. */
  changedCategory: boolean;
};

/**
 * Work out a plan's new item order after a drag.
 *
 * `overId` is either another item's id (take its slot) or a category heading's
 * droppable id (go to the top of that category). Either way the destination
 * slot sits inside some category's block, so giving the dragged item that block's
 * category is what keeps the groups contiguous.
 *
 * Returns null when there is nothing to do: an unknown id, or a drop that
 * changes neither position nor category.
 */
export function planAfterDrag(
  items: readonly BudgetItem[],
  activeId: string,
  overId: string,
): BudgetMove | null {
  const from = items.findIndex((i) => i.id === activeId);
  if (from < 0) return null;

  let to: number;
  let category: string;
  if (overId.startsWith(CAT_PREFIX)) {
    category = overId.slice(CAT_PREFIX.length);
    to = items.findIndex((i) => i.category === category);
    if (to < 0) return null;
  } else {
    to = items.findIndex((i) => i.id === overId);
    if (to < 0) return null;
    category = items[to].category;
  }

  const changedCategory = items[from].category !== category;
  if (from === to && !changedCategory) return null;

  return {
    items: shift(items, from, to).map((it) => (it.id === activeId ? { ...it, category } : it)),
    category,
    changedCategory,
  };
}
