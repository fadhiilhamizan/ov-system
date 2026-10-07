import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// "Terpental": a hiccup in Supabase Auth or in the profile read must not look
// like a signed-out user (redirect to /login) or a Tamu (every write refused).
// ============================================================

vi.mock("server-only", () => ({}));
const redirect = vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT ${url}`); });
vi.mock("next/navigation", () => ({ redirect }));
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (cookieJar.has(n) ? { value: cookieJar.get(n) } : undefined) }),
}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T>(fn: T) => fn }));

type Res<T> = { data: T; error: unknown };
const client = {
  getUser: vi.fn<() => Promise<Res<{ user: unknown }>>>(),
  getSession: vi.fn<() => Promise<Res<{ session: unknown }>>>(),
  profile: vi.fn<() => Promise<Res<unknown>>>(),
};
vi.mock("./supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: client.getUser, getSession: client.getSession },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: client.profile }) }) }),
  }),
}));

const { getCurrentUser, isTransientAuthError } = await import("./auth");
const { AuthRetryableFetchError } = await import("@supabase/supabase-js");

const ME = { id: "u1", email: "a@b.id", is_anonymous: false };

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
  client.profile.mockResolvedValue({ data: { name: "Admin", role: "admin" }, error: null });
});

describe("transient auth errors", () => {
  it("are told apart from a rejected token", () => {
    expect(isTransientAuthError(new AuthRetryableFetchError("fetch failed", 0))).toBe(true);
    expect(isTransientAuthError({ status: 429, message: "rate limit" })).toBe(true);
    expect(isTransientAuthError({ status: 503 })).toBe(true);
    expect(isTransientAuthError({ status: 401, message: "invalid JWT" })).toBe(false);
    expect(isTransientAuthError(null)).toBe(false);
  });
});

describe("getCurrentUser", () => {
  it("keeps the person signed in when Auth is unreachable, using the session cookie", async () => {
    client.getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("fetch failed", 0) });
    client.getSession.mockResolvedValue({ data: { session: { user: ME } }, error: null });
    const u = await getCurrentUser();
    expect(u.role).toBe("admin");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps them signed in through a rate limit too", async () => {
    client.getUser.mockResolvedValue({ data: { user: null }, error: { status: 429, message: "over_request_rate_limit" } });
    client.getSession.mockResolvedValue({ data: { session: { user: ME } }, error: null });
    expect((await getCurrentUser()).id).toBe("u1");
  });

  it("still signs out a token the auth server REJECTS", async () => {
    client.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, message: "invalid JWT" } });
    await expect(getCurrentUser()).rejects.toThrow(/NEXT_REDIRECT \/login/);
    expect(client.getSession).not.toHaveBeenCalled();
  });

  it("signs out when the database rejects the cookie's token (forged or expired)", async () => {
    client.getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("fetch failed", 0) });
    client.getSession.mockResolvedValue({ data: { session: { user: ME } }, error: null });
    client.profile.mockResolvedValue({ data: null, error: { code: "PGRST301", message: "JWSError" } });
    await expect(getCurrentUser()).rejects.toThrow(/NEXT_REDIRECT \/login/);
  });

  it("never quietly demotes someone to Tamu when the profile read fails", async () => {
    client.getUser.mockResolvedValue({ data: { user: ME }, error: null });
    client.profile.mockResolvedValue({ data: null, error: { code: "", message: "TypeError: fetch failed" } });
    await expect(getCurrentUser()).rejects.toThrow(/profile: TypeError: fetch failed/);
    expect(client.profile).toHaveBeenCalledTimes(2);
  });

  it("recovers when the profile read fails once", async () => {
    client.getUser.mockResolvedValue({ data: { user: ME }, error: null });
    client.profile
      .mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } })
      .mockResolvedValueOnce({ data: { name: "Admin", role: "admin" }, error: null });
    expect((await getCurrentUser()).role).toBe("admin");
  });
});
