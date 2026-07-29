"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, DEMO_USERS, GUEST_COOKIE, USE_SUPABASE } from "@/lib/auth";
import { EVENT_COOKIE, DIVISION_COOKIE } from "@/lib/session";
import { LANG_COOKIE } from "@/lib/i18n/config";
import { DEMO_COOKIE, demoActive, demoConfigured } from "@/lib/demo";

const YEAR = 60 * 60 * 24 * 365;

/**
 * Defaults for the app's own cookies (none of them carry a secret, but there is
 * no reason to hand them to page JS or send them over plaintext HTTP).
 *
 * `ov_demo` is the deliberate exception: `supabase/client.ts` reads it from
 * `document.cookie` in the browser to decide which project to talk to, so it
 * must stay readable — see DEMO_OPTS below.
 */
const COOKIE_OPTS = {
  path: "/",
  maxAge: YEAR,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
};

/** Same, but readable by client JS. Only for `ov_demo`. */
const DEMO_OPTS = { ...COOKIE_OPTS, httpOnly: false };

/**
 * Identity switch for the RoleSwitcher. Demo identities only — never a path to
 * a real role.
 *
 * The guard is load-bearing: `getCurrentUser()` happens to ignore AUTH_COOKIE
 * when a production Supabase session is in play, so this was inert there — but
 * by accident of control flow, not by a check. One reordering in auth.ts and it
 * would have become privilege escalation.
 *
 * It must mirror exactly the two cases where `getCurrentUser()` returns a
 * DEMO_USERS identity: the demo sandbox (`ov_demo` cookie + demo project
 * configured), and local development with no Supabase configured at all.
 * An earlier cut checked only the first, which silently broke the switcher in
 * local mode — the menu rendered, the click did nothing.
 */
export async function setRole(userId: string) {
  const store = await cookies();
  const demoIdentities = demoActive(store.get(DEMO_COOKIE)?.value) || !USE_SUPABASE;
  if (!demoIdentities) return;
  if (!DEMO_USERS.some((u) => u.id === userId)) return;
  store.set(AUTH_COOKIE, userId, COOKIE_OPTS);
  revalidatePath("/", "layout");
}

export async function setActiveEvent(eventId: string) {
  const store = await cookies();
  store.set(EVENT_COOKIE, eventId, COOKIE_OPTS);
  revalidatePath("/", "layout");
}

/**
 * Write "all" rather than deleting the cookie. A deleted cookie is still
 * present in the request store for the rest of that render, with `value: ""` —
 * which used to reach the Work Breakdown as a division key matching no task.
 * See getActiveDivision in lib/session.ts.
 */
export async function setActiveDivision(division: string) {
  const store = await cookies();
  store.set(DIVISION_COOKIE, division || "all", COOKIE_OPTS);
  revalidatePath("/", "layout");
}

export async function setLang(lang: "id" | "en") {
  const store = await cookies();
  store.set(LANG_COOKIE, lang, COOKIE_OPTS);
  revalidatePath("/", "layout");
}

export async function enterGuestMode() {
  const store = await cookies();
  store.set(GUEST_COOKIE, "1", COOKIE_OPTS);
  redirect("/dashboard");
}

export async function exitGuestMode() {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
  redirect("/login");
}

/** Enter the demo sandbox (separate Supabase database, no account needed). */
export async function enterDemoMode() {
  if (!demoConfigured()) redirect("/login");
  const store = await cookies();
  store.set(DEMO_COOKIE, "1", DEMO_OPTS);
  // Reset the demo identity to the default (admin) each time.
  store.delete(AUTH_COOKIE);
  redirect("/dashboard");
}

export async function exitDemoMode() {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  store.delete(AUTH_COOKIE);
  redirect("/login");
}
