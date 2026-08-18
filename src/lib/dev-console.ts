"use client";

// ============================================================
// An in-page console, for the times you cannot open devtools.
//
// This exists for the two situations where a browser console is not available
// and the bug only happens there: a phone (most of this app's users are on
// one), and production, where a minified stack in somebody else's browser is
// the only evidence you will ever get.
//
// It captures into a fixed-size ring buffer in memory. Nothing is persisted,
// nothing is sent anywhere: the errors that ARE worth sending go through the
// error beacon and land in `error_log`, which is a different thing on purpose -
// that one collects everyone's crashes, this one is your own session's noise.
//
// ONLY INSTALLED FOR DEVELOPERS. Patching `console` for every visitor would be
// an invasive thing to do to a page you are not debugging, and it would keep a
// few hundred strings alive in the memory of a phone that gains nothing from it.
// ============================================================

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

export interface ConsoleLine {
  id: number;
  at: number;
  level: ConsoleLevel;
  text: string;
}

/** Bounded, because a render loop logging every frame must not exhaust memory. */
const MAX_LINES = 400;

let lines: ConsoleLine[] = [];
let nextId = 1;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

/** Render one console argument the way devtools would, without the object tree. */
function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  try {
    // A depth-limited JSON is the honest compromise: circular React fibers and
    // DOM nodes cannot be serialised, and a half-printed object is more useful
    // than a thrown TypeError inside the logger itself.
    return JSON.stringify(value, replacer(), 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function replacer() {
  const seen = new WeakSet<object>();
  return function (this: unknown, _key: string, value: unknown) {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value as object)) return "[circular]";
      seen.add(value as object);
      if (value instanceof Element) return `<${value.tagName.toLowerCase()}>`;
    }
    if (typeof value === "function") return "[function]";
    return value;
  };
}

export function pushLine(level: ConsoleLevel, text: string) {
  lines = [...lines.slice(-(MAX_LINES - 1)), { id: nextId++, at: Date.now(), level, text }];
  emit();
}

/**
 * Patch the console. Returns an uninstall function.
 *
 * The originals are always called first, so devtools behaves exactly as before
 * when it IS open. Capturing must never replace logging - a debugging aid that
 * swallows output is worse than no aid at all.
 */
export function installConsoleCapture(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;

  const levels: ConsoleLevel[] = ["log", "info", "warn", "error", "debug"];
  const originals = new Map<ConsoleLevel, (...args: unknown[]) => void>();

  for (const level of levels) {
    const original = console[level] as (...args: unknown[]) => void;
    originals.set(level, original);
    console[level] = (...args: unknown[]) => {
      original.apply(console, args);
      try {
        pushLine(level, args.map(stringify).join(" "));
      } catch {
        // A logger that throws would take the page down with it.
      }
    };
  }

  // One line, so the panel can distinguish "nothing has been logged yet" from
  // "capture never installed". Guarded on an empty buffer because StrictMode
  // installs, tears down, and installs again in development, which would
  // otherwise announce itself twice on every page.
  if (lines.length === 0) {
    pushLine("info", "Konsol developer aktif. Log di sesi ini terekam di menu Developer.");
  }

  return () => {
    for (const [level, original] of originals) {
      (console[level] as unknown) = original;
    }
    installed = false;
  };
}

export const getConsoleLines = (): ConsoleLine[] => lines;

export function clearConsoleLines() {
  lines = [];
  emit();
}

/** useSyncExternalStore-compatible. `getConsoleLines` returns a stable array
 *  reference between writes, which is what keeps that hook from looping. */
export function subscribeConsole(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
