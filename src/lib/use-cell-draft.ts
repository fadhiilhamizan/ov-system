"use client";
import * as React from "react";

// Shared by every table that is edited in place (Rundown, FGD, Compare).

/** How long a cell may sit untouched mid-typing before its text is committed
 *  to the table's local copy (the save itself is batched later). */
const IDLE_COMMIT = 700;

/**
 * Local text state for one editable cell.
 *
 * Mirrors `value` like `useSynced`, EXCEPT while the cell has focus: a
 * revalidation landing mid-sentence used to reset the text under the caret.
 * Also commits after a short typing pause, so an edit is never only in the DOM
 * when the person moves on without leaving the cell.
 */
export function useCellDraft(
  value: string,
  onSave: (v: string) => void,
  /** Pause before a mid-typing commit. Tables that send every commit straight
   *  to the server (rather than batching like the Rundown) use a longer one. */
  idleMs = IDLE_COMMIT,
) {
  const [v, setV] = React.useState(value);
  const [prev, setPrev] = React.useState(value);
  const [editing, setEditing] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!editing && !Object.is(prev, value)) {
    setPrev(value);
    setV(value);
  }
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const commit = (next: string) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (next !== value) onSave(next);
  };
  return {
    v,
    set: (next: string) => {
      setV(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => commit(next), idleMs);
    },
    replace: (next: string) => { setV(next); commit(next); },
    onFocus: () => setEditing(true),
    onBlur: () => { setEditing(false); commit(v); },
  };
}
