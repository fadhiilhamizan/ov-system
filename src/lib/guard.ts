import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { can } from "./permissions";
import { isDeveloper } from "./developers";
import type { AppUser } from "./types";

/**
 * Server-side route guard. The sidebar hides modules a role can't open, but
 * that's cosmetic - a direct URL, a back-button, or switching role while
 * already on the page would still render restricted content. Call this at the
 * top of every page whose module has a "none" level for some role
 * (see MODULE_ACCESS_LEVEL): links, budget, settings.
 *
 * Also returns the user, so pages can use it in place of getCurrentUser().
 */
export async function requireModule(moduleKey: string): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!can.accessModule(user, moduleKey)) redirect("/dashboard");
  return user;
}

/**
 * Guard for the hidden /developer route.
 *
 * notFound(), NOT redirect(). A redirect to the dashboard tells an unauthorised
 * visitor that the path exists and is merely off-limits, which is the one thing
 * a route nobody is supposed to know about must not do. A 404 is
 * indistinguishable from a path that was never built.
 *
 * This is the UX half of the fence. The real one is RLS: every table the page
 * reads is gated by is_developer() in the database, so even a forged session
 * calling PostgREST directly gets nothing back. See src/lib/developers.ts.
 */
export async function requireDeveloper(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!isDeveloper(user)) notFound();
  return user;
}
