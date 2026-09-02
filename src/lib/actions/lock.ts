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
 * This is the UX half only - `writable_event()` in migration 0028 is the real
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
 * Explain the two database errors a committee member can actually act on.
 *
 * Both arrive as raw Postgres/PostgREST prose that reads like a crash, and both
 * have a specific cause and a specific fix:
 *
 *   - an RLS denial means the row was NOT written. Usually the archive lock, or
 *     a role that may not write here; but when it fires for every button on a
 *     menu it is almost always a database that has not had the latest access
 *     script applied (this is exactly how the whole Himpunan menu failed in Mode
 *     Demo, where four tables still had RLS switched on).
 *   - a missing function or column means this database is behind the app.
 *
 * The raw sentence is KEPT on the end, never swallowed: the whole point of
 * `must()` throwing is that a failed write is visible, and whoever has to fix
 * the database needs the exact wording.
 */
function explain(raw: string): string {
  if (/row-level security|violates row-level/i.test(raw)) {
    return "Perubahan ditolak database. Kalau Ormawa Visit ini tidak diarsipkan dan perananmu seharusnya boleh mengubahnya, artinya database belum dijalankan skrip aksesnya yang terbaru (supabase/setup.sql, atau demo-open-access.sql untuk Mode Demo). Detail: " + raw;
  }
  if (/Could not find the (function|column|table)|does not exist|schema cache/i.test(raw)) {
    return "Database ini belum punya bagian yang dibutuhkan fitur tersebut. Jalankan supabase/setup.sql (atau demo-seed.sql untuk Mode Demo) lebih dulu. Detail: " + raw;
  }
  return `Gagal menyimpan: ${raw}`;
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
    error: e instanceof Error ? explain(e.message) : fallback,
  };
}
