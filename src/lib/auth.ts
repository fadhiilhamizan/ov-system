import "server-only";
import { cookies } from "next/headers";
import type { AppUser } from "./types";
import { AUTH_COOKIE, DEMO_USERS } from "./demo-users";

// ------------------------------------------------------------------
// Demo authentication (local backend). A cookie stores which demo
// identity is active so the tiered RBAC can be explored without a live
// auth provider. When Supabase is configured, getCurrentUser() reads
// the real session + profile instead.
// ------------------------------------------------------------------

export { AUTH_COOKIE, DEMO_USERS };

export async function getCurrentUser(): Promise<AppUser> {
  const store = await cookies();
  const id = store.get(AUTH_COOKIE)?.value;
  return DEMO_USERS.find((u) => u.id === id) ?? DEMO_USERS[0];
}
