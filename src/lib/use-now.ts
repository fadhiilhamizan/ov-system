"use client";
import * as React from "react";

// ============================================================
// A wall clock that is safe to RENDER.
//
// `Date.now()` read during render is impure on both sides of hydration: the
// server reads it while building the HTML, the browser reads it again a network
// round trip later, and every "3 detik lalu" between the two is a text mismatch.
// React reports that as a hydration failure (#418) and throws the whole subtree
// away and re-renders it - which is what the Developer and Pengaturan pages were
// doing on every single load. Seeding `useState` with the clock does not help:
// the initialiser runs on BOTH sides, so the two values still disagree.
//
// So the clock is an external store. `getServerSnapshot` returns the caller's
// fallback - the server's OWN timestamp, sent down with the page - and React
// uses that for the hydrating client render too, so the first paint is
// byte-identical to the HTML. The real clock takes over on the commit after
// hydration and re-ticks from there.
//
// One interval for the whole page rather than one per component: three panels
// each asking the time is still one timer.
// ============================================================

/** How often the relative labels are refreshed. */
const TICK_MS = 15_000;

let snapshot = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (timer === null) {
    snapshot = Date.now();
    timer = setInterval(() => {
      snapshot = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Must be STABLE between ticks - useSyncExternalStore compares by identity,
 *  and a getSnapshot that returns a fresh `Date.now()` re-renders forever. */
function getSnapshot(): number {
  if (snapshot === 0) snapshot = Date.now();
  return snapshot;
}

/**
 * The current time in milliseconds, as a value a component may render.
 *
 * @param fallback what to use on the server and during hydration. Pass the
 *   server's own clock (the page sends one down) so the first paint is correct
 *   rather than blank, and identical on both sides.
 */
export function useNow(fallback: number): number {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}
