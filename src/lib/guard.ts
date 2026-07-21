import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { can } from "./permissions";
import type { AppUser } from "./types";

/**
 * Server-side route guard. The sidebar hides modules a role can't open, but
 * that's cosmetic — a direct URL, a back-button, or switching role while
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
