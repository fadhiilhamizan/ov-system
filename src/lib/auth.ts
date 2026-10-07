import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppUser, Role } from "./types";
import { AUTH_COOKIE, DEMO_USERS } from "./demo-users";
import { createClient } from "./supabase/server";
import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";
import { DEMO_COOKIE, demoActive } from "./demo";

export { AUTH_COOKIE, DEMO_USERS };

export const GUEST_COOKIE = "ov_guest";

const GUEST_USER: AppUser = {
  id: "guest",
  name: "Tamu",
  email: "",
  role: "guest",
  avatarColor: "#94a3b8",
};

/**
 * Database bilang 'viewer', aplikasi bilang 'guest'.
 *
 * Diekspor karena `getAccounts` di data/repo.ts membaca `profiles.role`
 * mentah-mentah dan butuh pemetaan yang SAMA. Menyalinnya ke sana akan jadi
 * dua definisi untuk satu fakta, dan yang meleset diam-diam adalah yang tidak
 * pernah dipanggil di jalur yang diuji.
 */
export function normalizeRole(r: string | null | undefined): Role {
  if (r === "viewer") return "guest"; // legacy value support
  if (r === "admin" || r === "coordinator" || r === "staff" || r === "intern" || r === "guest") return r;
  return "guest";
}

/**
 * Returns the current user. In Supabase mode this reads the auth session +
 * profile, allows a guest bypass (cookie), or redirects to /login. In demo
 * mode it returns the cookie-selected demo identity.
 *
 * Anything that must NOT redirect - a background beacon, say - calls
 * `getOptionalUser` below instead.
 */
export const getCurrentUser = async (): Promise<AppUser> => {
  const user = await readUser();
  // No session and no guest cookie: this is a page load by somebody who is not
  // signed in. `redirect` throws, so nothing below runs.
  if (!user) redirect("/login");
  return user;
};

/**
 * The same identity read, but it returns null instead of redirecting.
 *
 * For the background beacons (presence, error reports), which run on a timer in
 * everybody's tab and are meant to be completely silent. `getCurrentUser` ends
 * an expired session by throwing a redirect, and a beacon that does that yanks
 * the person off the page they were working on - once a minute - over a feature
 * they cannot even see. Worse, the throw escaped the action as a rejected
 * promise, and the unhandled-rejection listener in the same component filed it
 * as an error report, which took the same path and rejected again.
 */
export const getOptionalUser = async (): Promise<AppUser | null> => readUser();

/** Shared body, and the one that carries the per-request cache, so calling both
 *  wrappers in one request is still a single auth round trip. Returns null
 *  where a page would be sent to /login. */
const readUser = cache(async (): Promise<AppUser | null> => {
  const store = await cookies();

  // Demo mode: a separate database, entered without an account. Identity comes
  // from the demo-user switcher (defaults to admin) so the whole system can be
  // explored freely. No production auth, no login redirect.
  if (demoActive(store.get(DEMO_COOKIE)?.value)) {
    const id = store.get(AUTH_COOKIE)?.value;
    return DEMO_USERS.find((u) => u.id === id) ?? DEMO_USERS[0];
  }

  const supabase = await createClient();
  {
    const user = await verifiedUser(supabase);

    if (!user) {
      if (store.get(GUEST_COOKIE)?.value === "1") return GUEST_USER;
      return null;
    }

    // Guest mode signs in anonymously (so reads pass RLS without exposing the
    // tables to the bare anon key). Anonymous users are always the read-only
    // guest identity - never look up a profile / real role for them.
    if (user.is_anonymous) return GUEST_USER;

    const profile = await readProfile(supabase, user.id);
    // The token itself was rejected by the database: the session is over.
    if (profile === SIGNED_OUT) return null;
    // NOTE: profiles.division / profiles.event_id are deliberately NOT read.
    // An account has no division and no edition scope - see AppUser in types.ts
    // and migration 0028, which removed the same assumption from RLS.
    return {
      id: user.id,
      // `user.email!` used to be here. An account is not guaranteed to have
      // one - a phone or a provider that returns none - and the assertion turns
      // that into a crash on EVERY page rather than a missing display name.
      name: profile?.name || user.email?.split("@")[0] || "Pengguna",
      email: user.email ?? "",
      role: normalizeRole(profile?.role),
      avatarColor: profile?.avatar_color ?? undefined,
      avatar: profile?.avatar ?? null,
      isShared: profile?.is_shared === true,
    };
  }
});


// ------------------------------------------------------------------
// Why a hiccup must not look like "signed out"
//
// Both reads below used to treat ANY failure as the absence of a session.
// `getUser()` is a network call to Supabase Auth on every request, and every
// request comes from the same few server IPs, so a blip or a rate limit (429)
// made it return no user - and `getCurrentUser` answered that with
// redirect("/login"). Mid-edit, inside a Server Action, that threw the person
// out of the page and dropped what they had just typed. That was the
// "terpental dan tidak tersimpan" report. The profile read had the same flaw
// one step later: a failed read gave `profile = null`, so the role silently
// became Tamu and every write was refused with "tidak punya akses".
//
// Now a TRANSIENT failure (network, 5xx, 429) falls back to the session the
// cookie already carries, and the profile read is retried and otherwise
// surfaces as an error. The cookie's identity is only trusted together with a
// successful profile read made WITH that token: PostgREST verifies the JWT
// signature, so a forged cookie fails right there (and is treated as signed
// out). RLS was always the real boundary; this does not move it.
// ------------------------------------------------------------------

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Is this auth error a temporary problem rather than a verdict on the token? */
export function isTransientAuthError(error: unknown): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;
  const status = (error as { status?: number }).status ?? 0;
  return status === 0 || status === 429 || status >= 500;
}

async function verifiedUser(supabase: ServerClient): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (data.user) return data.user;
  if (!isTransientAuthError(error)) return null;
  // Auth is unreachable or rate-limited right now. The session in the cookie
  // is still the best evidence of who this is; the profile read that follows
  // is made with its token, so the database gets the final say.
  const { data: s } = await supabase.auth.getSession();
  if (s.session?.user) {
    console.warn(`[auth] getUser failed transiently (${(error as Error)?.message ?? "unknown"}); using the session cookie`);
  }
  return s.session?.user ?? null;
}

const SIGNED_OUT = Symbol("signed-out");

type Profile = {
  name?: string | null;
  role?: string | null;
  avatar_color?: string | null;
  avatar?: string | null;
  is_shared?: boolean | null;
};

/** The JWT was rejected by PostgREST (expired, revoked or forged). */
function isTokenRejected(error: { code?: string; message?: string; status?: number }): boolean {
  return error.code === "PGRST301" || error.code === "PGRST303" || /jwt|jws/i.test(error.message ?? "");
}

async function readProfile(supabase: ServerClient, id: string): Promise<Profile | null | typeof SIGNED_OUT> {
  let lastError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (!error) return (data as Profile | null) ?? null;
    if (isTokenRejected(error)) return SIGNED_OUT;
    lastError = error;
    await new Promise((r) => setTimeout(r, 250));
  }
  // Not "no profile" and not "signed out": the read failed. Saying so beats
  // quietly demoting an admin to Tamu for the rest of this request.
  throw new Error(`profile: ${lastError?.message ?? "read failed"}${lastError?.code ? ` (${lastError.code})` : ""}`);
}
