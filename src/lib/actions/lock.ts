import "server-only";
import { getEvent } from "@/lib/data/repo";
import { canWriteEvent } from "@/lib/permissions";
import type { AppUser } from "@/lib/types";

export type Fail = { ok: false; error: string };

export const ARCHIVED: Fail = {
  ok: false,
  error: "Ormawa Visit ini sudah diarsipkan. Minta admin membuka kuncinya dulu.",
};

/**
 * Refuse a write that targets an archived Ormawa Visit.
 *
 * Returns a Fail to hand straight back from the action, or null when the write
 * may proceed. Admins always pass, and so does a write with no edition scope
 * (legacy rows whose event_id is null).
 *
 * This is the UX half only — `writable_event()` in migration 0028 is the real
 * control, and it still applies when the request bypasses this function.
 * Its job here is to produce a sentence a committee member can act on instead
 * of a raw "new row violates row-level security policy".
 */
export async function archivedGuard(
  user: AppUser,
  eventId?: string | null,
): Promise<Fail | null> {
  if (user.role === "admin" || !eventId) return null;
  const event = await getEvent(eventId);
  return canWriteEvent(user, event) ? null : ARCHIVED;
}

/**
 * Turn a thrown repo error into a Result the UI can toast.
 *
 * Repo writes throw on any Supabase error (see `must()` in data/repo.ts), which
 * is what makes an RLS denial visible instead of a save that never happened.
 */
export function errMsg(e: unknown, fallback = "Gagal menyimpan data."): Fail {
  return {
    ok: false,
    error: e instanceof Error ? `Gagal menyimpan: ${e.message}` : fallback,
  };
}
