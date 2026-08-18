import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AppUser } from "@/lib/types";

// ============================================================
// The Developer actions split into two groups with OPPOSITE rules, and mixing
// them up is the mistake worth testing for:
//
//   * the beacons (heartbeat, error report) run in EVERY signed-in browser. A
//     presence list of one developer, or an error log containing only the
//     developer's own crashes, would be pointless.
//   * everything else reads or manages developer data and must refuse anyone
//     not on the allowlist.
// ============================================================

const currentUser = vi.fn<() => Promise<AppUser | null>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["user-agent", "TestAgent/1.0"]]),
}));

const repo = {
  touchPresence: vi.fn(async () => {}),
  reportError: vi.fn(async () => {}),
  setErrorResolved: vi.fn(async () => {}),
  deleteError: vi.fn(async () => {}),
  pruneActivity: vi.fn(async () => 7),
  pruneErrors: vi.fn(async () => 3),
};
vi.mock("@/lib/data/developer-repo", () => repo);

const {
  heartbeatAction, reportErrorAction, resolveErrorAction, deleteErrorAction,
  pruneActivityAction, pruneErrorsAction,
} = await import("./developer");

const user = (over: Partial<AppUser> = {}): AppUser => ({
  id: "u1", name: "Dev", email: "dev@example.com", role: "admin", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DEVELOPER_EMAILS", "dev@example.com");
  currentUser.mockResolvedValue(user());
});
afterEach(() => vi.unstubAllEnvs());

describe("developer-only actions", () => {
  const CASES: [string, () => Promise<{ ok: boolean }>][] = [
    ["resolveError", () => resolveErrorAction(1, true)],
    ["deleteError", () => deleteErrorAction(1)],
    ["pruneActivity", () => pruneActivityAction(90)],
    ["pruneErrors", () => pruneErrorsAction(30)],
  ];

  it.each(CASES)("%s refuses an ordinary admin", async (_label, run) => {
    currentUser.mockResolvedValue(user({ email: "admin@ormawavisit.id" }));
    const res = await run();
    expect(res.ok).toBe(false);
    const touched = Object.entries(repo).filter(([, fn]) => fn.mock.calls.length > 0);
    expect(touched).toEqual([]);
  });

  it.each(CASES)("%s refuses a guest", async (_label, run) => {
    currentUser.mockResolvedValue(user({ role: "guest" }));
    expect((await run()).ok).toBe(false);
  });

  it("never confirms that the feature exists", async () => {
    // "Kamu bukan developer" would tell an unauthorised caller both that the
    // concept exists and that they guessed a real action name.
    currentUser.mockResolvedValue(user({ email: "nobody@example.com" }));
    const res = await resolveErrorAction(1, true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.toLowerCase()).not.toContain("developer");
  });

  it("lets a listed developer through", async () => {
    expect((await resolveErrorAction(5, true)).ok).toBe(true);
    expect(repo.setErrorResolved).toHaveBeenCalledWith(5, true);
  });

  it("rejects a malformed id before reaching the repo", async () => {
    expect((await deleteErrorAction(-1)).ok).toBe(false);
    expect((await deleteErrorAction(1.5)).ok).toBe(false);
    expect(repo.deleteError).not.toHaveBeenCalled();
  });

  it("returns how many rows a prune removed", async () => {
    const res = await pruneActivityAction(90);
    expect(res).toEqual({ ok: true, count: 7 });
    expect(repo.pruneActivity).toHaveBeenCalledWith(90);
  });

  it("refuses to prune everything", async () => {
    // "keep 0 days" is "delete the whole audit trail". That should take a
    // deliberate SQL statement, not a mis-typed number in a form.
    expect((await pruneActivityAction(0)).ok).toBe(false);
    expect((await pruneErrorsAction(-5)).ok).toBe(false);
    expect(repo.pruneActivity).not.toHaveBeenCalled();
    expect(repo.pruneErrors).not.toHaveBeenCalled();
  });
});

describe("heartbeat", () => {
  it("records an ordinary account, not just developers", async () => {
    currentUser.mockResolvedValue(user({ id: "u9", email: "staff@ormawavisit.id", role: "staff" }));
    await heartbeatAction("/tasks");
    expect(repo.touchPresence).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u9", role: "staff" }),
      "/tasks",
    );
  });

  it("skips guests", async () => {
    // One shared anonymous identity would collapse every Tamu into a single
    // presence row that means nothing.
    currentUser.mockResolvedValue(user({ role: "guest", email: "" }));
    await heartbeatAction("/tasks");
    expect(repo.touchPresence).not.toHaveBeenCalled();
  });

  it("strips the query string from the path", async () => {
    // Query strings carry things people typed into search boxes, and this list
    // is read by a human looking at other people's names.
    await heartbeatAction("/tasks?q=gaji%20panitia");
    expect(repo.touchPresence).toHaveBeenCalledWith(expect.anything(), "/tasks");
  });

  it("refuses a path that is not a path", async () => {
    await heartbeatAction("https://evil.example.com/steal");
    expect(repo.touchPresence).toHaveBeenCalledWith(expect.anything(), "/");
  });

  it("never throws, whatever the repo does", async () => {
    repo.touchPresence.mockRejectedValueOnce(new Error("db down"));
    await expect(heartbeatAction("/tasks")).resolves.toBeUndefined();
  });
});

describe("error reports", () => {
  it("accepts a report from any signed-in account", async () => {
    currentUser.mockResolvedValue(user({ email: "intern@ormawavisit.id", role: "intern" }));
    await reportErrorAction({ message: "Boom", stack: "at x", path: "/budget" });
    expect(repo.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "client", message: "Boom", path: "/budget" }),
    );
  });

  it("takes the user agent from the request, not the payload", async () => {
    await reportErrorAction({ message: "Boom" });
    expect(repo.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ userAgent: "TestAgent/1.0" }),
    );
  });

  it("skips guests", async () => {
    currentUser.mockResolvedValue(user({ role: "guest" }));
    await reportErrorAction({ message: "Boom" });
    expect(repo.reportError).not.toHaveBeenCalled();
  });

  it("drops an empty message rather than filing a blank row", async () => {
    await reportErrorAction({ message: "   " });
    expect(repo.reportError).not.toHaveBeenCalled();
  });

  it("never throws, so a failed report cannot become a second error", async () => {
    repo.reportError.mockRejectedValueOnce(new Error("insert denied"));
    await expect(reportErrorAction({ message: "Boom" })).resolves.toBeUndefined();
  });
});
