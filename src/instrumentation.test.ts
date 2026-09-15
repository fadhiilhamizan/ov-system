import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// The server half of an error report.
//
// `onRequestError` is the only place the app ever sees what actually threw
// during a server render - everywhere else React has already replaced it with
// one fixed sentence and a digest. So the things worth pinning are the ones
// that would silently turn it back into nothing: filing under no session (the
// insert policy needs `auth.uid()`, so the row is refused and the crash is lost
// again), losing the digest that joins it to the browser's own report, and
// reporting Next's control flow as if it were a fault.
// ============================================================

const reportError = vi.fn();
type CookieMethods = {
  cookies: { getAll: () => { name: string; value: string }[]; setAll: () => void };
};
const createServerClient = vi.fn<
  (url: string, key: string, options: CookieMethods) => { marker: string }
>(() => ({ marker: "client" }));

vi.mock("@/lib/data/developer-repo", () => ({ reportError }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));

const SESSION = "sb-abcdefgh-auth-token=base64-eyJhY2Nlc3M%3D";

function request(cookie: string, path = "/members") {
  return {
    path,
    method: "GET",
    headers: { cookie, "user-agent": "Mozilla/5.0 (probe)" },
  };
}

const context = {
  routerKind: "App Router",
  routePath: "/members",
  routeType: "render",
  renderSource: "react-server-components",
  revalidateReason: undefined,
  renderType: "dynamic",
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fire(err: unknown, req = request(SESSION), ctx: any = context) {
  const { onRequestError } = await import("./instrumentation");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await onRequestError(err as any, req as any, ctx);
}

beforeEach(() => {
  vi.resetModules();
  reportError.mockReset();
  createServerClient.mockClear();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  delete process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("onRequestError", () => {
  it("files the real message, and the digest that joins it to the browser report", async () => {
    const err = Object.assign(new Error("teams: TypeError: fetch failed"), {
      digest: "3723442457",
    });

    await fire(err);

    expect(reportError).toHaveBeenCalledTimes(1);
    const [input, client] = reportError.mock.calls[0];
    expect(input.kind).toBe("server");
    expect(input.message).toBe(
      "teams: TypeError: fetch failed [digest 3723442457]",
    );
    expect(input.path).toBe("/members (render)");
    expect(input.userAgent).toBe("Mozilla/5.0 (probe)");
    expect(client).toEqual({ marker: "client" });
  });

  it("hands the session cookie to Supabase, decoded", async () => {
    await fire(new Error("boom"));

    const options = createServerClient.mock.calls[0]?.[2];
    expect(options?.cookies.getAll()).toContainEqual({
      name: "sb-abcdefgh-auth-token",
      // %3D decoded back to "=", as cookies().getAll() would have returned it.
      value: "base64-eyJhY2Nlc3M=",
    });
  });

  it("does not file anything without a session", async () => {
    await fire(new Error("boom"), request("theme=dark"));
    expect(reportError).not.toHaveBeenCalled();
  });

  it("does not file anything in demo mode", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY = "demo-key";

    await fire(new Error("boom"), request(`${SESSION}; ov_demo=1`));
    expect(reportError).not.toHaveBeenCalled();
  });

  it("ignores Next's own control flow", async () => {
    await fire(new Error("NEXT_REDIRECT;replace;/login;307;"));
    await fire(Object.assign(new Error("x"), { digest: "NEXT_NOT_FOUND" }));
    expect(reportError).not.toHaveBeenCalled();
  });

  it("never throws, whatever the report does", async () => {
    reportError.mockRejectedValueOnce(new Error("insert refused"));
    await expect(fire(new Error("boom"))).resolves.toBeUndefined();
  });
});
