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

/**
 * Currently focused division key, or "all".
 *
 * The fallback MUST be `||`, not `??`. Deleting a cookie inside a Server Action
 * does not remove it from the request store - reading it back in that same
 * render returns `{ value: "" }`, and `??` only catches null/undefined. The
 * empty string then flowed through as a division key that matches no task, so
 * switching the focus back to "Semua Divisi" emptied the whole Work Breakdown
 * until the next hard refresh. `setActiveDivision` now also writes "all"
 * explicitly rather than deleting, so this is belt and braces.
 */
export const getActiveDivision = cache(async (): Promise<string> => {
  const store = await cookies();
  return store.get(DIVISION_COOKIE)?.value || "all";
});
