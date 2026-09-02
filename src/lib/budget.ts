import type { BudgetItem } from "./types";

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
