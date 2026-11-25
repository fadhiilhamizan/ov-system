import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isCronAuthorized, keepAliveTargets, pingProject } from "./keepalive";

const root = join(__dirname, "..", "..");

describe("keepAliveTargets", () => {
  it("lists production and demo when both are configured", () => {
    const t = keepAliveTargets({
      NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "pk",
      NEXT_PUBLIC_SUPABASE_DEMO_URL: "https://d.supabase.co",
      NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY: "dk",
    });
    expect(t.map((x) => x.name)).toEqual(["production", "demo"]);
  });

  it("skips a project whose url or key is missing", () => {
    const t = keepAliveTargets({ NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co", NEXT_PUBLIC_SUPABASE_DEMO_URL: "https://d.supabase.co" });
    expect(t).toEqual([]);
  });
});

describe("isCronAuthorized", () => {
  it("is open when no CRON_SECRET is set", () => {
    expect(isCronAuthorized(null, undefined)).toBe(true);
  });
  it("requires the exact bearer token when a secret is set", () => {
    expect(isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isCronAuthorized("Bearer wrong", "s3cret")).toBe(false);
    expect(isCronAuthorized(null, "s3cret")).toBe(false);
  });
});

describe("pingProject", () => {
  const target = { name: "production" as const, url: "https://p.supabase.co/", anonKey: "pk" };

  it("runs one anon read against events", async () => {
    const f = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    const r = await pingProject(target, f as unknown as typeof fetch);
    expect(r).toEqual({ name: "production", ok: true, status: 200 });
    expect(f.mock.calls[0][0]).toBe("https://p.supabase.co/rest/v1/events?select=id&limit=1");
    expect(f.mock.calls[0][1].headers.apikey).toBe("pk");
  });

  it("reports a network failure instead of throwing", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const r = await pingProject(target, f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, status: 0, error: "fetch failed" });
  });
});

describe("wiring", () => {
  it("vercel.json schedules the route at most 5 days apart", () => {
    const cfg = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
    const cron = cfg.crons.find((c: { path: string }) => c.path === "/api/cron/keepalive");
    expect(cron).toBeDefined();
    // "*/5" on day-of-month fires on 1, 6, ..., 31, so no gap exceeds 5 days,
    // well under Supabase's 7-day pause window, even across a month boundary.
    expect(cron.schedule.split(" ")[2]).toBe("*/5");
  });

  it("proxy.ts lets the cron through by name", () => {
    expect(readFileSync(join(root, "proxy.ts"), "utf8")).toContain('path === "/api/cron/keepalive"');
  });
});
