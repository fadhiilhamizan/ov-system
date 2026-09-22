import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Account, AppUser, Broadcast } from "@/lib/types";

// ------------------------------------------------------------------
// The broadcast actions. Identity and persistence are faked; `can.*` and the
// Zod schema run for real.
//
// The rule worth the most here is that the RECIPIENT LIST is resolved on the
// server from the live account list, not taken from the payload. A composer
// that posts "audience: all" is stating an intent, not a list of people, and
// the difference is what stops a stale or forged payload deciding who gets a
// message.
// ------------------------------------------------------------------
const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./revalidate", () => ({ revalidateEntities: vi.fn() }));

const repo = {
  createBroadcast: vi.fn(async () => "b-new"),
  updateBroadcast: vi.fn(async () => {}),
  deleteBroadcast: vi.fn(async () => {}),
  getBroadcast: vi.fn(async (): Promise<Broadcast | null> => null),
  getAccounts: vi.fn(async (): Promise<Account[]> => []),
  // Typed, so the assertion helper below can read the ids back without a cast.
  syncBroadcastRecipients: vi.fn<(id: string, userIds: string[]) => Promise<void>>(async () => {}),
  setInboxRead: vi.fn(async () => {}),
  markInboxAllRead: vi.fn(async () => {}),
};
vi.mock("@/lib/data/repo", () => repo);

const {
  createBroadcastAction, updateBroadcastAction, deleteBroadcastAction,
  setInboxReadAction, markAllInboxReadAction,
} = await import("./inbox");

const user = (over: Partial<AppUser> = {}): AppUser => ({
  id: "u-admin", name: "Admin", email: "a@x.id", role: "admin", ...over,
});

const ACCOUNTS: Account[] = [
  { id: "u1", name: "Admin Satu", email: "a1@x.id", role: "admin" },
  { id: "u2", name: "Koordinator", email: "k@x.id", role: "coordinator" },
  { id: "u3", name: "Staff Satu", email: "s1@x.id", role: "staff" },
  { id: "u4", name: "Staff Dua", email: "s2@x.id", role: "staff" },
  { id: "u5", name: "Intern", email: "i@x.id", role: "intern" },
];

const broadcast = (over: Partial<Broadcast> = {}): Broadcast => ({
  id: "b1", title: "Rapat", body: "Rapat dimajukan", audience: "all", roles: [],
  created_by: "u-admin", created_by_name: "Admin",
  created_at: "2026-09-21T03:00:00.000Z", updated_at: null, ...over,
});

const VALID = { title: "Rapat", body: "Rapat dimajukan jam 7", audience: "all" as const };

/** The ids handed to syncBroadcastRecipients on the last call. */
const sentTo = () => repo.syncBroadcastRecipients.mock.calls.at(-1)?.[1] ?? [];

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(user());
  repo.getAccounts.mockResolvedValue(ACCOUNTS);
  repo.getBroadcast.mockResolvedValue(broadcast());
  repo.createBroadcast.mockResolvedValue("b-new");
});

describe("createBroadcastAction - only an admin broadcasts", () => {
  it.each(["coordinator", "staff", "intern", "guest"] as const)(
    "refuses %s before touching the repo",
    async (role) => {
      currentUser.mockResolvedValue(user({ role }));
      const res = await createBroadcastAction(VALID);
      expect(res.ok).toBe(false);
      expect(repo.createBroadcast).not.toHaveBeenCalled();
    },
  );

  it("lets an admin send", async () => {
    expect((await createBroadcastAction(VALID)).ok).toBe(true);
    expect(repo.createBroadcast).toHaveBeenCalledTimes(1);
  });
});

describe("who a broadcast actually reaches", () => {
  it("'all' means every account the server can see, not what the form sent", async () => {
    // The payload names two accounts; the audience says everyone. The audience
    // wins, because that is the thing the admin actually chose.
    await createBroadcastAction({ ...VALID, audience: "all", user_ids: ["u1"] });
    expect(sentTo()).toEqual(["u1", "u2", "u3", "u4", "u5"]);
  });

  it("'role' expands to every account holding one of those roles", async () => {
    await createBroadcastAction({ ...VALID, audience: "role", roles: ["staff", "intern"] });
    expect(sentTo()).toEqual(["u3", "u4", "u5"]);
  });

  it("'accounts' with a single tick is how you message one person", async () => {
    await createBroadcastAction({ ...VALID, audience: "accounts", user_ids: ["u3"] });
    expect(sentTo()).toEqual(["u3"]);
  });

  it("drops ids that name no account", async () => {
    // A form left open while an account was deleted would otherwise create a
    // recipient row nobody can ever read.
    await createBroadcastAction({ ...VALID, audience: "accounts", user_ids: ["u3", "ghost"] });
    expect(sentTo()).toEqual(["u3"]);
  });

  it("refuses to 'send' to nobody when a role matches no account", async () => {
    repo.getAccounts.mockResolvedValue([ACCOUNTS[0]]);
    const res = await createBroadcastAction({ ...VALID, audience: "role", roles: ["intern"] });
    expect(res.ok).toBe(false);
    expect(repo.createBroadcast).not.toHaveBeenCalled();
  });

  it("refuses an audience with nothing selected", async () => {
    expect((await createBroadcastAction({ ...VALID, audience: "role", roles: [] })).ok).toBe(false);
    expect((await createBroadcastAction({ ...VALID, audience: "accounts", user_ids: [] })).ok).toBe(false);
    expect(repo.createBroadcast).not.toHaveBeenCalled();
  });
});

describe("validation", () => {
  it("refuses an empty title or body", async () => {
    expect((await createBroadcastAction({ ...VALID, title: "   " })).ok).toBe(false);
    expect((await createBroadcastAction({ ...VALID, body: "" })).ok).toBe(false);
    expect(repo.createBroadcast).not.toHaveBeenCalled();
  });

  it("refuses a body past the length cap", async () => {
    const res = await createBroadcastAction({ ...VALID, body: "x".repeat(4001) });
    expect(res.ok).toBe(false);
  });

  it("stamps the sender from the session, never from the payload", async () => {
    currentUser.mockResolvedValue(user({ id: "u9", name: "Dona" }));
    await createBroadcastAction(VALID);
    expect(repo.createBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: "u9", created_by_name: "Dona" }),
    );
  });
});

describe("updateBroadcastAction", () => {
  it("refuses a non-admin", async () => {
    currentUser.mockResolvedValue(user({ role: "coordinator" }));
    expect((await updateBroadcastAction("b1", VALID)).ok).toBe(false);
    expect(repo.updateBroadcast).not.toHaveBeenCalled();
  });

  it("refuses an unknown broadcast", async () => {
    repo.getBroadcast.mockResolvedValue(null);
    expect((await updateBroadcastAction("nope", VALID)).ok).toBe(false);
    expect(repo.updateBroadcast).not.toHaveBeenCalled();
  });

  it("re-targets by syncing, so existing readers keep their read state", async () => {
    const res = await updateBroadcastAction("b1", {
      ...VALID, audience: "accounts", user_ids: ["u3", "u5"],
    });
    expect(res.ok).toBe(true);
    // Sync, not delete-then-insert: that distinction is what stops an edit
    // marking the message unread again for everyone who already read it.
    expect(repo.syncBroadcastRecipients).toHaveBeenCalledWith("b1", ["u3", "u5"]);
  });
});

describe("deleteBroadcastAction", () => {
  it("refuses a non-admin", async () => {
    currentUser.mockResolvedValue(user({ role: "staff" }));
    expect((await deleteBroadcastAction("b1")).ok).toBe(false);
    expect(repo.deleteBroadcast).not.toHaveBeenCalled();
  });

  it("lets an admin delete", async () => {
    expect((await deleteBroadcastAction("b1")).ok).toBe(true);
    expect(repo.deleteBroadcast).toHaveBeenCalledWith("b1");
  });
});

describe("reading my own inbox", () => {
  it("always acts on the caller's own id", async () => {
    // There is no user-id parameter to point somewhere else, which is the
    // point: the only inbox this action can touch is the caller's.
    currentUser.mockResolvedValue(user({ id: "u3", role: "staff" }));
    expect((await setInboxReadAction("b1", true)).ok).toBe(true);
    expect(repo.setInboxRead).toHaveBeenCalledWith("b1", "u3", true);
  });

  it("can mark a message unread again", async () => {
    currentUser.mockResolvedValue(user({ id: "u3", role: "intern" }));
    await setInboxReadAction("b1", false);
    expect(repo.setInboxRead).toHaveBeenCalledWith("b1", "u3", false);
  });

  it("refuses a guest, who has no inbox of their own", async () => {
    currentUser.mockResolvedValue(user({ role: "guest" }));
    expect((await setInboxReadAction("b1", true)).ok).toBe(false);
    expect((await markAllInboxReadAction()).ok).toBe(false);
    expect(repo.setInboxRead).not.toHaveBeenCalled();
    expect(repo.markInboxAllRead).not.toHaveBeenCalled();
  });

  it("marks everything read for the caller", async () => {
    currentUser.mockResolvedValue(user({ id: "u4", role: "staff" }));
    expect((await markAllInboxReadAction()).ok).toBe(true);
    expect(repo.markInboxAllRead).toHaveBeenCalledWith("u4");
  });
});

describe("a write error is never swallowed", () => {
  it("reports the repo's message instead of claiming it sent", async () => {
    repo.createBroadcast.mockRejectedValueOnce(
      new Error("new row violates row-level security policy"),
    );
    const res = await createBroadcastAction(VALID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("row-level security");
  });
});
