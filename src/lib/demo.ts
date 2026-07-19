// ============================================================
// Ormawa Visit "Demo" mode — a fully SEPARATE Supabase database.
//
// The demo runs against its own Supabase project (its own URL + anon key), so
// demo data and real data can never read or write each other. A user enters
// demo mode from the login page (no account needed); while the `ov_demo`
// cookie is set, every Supabase client (server, browser, proxy) is pointed at
// the demo project instead of production.
//
// This module is dependency-free (no next/headers, no server-only) so it can
// be imported from both client and server. NEXT_PUBLIC_* vars are inlined by
// Next.js into the client bundle when referenced literally, as they are here.
// ============================================================

export const DEMO_COOKIE = "ov_demo";

/** Is a separate demo Supabase project configured via env? */
export function demoConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY
  );
}

/** Is production Supabase configured? */
export function prodConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** True when demo mode is both requested (cookie) AND actually configured. */
export function demoActive(cookieValue: string | undefined | null): boolean {
  return cookieValue === "1" && demoConfigured();
}

/**
 * Supabase URL + anon key for the current request. Returns the demo project's
 * credentials when demo mode is active, otherwise production. Undefined when
 * neither is configured (local JSON demo mode).
 */
export function supabaseCreds(demo: boolean): { url?: string; key?: string } {
  if (demo && demoConfigured()) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY,
    };
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
