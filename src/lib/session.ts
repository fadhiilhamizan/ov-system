import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getDefaultEvent, getEvent } from "./data/repo";
import type { OVEvent } from "./types";

export const EVENT_COOKIE = "ov_active_event";
export const DIVISION_COOKIE = "ov_active_division";

export const getActiveEvent = cache(async (): Promise<OVEvent> => {
  const store = await cookies();
  const id = store.get(EVENT_COOKIE)?.value;
  return (id ? await getEvent(id) : null) ?? (await getDefaultEvent());
});

/** Currently focused division key, or "all". */
export const getActiveDivision = cache(async (): Promise<string> => {
  const store = await cookies();
  return store.get(DIVISION_COOKIE)?.value ?? "all";
});
