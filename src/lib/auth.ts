import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppUser, Role } from "./types";
import { AUTH_COOKIE, DEMO_USERS } from "./demo-users";
import { createClient } from "./supabase/server";
import { DEMO_COOKIE, demoActive, demoConfigured } from "./demo";

export { AUTH_COOKIE, DEMO_USERS };

// Supabase-backed when EITHER production or a demo project is configured.
export const USE_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL || demoConfigured();
export const GUEST_COOKIE = "ov_guest";

const GUEST_USER: AppUser = {
  id: "guest",
  name: "Tamu",
  email: "",
  role: "guest",
  division: null,
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
 */
export const getCurrentUser = cache(async (): Promise<AppUser> => {
  const store = await cookies();

  // Demo mode: a separate database, entered without an account. Identity comes
  // from the demo-user switcher (defaults to admin) so the whole system can be
  // explored freely. No production auth, no login redirect.
  if (demoActive(store.get(DEMO_COOKIE)?.value)) {
    const id = store.get(AUTH_COOKIE)?.value;
    return DEMO_USERS.find((u) => u.id === id) ?? DEMO_USERS[0];
  }

  if (USE_SUPABASE) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (store.get(GUEST_COOKIE)?.value === "1") return GUEST_USER;
      redirect("/login");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    return {
      id: user.id,
      name: profile?.name || user.email!.split("@")[0],
      email: user.email ?? "",
      role: normalizeRole(profile?.role),
      division: profile?.division ?? null,
      avatarColor: profile?.avatar_color ?? undefined,
    };
  }

  const id = store.get(AUTH_COOKIE)?.value;
  return DEMO_USERS.find((u) => u.id === id) ?? DEMO_USERS[0];
});
