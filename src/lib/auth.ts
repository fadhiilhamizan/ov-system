import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppUser, Role } from "./types";
import { AUTH_COOKIE, DEMO_USERS } from "./demo-users";
import { createClient } from "./supabase/server";
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

function normalizeRole(r: string | null | undefined): Role {
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (store.get(GUEST_COOKIE)?.value === "1") return GUEST_USER;
      return null;
    }

    // Guest mode signs in anonymously (so reads pass RLS without exposing the
    // tables to the bare anon key). Anonymous users are always the read-only
    // guest identity - never look up a profile / real role for them.
    if (user.is_anonymous) return GUEST_USER;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
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
    };
  }
});
