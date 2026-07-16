"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AUTH_COOKIE, DEMO_USERS } from "@/lib/auth";
import { EVENT_COOKIE } from "@/lib/session";
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

export async function resetDemoData() {
  resetDb();
  revalidatePath("/", "layout");
}
