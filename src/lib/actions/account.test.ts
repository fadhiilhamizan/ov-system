import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppUser } from "@/lib/types";

// ------------------------------------------------------------------
// Editing your own account.
//
// This action has no `can.*` check, which makes it worth testing harder than
// most: what keeps it safe is that it cannot NAME another account and cannot
// REACH a privileged column. Both of those are easy to break by "just adding
// one more field", and neither would show up as a type error.
// ------------------------------------------------------------------
const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Demo mode is read from a cookie, so the cookie store has to exist. `demo`
// flips it per test; anything else is the ordinary signed-in case.
const demo = vi.fn(() => false);
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "x" }) }) }));
vi.mock("@/lib/demo", () => ({ DEMO_COOKIE: "ov_demo", demoActive: () => demo() }));

const repo = {
  updateMyProfile: vi.fn<(id: string, patch: Record<string, unknown>) => Promise<void>>(
    async () => {},
  ),
};
vi.mock("@/lib/data/repo", () => repo);

const { updateMyProfileAction } = await import("./account");

const user = (over: Partial<AppUser> = {}): AppUser => ({
  id: "u1", name: "Tester", email: "t@x.id", role: "staff", ...over,
});

/** What the repo was asked to write on the last call. */
const wrote = () => repo.updateMyProfile.mock.calls.at(-1);

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(user());
  demo.mockReturnValue(false);
});

describe("updateMyProfileAction", () => {
  it("saves a new display name", async () => {
    const res = await updateMyProfileAction({ name: "Nama Baru" });
    expect(res.ok).toBe(true);
    expect(wrote()).toEqual(["u1", { name: "Nama Baru", avatar: null }]);
  });

  it("always writes to the CALLER's own id", async () => {
    // There is no id parameter to point anywhere else, and this pins that:
    // adding one later would break here rather than in production.
    currentUser.mockResolvedValue(user({ id: "someone-else" }));
    await updateMyProfileAction({ name: "Nama" });
    expect(wrote()?.[0]).toBe("someone-else");
  });

  it("accepts each of the five characters", async () => {
    for (const c of ["rubah", "panda", "burung", "kucing", "beruang"]) {
      expect((await updateMyProfileAction({ name: "N", avatar: c })).ok, c).toBe(true);
      expect(wrote()?.[1]).toEqual({ name: "N", avatar: c });
    }
  });

  it("treats an empty avatar as 'back to my initials'", async () => {
    await updateMyProfileAction({ name: "N", avatar: "" });
    expect(wrote()?.[1]).toEqual({ name: "N", avatar: null });
  });

  it("refuses a character that does not exist", async () => {
    // The key is stored and later rendered; an unknown one would simply show
    // nothing, so it is rejected at the door rather than saved.
    const res = await updateMyProfileAction({ name: "N", avatar: "naga" });
    expect(res.ok).toBe(false);
    expect(repo.updateMyProfile).not.toHaveBeenCalled();
  });

  it("refuses an empty name", async () => {
    expect((await updateMyProfileAction({ name: "   " })).ok).toBe(false);
    expect(repo.updateMyProfile).not.toHaveBeenCalled();
  });

  it("refuses a name past the length cap", async () => {
    expect((await updateMyProfileAction({ name: "x".repeat(81) })).ok).toBe(false);
  });

  it("trims the name before storing it", async () => {
    await updateMyProfileAction({ name: "  Dona  " });
    expect(wrote()?.[1]).toMatchObject({ name: "Dona" });
  });

  it("refuses in demo mode, which has no real account behind the identity", async () => {
    demo.mockReturnValue(true);
    const res = await updateMyProfileAction({ name: "Nama" });
    expect(res.ok).toBe(false);
    expect(repo.updateMyProfile).not.toHaveBeenCalled();
  });

  it("refuses a guest, who has no profile row", async () => {
    currentUser.mockResolvedValue(user({ role: "guest" }));
    expect((await updateMyProfileAction({ name: "Nama" })).ok).toBe(false);
    expect(repo.updateMyProfile).not.toHaveBeenCalled();
  });

  it("never forwards a privileged field, even when one is sent", async () => {
    // The schema strips unknown keys. If that ever stopped being true, this
    // payload would be a self-promotion hole wearing a profile form.
    await updateMyProfileAction({
      name: "Nama",
      // @ts-expect-error - deliberately sending what a forged payload would.
      role: "admin",
      is_shared: false,
      id: "somebody-else",
    });
    expect(wrote()?.[1]).toEqual({ name: "Nama", avatar: null });
    expect(wrote()?.[0]).toBe("u1");
  });

  it("reports a write error instead of claiming it saved", async () => {
    repo.updateMyProfile.mockRejectedValueOnce(
      new Error("new row violates row-level security policy"),
    );
    const res = await updateMyProfileAction({ name: "Nama" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("row-level security");
  });
});
