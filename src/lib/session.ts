import "server-only";
import { cookies } from "next/headers";
import { getDefaultEvent, getEvent } from "./data/repo";
import type { OVEvent } from "./types";

export const EVENT_COOKIE = "ov_active_event";

export async function getActiveEvent(): Promise<OVEvent> {
  const store = await cookies();
  const id = store.get(EVENT_COOKIE)?.value;
  return (id && getEvent(id)) || getDefaultEvent();
}
