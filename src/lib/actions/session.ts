"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, DEMO_USERS, GUEST_COOKIE } from "@/lib/auth";
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
 * Demo-only identity switch (the RoleSwitcher in the demo sandbox).
 *
 * The `demoActive` guard is load-bearing. `getCurrentUser()` happens to ignore
 * AUTH_COOKIE outside demo mode, so this was inert in production — but by
 * accident of control flow, not by a check. One reordering in auth.ts and it
 * would have become privilege escalation.
 */
export async function setRole(userId: string) {
  const store = await cookies();
  if (!demoActive(store.get(DEMO_COOKIE)?.value)) return;
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
