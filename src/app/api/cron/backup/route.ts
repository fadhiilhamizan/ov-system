import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createBackup } from "@/lib/backup";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scheduled automatic backup. Triggered by Vercel Cron (see vercel.json).
 *
 * Two things make this route different from everything else in the app:
 *  - It authenticates with a shared secret, not a user session.
 *  - It therefore has to use the SERVICE-ROLE client. A cron request carries no
 *    cookies, so the normal cookie-scoped client has `auth.uid() = null`, and
 *    since the RLS hardening that means it reads zero rows from every table.
 *    That is why this had been failing silently for weeks: no data, no backup,
 *    no error anyone saw.
 */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Compare lengths separately — timingSafeEqual throws on a length mismatch,
  // and a thrown exception is itself an observable difference.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi." }, { status: 501 });
  }

  // Header only. A `?secret=` query parameter is written to Vercel's access
  // logs and leaks through the Referer header; Vercel Cron sends the
  // Authorization header anyway, so the fallback bought nothing.
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 501 });
  }

  try {
    const id = await createBackup("auto", undefined, createAdminClient());
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Backup gagal." },
      { status: 500 },
    );
  }
}
