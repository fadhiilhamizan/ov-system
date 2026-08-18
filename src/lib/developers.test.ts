import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NAV } from "@/components/layout/nav-config";
import { GUIDE } from "@/lib/guide";
import { APP_ROUTES, resolveHref } from "@/lib/violet/links";
import { MODULE_ACCESS_LEVEL } from "@/lib/constants";
import { REQUESTABLE_ROLES } from "@/lib/types";
import type { AppUser } from "@/lib/types";

// The module reads process.env at CALL time, not import time, so stubEnv works
// without re-importing it for every case.
const { isDeveloper, isDeveloperEmail, developerCount, developerLayerConfigured } =
  await import("./developers");

const user = (over: Partial<AppUser> = {}): AppUser => ({
  id: "u1", name: "Dev", email: "dev@example.com", role: "admin", ...over,
});

beforeEach(() => {
  vi.stubEnv("DEVELOPER_EMAILS", "dev@example.com, Second.Dev@Example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the developer allowlist", () => {
  it("matches a configured address", () => {
    expect(isDeveloperEmail("dev@example.com")).toBe(true);
  });
  it("is case-insensitive and tolerates spacing in the env var", () => {
    expect(isDeveloperEmail("SECOND.DEV@example.com")).toBe(true);
    expect(isDeveloperEmail("  dev@example.com  ")).toBe(true);
  });
  it("never matches a blank address", () => {
    // An account with no email must not become a developer by accident, which
    // is exactly what a naive "" === "" comparison would do.
    expect(isDeveloperEmail("")).toBe(false);
    expect(isDeveloperEmail(null)).toBe(false);
    expect(isDeveloperEmail(undefined)).toBe(false);
  });
  it("matches nobody when nothing is configured", () => {
    vi.stubEnv("DEVELOPER_EMAILS", "");
    expect(isDeveloperEmail("dev@example.com")).toBe(false);
    expect(developerLayerConfigured()).toBe(false);
    expect(developerCount()).toBe(0);
  });
  it("counts addresses without ever exposing them", () => {
    expect(developerCount()).toBe(2);
  });

  it("accepts a listed account", () => {
    expect(isDeveloper(user())).toBe(true);
  });
  it("refuses an unlisted account whatever its role", () => {
    expect(isDeveloper(user({ email: "someone@else.id" }))).toBe(false);
    expect(isDeveloper(user({ email: "someone@else.id", role: "admin" }))).toBe(false);
  });
  it("refuses a guest even if the address somehow matches", () => {
    // The anonymous Tamu identity is SHARED, so an address on it means nothing.
    expect(isDeveloper(user({ role: "guest" }))).toBe(false);
  });
  it("refuses no user at all", () => {
    expect(isDeveloper(null)).toBe(false);
    expect(isDeveloper(undefined)).toBe(false);
  });
});

// ============================================================
// The invariant that makes the menu hidden.
//
// Five separate tables would each put /developer on somebody's screen, and each
// of them is generated from a list a future change could innocently add it to:
// NAV builds the sidebar AND the search palette AND the access matrix, GUIDE
// builds the Panduan, APP_ROUTES lets Violet hand out the link, and
// MODULE_ACCESS_LEVEL would let a role be granted it.
//
// These tests are the reason a reviewer does not have to remember all five.
// ============================================================
describe("the Developer menu stays hidden", () => {
  const paths = NAV.flatMap((g) => g.items.map((i) => i.href));
  const keys = NAV.flatMap((g) => g.items.map((i) => i.key));

  it("is not in the navigation (so not in the sidebar or global search)", () => {
    expect(paths).not.toContain("/developer");
    expect(keys).not.toContain("developer");
  });

  it("is not in the access matrix (so no role can be granted it)", () => {
    expect(Object.keys(MODULE_ACCESS_LEVEL)).not.toContain("developer");
  });

  it("is not documented in the Panduan", () => {
    expect(GUIDE.map((s) => s.key)).not.toContain("developer");
    const prose = JSON.stringify(GUIDE).toLowerCase();
    expect(prose).not.toContain("/developer");
  });

  it("is not a route Violet may link to", () => {
    expect(Object.keys(APP_ROUTES)).not.toContain("/developer");
    // The half of the fix that actually holds: even if the model invents the
    // path, resolveHref drops it rather than rendering a link.
    expect(resolveHref("/developer")).toBeUndefined();
    expect(resolveHref("/developer#aktivitas")).toBeUndefined();
  });

  it("is not a requestable role", () => {
    expect(REQUESTABLE_ROLES).not.toContain("developer" as never);
  });
});
