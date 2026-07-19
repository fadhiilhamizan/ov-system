import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { demoActive, demoConfigured, supabaseCreds } from "./demo";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_DEMO_URL",
  "NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prod.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "prod-key";
  process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL = "https://demo.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY = "demo-key";
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("supabaseCreds — keeps demo and production isolated", () => {
  it("returns production creds when not in demo mode", () => {
    expect(supabaseCreds(false)).toEqual({ url: "https://prod.supabase.co", key: "prod-key" });
  });
  it("returns the demo project's creds when in demo mode", () => {
    expect(supabaseCreds(true)).toEqual({ url: "https://demo.supabase.co", key: "demo-key" });
  });
  it("falls back to production if the demo project is not configured", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL;
    expect(supabaseCreds(true).url).toBe("https://prod.supabase.co");
  });
});

describe("demoActive", () => {
  it("is true only when the cookie is '1' and demo is configured", () => {
    expect(demoActive("1")).toBe(true);
    expect(demoActive("0")).toBe(false);
    expect(demoActive(undefined)).toBe(false);
  });
  it("is false when demo is not configured, even with the cookie set", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY;
    expect(demoConfigured()).toBe(false);
    expect(demoActive("1")).toBe(false);
  });
});
