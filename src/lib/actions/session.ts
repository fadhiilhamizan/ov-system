"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, DEMO_USERS, GUEST_COOKIE } from "@/lib/auth";
import { EVENT_COOKIE, DIVISION_COOKIE } from "@/lib/session";
import { recordAccess } from "@/lib/data/developer-repo";
import { LANG_COOKIE } from "@/lib/i18n/config";
import { DEMO_COOKIE, demoActive, demoConfigured } from "@/lib/demo";
import { getEvent } from "@/lib/data/repo";
import { isShareModule, shareLanding } from "@/lib/share";
import { idSchema, parse } from "./schemas";

const YEAR = 60 * 60 * 24 * 365;

/**
 * Defaults for the app's own cookies (none of them carry a secret, but there is
 * no reason to hand them to page JS or send them over plaintext HTTP).
 *
 * `ov_demo` is the deliberate exception: `supabase/client.ts` reads it from
 * `document.cookie` in the browser to decide which project to talk to, so it
 * must stay readable - see DEMO_OPTS below.
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
 * Identity switch for the RoleSwitcher. Demo identities only - never a path to
 * a real role.
 *
 * The guard is load-bearing: `getCurrentUser()` happens to ignore AUTH_COOKIE
 * when a production Supabase session is in play, so this was inert there - but
 * by accident of control flow, not by a check. One reordering in auth.ts and it
 * would have become privilege escalation.
 *
 * It must mirror exactly the case where `getCurrentUser()` returns a DEMO_USERS
 * identity, which since v1.42.0 is only one: the demo sandbox (`ov_demo` cookie
 * plus a demo project configured). There used to be a second, local development
 * with no Supabase at all, and an earlier cut of this check covered only the
 * first - the switcher menu rendered and the click did nothing.
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
  // Division keys belong to one edition; a focus carried into another one
  // matches nothing (see pruneDivisionFocus). Start the new edition unfiltered.
  store.set(DIVISION_COOKIE, "all", COOKIE_OPTS);
  revalidatePath("/", "layout");
}

/**
 * Write "all" rather than deleting the cookie. A deleted cookie is still
 * present in the request store for the rest of that render, with `value: ""` -
 * which used to reach the Work Breakdown as a division key matching no task.
 * See getActiveDivision in lib/session.ts.
 */
export async function setActiveDivision(division: string) {
  const store = await cookies();
  store.set(DIVISION_COOKIE, division || "all", COOKIE_OPTS);
  // No revalidation. The Work Breakdown already applied the tick locally; the
  // cookie is only read on the NEXT page load. Revalidating the whole layout
  // here re-fetched every list on every tick and re-rendered the page under
  // the open filter menu.
}

export async function setLang(lang: "id" | "en") {
  const store = await cookies();
  store.set(LANG_COOKIE, lang, COOKIE_OPTS);
  revalidatePath("/", "layout");
}

export async function enterGuestMode() {
  const store = await cookies();
  store.set(GUEST_COOKIE, "1", COOKIE_OPTS);
  // Counted before the redirect, since redirect() throws to unwind. Awaited
  // rather than fired and forgotten: a server action that returns while a
  // write is still in flight can have it cancelled with the request.
  await recordAccess("guest");
  redirect("/dashboard");
}

export async function exitGuestMode() {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
  redirect("/login");
}

/**
 * The second half of opening a share link (/s/<edition>/<menu>, see
 * lib/share.ts). The landing page has already made sure there is a session -
 * the visitor's own, or a fresh anonymous Tamu one - and calls this to pick the
 * edition and learn where to go. Returns the in-app path instead of
 * redirecting, so the landing can show a readable error when the edition in
 * the link no longer exists.
 */
export async function openShareAction(input: {
  event: string;
  module: string;
  /** The link points into the demo database. */
  demo?: boolean;
  /** The landing just started an anonymous session for this visit. */
  guest?: boolean;
  query?: Record<string, string>;
}): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  if (!isShareModule(input.module)) return { ok: false, error: "Menu di tautan ini tidak bisa dibagikan." };
  const idv = parse(idSchema, input.event);
  if (!idv.ok) return idv;
  const store = await cookies();

  if (input.demo) {
    if (!demoConfigured()) return { ok: false, error: "Mode demo tidak tersedia di server ini." };
    const already = demoActive(store.get(DEMO_COOKIE)?.value);
    if (!already) {
      // Counted before the cookie, for the same reason as enterDemoMode.
      await recordAccess("demo");
      store.set(DEMO_COOKIE, "1", DEMO_OPTS);
      // A shared demo link opens read-only, like a real one: as the demo Tamu.
      store.set(AUTH_COOKIE, "u-guest", COOKIE_OPTS);
    }
  } else {
    // A real link must never be read through the demo database.
    if (demoActive(store.get(DEMO_COOKIE)?.value)) store.delete(DEMO_COOKIE);
    if (input.guest) {
      store.set(GUEST_COOKIE, "1", COOKIE_OPTS);
      await recordAccess("guest");
    }
    // Checked through the visitor's own session, so RLS has its say too.
    let exists = false;
    try { exists = !!(await getEvent(idv.data)); } catch { exists = false; }
    if (!exists) {
      return { ok: false, error: "Ormawa Visit di tautan ini tidak ditemukan. Mungkin sudah dihapus, atau tautannya terpotong." };
    }
  }

  store.set(EVENT_COOKIE, idv.data, COOKIE_OPTS);
  store.set(DIVISION_COOKIE, "all", COOKIE_OPTS);
  return { ok: true, href: shareLanding(input.module, input.query ?? {}) };
}

/** Enter the demo sandbox (separate Supabase database, no account needed). */
export async function enterDemoMode() {
  if (!demoConfigured()) redirect("/login");
  const store = await cookies();
  // Counted BEFORE the cookie is set, and that order matters: once ov_demo is
  // present every Supabase client in the process points at the demo database,
  // so the tally would land in the throwaway project instead of the real one.
  await recordAccess("demo");
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
