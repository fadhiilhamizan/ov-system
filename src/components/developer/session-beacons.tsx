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
/** Cap per page-load, so a crash loop cannot turn into a write loop. */
const MAX_REPORTS = 8;

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
    const beat = () => {
      // A background tab is not "online" in any sense worth reporting, and
      // skipping it keeps a forgotten tab from holding someone online for days.
      if (document.visibilityState !== "visible") return;
      void heartbeatAction(pathRef.current);
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
      const key = `${message}::${stack.slice(0, 200)}`;
      if (sent >= MAX_REPORTS || seen.has(key) || !message) return;
      seen.add(key);
      sent++;
      void reportErrorAction({
        kind: "client",
        message: message.slice(0, 2000),
        stack,
        path: window.location.pathname,
      });
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
