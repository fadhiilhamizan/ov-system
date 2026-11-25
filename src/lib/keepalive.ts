// ============================================================
// Supabase keep-alive.
//
// Both Supabase projects (production and demo) are on the free tier, which
// PAUSES a project after about a week without activity. A paused project
// stops resolving at all, so the whole site looks down even though Vercel is
// fine. That happened on 2026-11-02 (demo) and 2026-11-25 (both).
//
// The Vercel Cron in vercel.json calls /api/cron/keepalive every 5 days, and
// that route runs one tiny query against each project here. It uses the
// PUBLIC anon key and reads through RLS like any visitor would: an anonymous
// caller gets zero rows back from `events`, but the query still runs on
// Postgres, and that is the activity Supabase counts. No service-role key, no
// data returned to the caller (see AGENTS.md, "Backups are manual only").
// ============================================================

export interface KeepAliveTarget {
  name: "production" | "demo";
  url: string;
  anonKey: string;
}

export interface KeepAliveResult {
  name: KeepAliveTarget["name"];
  ok: boolean;
  status: number;
  error?: string;
}

/** The projects configured in this environment. A missing pair is skipped. */
export function keepAliveTargets(env: Record<string, string | undefined> = process.env): KeepAliveTarget[] {
  const out: KeepAliveTarget[] = [];
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    out.push({ name: "production", url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  }
  if (env.NEXT_PUBLIC_SUPABASE_DEMO_URL && env.NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY) {
    out.push({ name: "demo", url: env.NEXT_PUBLIC_SUPABASE_DEMO_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY });
  }
  return out;
}

/**
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when that variable is set
 * on the project. When it is set we require it; when it is not, the route is
 * open, which is harmless: it runs the same query anyone can already run with
 * the public anon key, and it returns no data.
 */
export function isCronAuthorized(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return true;
  return authHeader === `Bearer ${secret}`;
}

/** One minimal PostgREST read. Never throws: a failure is reported, not raised. */
export async function pingProject(
  target: KeepAliveTarget,
  fetchImpl: typeof fetch = fetch,
): Promise<KeepAliveResult> {
  const endpoint = `${target.url.replace(/\/+$/, "")}/rest/v1/events?select=id&limit=1`;
  try {
    const res = await fetchImpl(endpoint, {
      headers: { apikey: target.anonKey, Authorization: `Bearer ${target.anonKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return { name: target.name, ok: res.ok, status: res.status };
  } catch (e) {
    return { name: target.name, ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
