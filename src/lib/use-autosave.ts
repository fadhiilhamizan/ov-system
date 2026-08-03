import * as React from "react";

// ============================================================
// Autosave status.
//
// Inline edits (rundown cells, job reorder, budget qty) save on blur/drop/debounce
// with no Save button. Errors already surface as a toast, but a SUCCESSFUL save
// gave no feedback at all — the user couldn't tell whether their change stuck.
// This tracks a small idle → saving → saved/error lifecycle so a shared
// SaveIndicator can show "Tersimpan" for a beat.
// ============================================================

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Result = { ok: boolean };

export function useAutosave() {
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against an earlier, slower save flipping the badge after a later one
  // has already resolved.
  const seq = React.useRef(0);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** Run one save. `fn` returns the action's `{ ok }` Result (or throws). */
  const run = React.useCallback(async (fn: () => Promise<Result>): Promise<boolean> => {
    const id = ++seq.current;
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    let ok = false;
    try {
      ok = (await fn()).ok;
    } catch {
      ok = false;
    }
    if (seq.current !== id) return ok; // superseded by a newer save
    setStatus(ok ? "saved" : "error");
    // "saved" fades after a moment; "error" lingers a little longer (the toast
    // carries the detail, this is only the ambient cue).
    timer.current = setTimeout(() => setStatus("idle"), ok ? 1800 : 2800);
    return ok;
  }, []);

  return { status, run };
}
