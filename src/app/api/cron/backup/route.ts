import { NextResponse, type NextRequest } from "next/server";
import { createBackup } from "@/lib/backup";

/**
 * Scheduled automatic backup. Triggered by Vercel Cron (see vercel.json).
 * Protected by a shared secret so it can't be triggered by anyone else.
 * Requires NEXT_PUBLIC_SUPABASE_URL/ANON_KEY and CRON_SECRET to be set.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi." }, { status: 501 });
  }

  const auth = request.headers.get("authorization");
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 501 });
  }

  try {
    const id = await createBackup("auto");
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Backup gagal." }, { status: 500 });
  }
}
