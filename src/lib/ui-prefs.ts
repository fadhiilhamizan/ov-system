// Client/server-shared UI preference cookies.
//
// Deliberately a plain module with NO "use client" / "server-only" directive:
// the server layout reads the cookie to render the right markup on first paint,
// and the client component writes it on toggle. (A constant exported from a
// "use client" module would reach the server as a client reference, not the
// string - which silently breaks the server-side read.)

/** Sidebar collapsed state. Values: "collapsed" | "expanded". */
export const SIDEBAR_COOKIE = "ov_sidebar";
export const SIDEBAR_COLLAPSED = "collapsed";
export const SIDEBAR_EXPANDED = "expanded";
