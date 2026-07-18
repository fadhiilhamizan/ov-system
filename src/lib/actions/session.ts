"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, DEMO_USERS, GUEST_COOKIE } from "@/lib/auth";
import { EVENT_COOKIE, DIVISION_COOKIE } from "@/lib/session";
import { LANG_COOKIE } from "@/lib/i18n/config";
import { resetDb } from "@/lib/data/store";

const YEAR = 60 * 60 * 24 * 365;

export async function setRole(userId: string) {
  if (!DEMO_USERS.some((u) => u.id === userId)) return;
  const store = await cookies();
  store.set(AUTH_COOKIE, userId, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setActiveEvent(eventId: string) {
  const store = await cookies();
  store.set(EVENT_COOKIE, eventId, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setActiveDivision(division: string) {
  const store = await cookies();
  if (division === "all") store.delete(DIVISION_COOKIE);
  else store.set(DIVISION_COOKIE, division, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setLang(lang: "id" | "en") {
  const store = await cookies();
  store.set(LANG_COOKIE, lang, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function enterGuestMode() {
  const store = await cookies();
  store.set(GUEST_COOKIE, "1", { path: "/", maxAge: YEAR, sameSite: "lax" });
  redirect("/dashboard");
}

export async function exitGuestMode() {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
  redirect("/login");
}

export async function resetDemoData() {
  resetDb();
  revalidatePath("/", "layout");
}
