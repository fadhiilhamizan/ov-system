import * as React from "react";

/** Shared checkbox multi-select state for tables/lists.
 *  Reset selection on data change via an effect in the caller:
 *    React.useEffect(() => sel.clear(), [rows]);
 */
export function useMultiSelect() {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggle = React.useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const set = React.useCallback((ids: string[], on: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      for (const id of ids) { if (on) n.add(id); else n.delete(id); }
      return n;
    });
  }, []);
  const clear = React.useCallback(() => setSelected(new Set()), []);
  return { selected, toggle, set, clear, count: selected.size, ids: [...selected] };
}
