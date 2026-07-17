import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppUser, Role } from "./types";
import { AUTH_COOKIE, DEMO_USERS } from "./demo-users";
import { createClient } from "./supabase/server";

export { AUTH_COOKIE, DEMO_USERS };

export const USE_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Returns the current user. In Supabase mode this reads the auth session +
 * profile, redirecting to /login when unauthenticated. In demo mode it
 * returns the cookie-selected demo identity.
 */
export async function getCurrentUser(): Promise<AppUser> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    return {
      id: user.id,
      name: profile?.name || user.email!.split("@")[0],
      email: user.email ?? "",
      role: (profile?.role as Role) ?? "viewer",
      division: profile?.division ?? null,
      avatarColor: profile?.avatar_color ?? undefined,
    };
  }

  const store = await cookies();
  const id = store.get(AUTH_COOKIE)?.value;
  return DEMO_USERS.find((u) => u.id === id) ?? DEMO_USERS[0];
}
