import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. **BYPASSES RLS ENTIRELY** — every row of every
 * table, no session, no policy.
 *
 * Permitted caller: the scheduled backup route (`/api/cron/backup`) and nothing
 * else. That route has its own authentication (a shared secret) and runs with
 * no user session at all, which is the one situation the cookie-scoped client
 * in `server.ts` cannot serve: a Vercel Cron request carries no cookies, so
 * `auth.uid()` is null and every read returns zero rows.
 *
 * FORBIDDEN: any Server Action, any Server Component, any route reachable from
 * a user request, anything under `src/components`. RLS is the only real
 * authorization boundary in this app (the anon key is public and the session
 * token lives in the user's browser) — a single service-role query behind a
 * user-facing endpoint silently deletes every guarantee the policies make.
 *
 * `server-only` makes importing this from a client component a build error.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum dikonfigurasi.");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi — backup terjadwal tidak bisa membaca data.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
