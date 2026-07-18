import "server-only";
import { cookies } from "next/headers";
import { getDefaultEvent, getEvent } from "./data/repo";
import type { OVEvent } from "./types";

export const EVENT_COOKIE = "ov_active_event";
export const DIVISION_COOKIE = "ov_active_division";

export async function getActiveEvent(): Promise<OVEvent> {
  const store = await cookies();
  const id = store.get(EVENT_COOKIE)?.value;
  return (id ? await getEvent(id) : null) ?? (await getDefaultEvent());
}

/** Currently focused division key, or "all". */
export async function getActiveDivision(): Promise<string> {
  const store = await cookies();
  return store.get(DIVISION_COOKIE)?.value ?? "all";
}
