import "server-only";
import type { AppUser } from "./types";

// ============================================================
// The Developer layer.
//
// WHY IT IS NOT A ROLE. `Role` is the axis the whole system is built on:
// MODULE_ACCESS_LEVEL enumerates it, the Settings matrix renders it, role
// requests offer it, permissions.ts derives every `can.*` from it, and the
// Panduan documents it. Adding a sixth value would put "Developer" on screen in
// five different places, which is the exact opposite of what this is for.
//
// So a developer is an EMAIL, layered on top of whatever role the account
// already has. They stay Admin (or Staff, or nothing at all) everywhere in the
// product; the only thing the layer grants is one route that is not registered
// in the nav, the access matrix, the guide, or Violet's link table.
//
// TWO LISTS, ON PURPOSE. This one decides whether the menu exists for you. The
// `developers` TABLE decides whether the data is readable, because RLS is the
// only real boundary here (the anon key is public, so PostgREST can be called
// directly). Same split as `can.*` versus a policy: one is the door handle, the
// other is the lock. `developerStatus()` reports when they disagree, since a
// developer who has done half the setup would otherwise just see empty tables
// and assume the feature is broken.
//
// NOT IN THE REPO. The addresses live in `DEVELOPER_EMAILS` (.env.local, and
// the host's environment variables in production) and in
// supabase/developers.local.sql. Both are gitignored: this repository is
// public, and the address IS the key.
// ============================================================

/** No NEXT_PUBLIC_ prefix: this must never reach a browser bundle. */
function configuredEmails(): string[] {
  return (process.env.DEVELOPER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Is this address on the allowlist? Case-insensitive; blank is never a match. */
export function isDeveloperEmail(email: string | null | undefined): boolean {
  const value = (email ?? "").trim().toLowerCase();
  if (!value) return false;
  return configuredEmails().includes(value);
}

/**
 * Is this account a developer?
 *
 * Guests are excluded outright even if their address somehow matched: the
 * anonymous "Tamu" identity is shared and carries no real email, and the demo
 * identities are fictional addresses in a throwaway database.
 */
export function isDeveloper(user: AppUser | null | undefined): boolean {
  if (!user || user.role === "guest") return false;
  return isDeveloperEmail(user.email);
}

/** True when at least one address is configured, i.e. the layer is in use. */
export function developerLayerConfigured(): boolean {
  return configuredEmails().length > 0;
}

/** How many addresses are configured. Never the addresses themselves. */
export function developerCount(): number {
  return configuredEmails().length;
}
