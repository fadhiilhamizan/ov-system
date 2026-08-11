import * as React from "react";

// ============================================================
// Shared checkbox multi-select for tables/lists.
//
// The selection is NEVER auto-cleared when the rows change. It used to be —
// every caller ran `useEffect(() => sel.clear(), [rows])`, and the Work
// Breakdown table reset on the *filtered* array — so typing one letter in a
// search box threw away everything you had ticked. Selecting a few rows, then
// searching for the next few, was impossible.
//
// Instead, "selected" is intersected with what is currently on screen. An id
// that gets filtered away (or deleted) simply stops counting, so stale ids are
// harmless and no cleanup effect is needed. Filter away and back again and the
// tick is still there.
// ============================================================

/** Ids that are selected AND currently visible, in the order they appear. */
export function visibleSelection(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
): string[] {
  return visibleIds.filter((id) => selected.has(id));
}

/**
 * @param visibleIds ids rendered under the current search/filter. Omit only for
 *   a list that never filters — then every selected id counts.
 */
export function useMultiSelect(visibleIds?: readonly string[]) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const toggle = React.useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const set = React.useCallback((ids: readonly string[], on: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      for (const id of ids) { if (on) n.add(id); else n.delete(id); }
      return n;
    });
  }, []);

  const clear = React.useCallback(() => setSelected(new Set()), []);

  const ids = React.useMemo(
    () => (visibleIds ? visibleSelection(selected, visibleIds) : [...selected]),
    [selected, visibleIds],
  );

  const allVisibleSelected = !!visibleIds && visibleIds.length > 0 && ids.length === visibleIds.length;

  /** Select-all only touches rows on screen, so hidden ticks survive it. */
  const toggleAll = React.useCallback(() => {
    if (!visibleIds) return;
    set(visibleIds, !allVisibleSelected);
  }, [visibleIds, allVisibleSelected, set]);

  return { selected, toggle, set, clear, toggleAll, allVisibleSelected, count: ids.length, ids };
}
