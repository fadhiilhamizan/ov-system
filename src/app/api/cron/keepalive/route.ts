import { NextResponse } from "next/server";
import { isCronAuthorized, keepAliveTargets, pingProject } from "@/lib/keepalive";

// Called by the Vercel Cron in vercel.json every 5 days so the free-tier
// Supabase projects are never idle long enough to be paused. See
// src/lib/keepalive.ts for why this is safe without a service-role key.
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const results = await Promise.all(keepAliveTargets().map((t) => pingProject(t)));
  const ok = results.length > 0 && results.every((r) => r.ok);
  if (!ok) console.error("[keepalive] ping failed", results);

  // 500 on failure so the run shows as failed in the Vercel Cron log.
  return NextResponse.json({ ok, at: new Date().toISOString(), results }, { status: ok ? 200 : 500 });
}
