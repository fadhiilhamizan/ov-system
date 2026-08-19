import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import type {
  AccessCount, ActivityEntry, ActorStat, ErrorEntry, PresenceEntry, TableCount,
} from "../types";

// ============================================================
// Reads for the /developer route.
//
// A separate module from repo.ts on purpose. repo.ts is the data layer the
// whole product shares, and every getter in it is something a normal page may
// call; these are the opposite - one route reads them, they exist only when
// migration 0039 has been applied, and none of them has a local-JSON fallback
// because the audit trail is produced by database triggers that the JSON store
// has no equivalent of. Keeping them apart means nothing in the product can
// accidentally start depending on developer-only data.
//
// EVERY function here is safe to call as a non-developer: the tables are
// readable only by `is_developer()`, so a normal account gets zero rows rather
// than an error. That is deliberate. The route already 404s for them, and a
// read that throws would be a way to probe whether the feature exists at all.
// ============================================================

const sb = () => createClient();

/** Missing table / missing function: 0039 has not been run yet. */
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

/**
 * Whether the DATABASE knows this session as a developer.
 *
 * The app's own allowlist (lib/developers.ts) decides whether the menu opens;
 * this decides whether any of it has data in it. They are separate on purpose,
 * and the page tells you when only one of the two is set up - otherwise a
 * half-finished install looks exactly like a broken feature.
 */
export const developerRegistered = cache(async (): Promise<boolean> => {
  const { data, error } = await (await sb()).from("developers").select("email").limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
});

/**
 * The most recent writes, newest first.
 *
 * One unfiltered page rather than a query per filter: the panel filters in the
 * browser, which keeps every combination instant and means the export button
 * writes out exactly what is on screen. The cap is what keeps that honest - a
 * developer looking further back prunes or exports rather than scrolling.
 */
export const getActivity = cache(async (limit = 200): Promise<ActivityEntry[]> => {
  const { data, error } = await (await sb())
    .from("activity_log")
    .select("*")
    .order("at", { ascending: false })
    .limit(Math.min(limit, 500));
  if (error && !isMissing(error)) console.warn("[developer] activity:", error.message);
  return (data ?? []) as ActivityEntry[];
});

/** Per-account edit counts, aggregated in the database (see 0039). */
export const getActorStats = cache(async (): Promise<ActorStat[]> => {
  const { data, error } = await (await sb()).rpc("activity_by_actor");
  if (error && !isMissing(error)) console.warn("[developer] actor stats:", error.message);
  return (data ?? []) as ActorStat[];
});

/**
 * Everyone seen in the last few minutes.
 *
 * "Online" is a heartbeat, not a connection: a browser that crashes or a laptop
 * that sleeps never sends a goodbye, so the only honest definition is "wrote a
 * heartbeat recently". The window lives in the caller (developer/page) so the
 * same rows can be split into online / recently-here without a second query.
 */
export const getPresence = cache(async (minutes = 60): Promise<PresenceEntry[]> => {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data, error } = await (await sb())
    .from("presence")
    .select("*")
    .gte("last_seen", since)
    .order("last_seen", { ascending: false });
  if (error && !isMissing(error)) console.warn("[developer] presence:", error.message);
  return (data ?? []) as PresenceEntry[];
});

export const getErrors = cache(async (onlyOpen = false): Promise<ErrorEntry[]> => {
  let q = (await sb()).from("error_log").select("*").order("at", { ascending: false }).limit(200);
  if (onlyOpen) q = q.eq("resolved", false);
  const { data, error } = await q;
  if (error && !isMissing(error)) console.warn("[developer] errors:", error.message);
  return (data ?? []) as ErrorEntry[];
});

export const getTableCounts = cache(async (): Promise<TableCount[]> => {
  const { data, error } = await (await sb()).rpc("table_counts");
  if (error && !isMissing(error)) console.warn("[developer] table counts:", error.message);
  return (data ?? []) as TableCount[];
});

// ---------------- writes ----------------

/**
 * Record that this session is still open.
 *
 * Upsert rather than insert: one row per account, not per beat, or the table
 * would grow by one row per user per minute forever. `path` is stored so the
 * developer can see WHERE people are, which is the difference between "12
 * online" and "9 of them are stuck on the budget page".
 */
export async function touchPresence(user: {
  id: string; email: string; name: string; role: string;
}, path: string) {
  const { error } = await (await sb()).from("presence").upsert(
    {
      user_id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      path: path.slice(0, 200),
      last_seen: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  // Deliberately quiet: a heartbeat that fails must never surface to the user,
  // and before 0039 is applied it fails on every single beat.
  if (error && !isMissing(error)) console.warn("[presence]", error.message);
}

/**
 * File an error report.
 *
 * Identity is NOT taken from the caller: `user_id` and `user_email` are column
 * defaults filled from the session token, and INSERT is granted only on the
 * five descriptive columns (0039). Otherwise any session could file errors
 * under somebody else's name.
 */
export async function reportError(input: {
  kind: "client" | "boundary" | "server";
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
}) {
  const { error } = await (await sb()).from("error_log").insert({
    kind: input.kind,
    message: input.message.slice(0, 2000),
    stack: (input.stack ?? "").slice(0, 8000),
    path: (input.path ?? "").slice(0, 300),
    user_agent: (input.userAgent ?? "").slice(0, 300),
  });
  if (error && !isMissing(error)) console.warn("[error-report]", error.message);
}

export async function setErrorResolved(id: number, resolved: boolean) {
  const { error } = await (await sb()).from("error_log").update({ resolved }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteError(id: number) {
  const { error } = await (await sb()).from("error_log").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Both prune functions re-check `is_developer()` in the database themselves. */
export async function pruneActivity(days: number): Promise<number> {
  const { data, error } = await (await sb()).rpc("prune_activity_log", { keep_days: days });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function pruneErrors(days: number): Promise<number> {
  const { data, error } = await (await sb()).rpc("prune_error_log", { keep_days: days });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/**
 * Count one use of a sign-in button that needs no account.
 *
 * Goes through a SECURITY DEFINER function rather than an insert, because the
 * Demo button is pressed from the LOGIN page: the caller is the bare `anon`
 * role with no session at all. A publicly reachable insert would be a way to
 * fill a table; a publicly reachable counter can at worst inflate one number.
 *
 * Deliberately silent on failure - this runs on the way into the app, and a
 * broken counter must never stop somebody signing in.
 */
export async function recordAccess(kind: "guest" | "demo") {
  try {
    const { error } = await (await sb()).rpc("record_access", { p_kind: kind });
    if (error && !isMissing(error)) console.warn("[access-counter]", error.message);
  } catch (e) {
    console.warn("[access-counter]", e instanceof Error ? e.message : String(e));
  }
}

/** Daily guest/demo entry counts, newest first. Developers only (RLS). */
export const getAccessCounts = cache(async (days = 60): Promise<AccessCount[]> => {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await (await sb())
    .from("access_counter").select("*").gte("day", since).order("day", { ascending: false });
  if (error && !isMissing(error)) console.warn("[developer] access counts:", error.message);
  return (data ?? []).map((r) => ({ ...r, hits: Number(r.hits) })) as AccessCount[];
});
