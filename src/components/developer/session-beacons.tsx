"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { heartbeatAction, reportErrorAction } from "@/lib/actions/developer";
import { installConsoleCapture } from "@/lib/dev-console";

// ============================================================
// The two things the Developer menu needs that have to run in EVERYBODY's tab.
//
//   * a presence heartbeat, so "who is online" means anything at all;
//   * an uncaught-error listener, so the crashes that get recorded are the ones
//     other people hit, not only the ones the developer reproduces.
//
// Both are silent by design. This component renders nothing, never toasts, and
// swallows its own failures: it is invisible plumbing for a menu the person
// running it cannot see, and a visible failure would be an unexplainable error
// message about a feature that does not exist for them.
//
// It is NOT mounted for guests (the anonymous identity is shared, so every Tamu
// would collapse into one meaningless presence row) nor in demo mode (a
// throwaway database that does not have these tables).
// ============================================================

/** How often a tab says it is still there. */
const BEAT_MS = 60_000;
/**
 * Floor between two beats, whatever asked for them.
 *
 * The timer alone respects BEAT_MS, but every visibilitychange fires one too,
 * and alt-tabbing is not a rare thing to do: each switch back was a server
 * action POST, an auth round trip and an upsert, for a presence row whose
 * whole job is to say "still here in the last minute or so".
 */
const MIN_GAP_MS = 15_000;
/** Cap per page-load, so a crash loop cannot turn into a write loop. */
const MAX_REPORTS = 8;

/**
 * React's streaming SSR completes each segment by looking up its placeholder
 * DOM node by id and moving the real content into place. If that node is
 * already gone by the time the completion script runs - a fast navigation
 * away, a dropped connection mid-stream, or Firefox replaying an inline
 * script off the bfcache - reading its `.parentNode` throws. That is
 * React/Next racing the network, not this app: nothing under src/ touches
 * `.parentNode` itself (grep confirms it), so a null read on that property
 * can only be this. Matched on message text because the stack is minified
 * and the wording differs per engine for the identical failure.
 */
const BENIGN_ERROR_PATTERNS = [
  /reading ['"]parentNode['"]/i, // V8: Cannot read properties of null (reading 'parentNode')
  /access property ["']parentNode["'][^]*is null/i, // Firefox: can't access property "parentNode", b is null
  /null is not an object[^]*parentNode/i, // Safari/JSC: null is not an object (evaluating '...parentNode')
];

export function isKnownBenignError(message: string): boolean {
  return BENIGN_ERROR_PATTERNS.some((re) => re.test(message));
}

export function SessionBeacons({
  isDeveloper = false,
  networkEnabled = false,
}: {
  /** Installs the in-page console for this session. Client-side only, so it
   *  works in demo mode and in local-JSON mode too. */
  isDeveloper?: boolean;
  /** Presence + error reporting, both of which write to the database. Off for
   *  guests and in demo mode, whose project does not have the tables. */
  networkEnabled?: boolean;
}) {
  const pathname = usePathname();
  // Read through a ref so the heartbeat effect does not tear down and restart
  // its interval on every navigation - that would reset the timer each time and
  // beat far more often than intended.
  const pathRef = React.useRef(pathname);
  React.useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  React.useEffect(() => {
    if (!networkEnabled) return;
    let cancelled = false;
    let lastBeat = 0;
    const beat = () => {
      // A background tab is not "online" in any sense worth reporting, and
      // skipping it keeps a forgotten tab from holding someone online for days.
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastBeat < MIN_GAP_MS) return;
      lastBeat = now;
      // `.catch`, not `void`. A server action can reject before its own body
      // runs at all - the POST itself fails, the app is mid-deploy - and an
      // unhandled rejection from invisible plumbing would be filed as an error
      // report by the listener below, which is noise about nothing.
      heartbeatAction(pathRef.current).catch(() => {});
    };
    beat();
    const timer = setInterval(() => {
      if (!cancelled) beat();
    }, BEAT_MS);
    // Coming back to a tab should show up immediately, not up to a minute later.
    document.addEventListener("visibilitychange", beat);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [networkEnabled]);

  React.useEffect(() => {
    if (!networkEnabled) return;
    let sent = 0;
    // The same broken component re-rendering fires the same error repeatedly;
    // one row per distinct message is what makes the log readable.
    const seen = new Set<string>();

    const send = (message: string, stack: string) => {
      if (isKnownBenignError(message)) return;
      const key = `${message}::${stack.slice(0, 200)}`;
      if (sent >= MAX_REPORTS || seen.has(key) || !message) return;
      seen.add(key);
      sent++;
      reportErrorAction({
        kind: "client",
        message: message.slice(0, 2000),
        stack,
        path: window.location.pathname,
      }).catch(() => {});
    };

    const onError = (e: ErrorEvent) => {
      send(e.message || String(e.error), e.error instanceof Error ? (e.error.stack ?? "") : "");
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      send(
        reason instanceof Error ? reason.message : `Unhandled rejection: ${String(reason)}`,
        reason instanceof Error ? (reason.stack ?? "") : "",
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [networkEnabled]);

  // Console capture is the developer's own debugging aid, so it is installed
  // only in their session - see lib/dev-console.ts.
  React.useEffect(() => {
    if (!isDeveloper) return;
    return installConsoleCapture();
  }, [isDeveloper]);

  return null;
}
