import * as React from "react";
import { VIOLET_MODELS } from "./models";

// ============================================================
// Which model this browser has Violet set to.
//
// A per-viewer convenience, so localStorage - the one job AGENTS.md keeps it
// for. It is never sent anywhere except as the `model` argument on a question,
// and the server re-checks it against the whitelist, so a hand-edited value
// buys nothing.
//
// WHY useSyncExternalStore AND NOT AN EFFECT. Violet is mounted in the app
// shell, so it renders on the server too, where there is no localStorage. The
// obvious shape - state initialised to "auto", then an effect that reads the
// stored value - renders once with the wrong model, is what
// `react-hooks/set-state-in-effect` rejects, and is the exact bug AGENTS.md
// records against ThemeToggle. useSyncExternalStore has a separate server
// snapshot built in: the server says "auto", the client says what is stored,
// and React reconciles the difference itself instead of us faking it.
//
// EVERY ACCESS IS WRAPPED. localStorage throws on READ, not only on write, in a
// private window, under a block-site-data setting, and during thumbnail
// capture. A chat that will not open is a far worse bug than a forgotten
// preference.
// ============================================================

const KEY = "ov.violet.model";

/** The picker's "let Violet decide" entry. Not a model id, never sent. */
export const AUTO = "auto";

/**
 * Cached because getSnapshot must be STABLE: React calls it during render and
 * again while committing, and a snapshot that re-reads storage each time is
 * free to disagree with itself and send React into a re-render loop.
 */
let cache: string | null = null;
let listeners: (() => void)[] = [];

function read(): string {
  try {
    const v = window.localStorage.getItem(KEY);
    // An id that is no longer in the picker (a model we dropped) falls back to
    // AUTO rather than being sent and rejected.
    return v && VIOLET_MODELS.some((m) => m.id === v) ? v : AUTO;
  } catch {
    return AUTO;
  }
}

function subscribe(cb: () => void): () => void {
  listeners = [...listeners, cb];
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

const getSnapshot = (): string => (cache ??= read());
/** The server has no browser storage, so it always renders the default. */
const getServerSnapshot = (): string => AUTO;

/** Change it, persist it, and tell every mounted picker. */
export function setModelPref(next: string): void {
  cache = next;
  try {
    if (next === AUTO) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
  } catch {
    // The choice still applies to this session; only the memory of it is lost.
  }
  for (const l of listeners) l();
}

/** The model this browser is set to, or AUTO. */
export function useModelPref(): string {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Test seam: drop the cached snapshot and every listener. */
export function resetModelPrefForTests(): void {
  cache = null;
  listeners = [];
}
