import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppUser, Prospect } from "@/lib/types";

const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./revalidate", () => ({ revalidateEntities: vi.fn() }));

const repo = {
  createProspect: vi.fn(async () => "p-new"),
  updateProspect: vi.fn(async () => {}),
  deleteProspect: vi.fn(async () => {}),
  bulkDeleteProspects: vi.fn(async () => {}),
  getProspects: vi.fn(async (): Promise<Prospect[]> => []),
  setPrimaryProspect: vi.fn(async () => {}),
  unsetPrimaryProspect: vi.fn(async () => {}),
  syncEventFromProspect: vi.fn(async () => {}),
  syncProspectLinks: vi.fn(async () => {}),
  getEvent: vi.fn(async () => ({ id: "ov1", locked: false })),
};
vi.mock("@/lib/data/repo", () => repo);

const {
  createProspectAction, updateProspectAction, deleteProspectAction,
  setPrimaryProspectAction, unsetPrimaryProspectAction,
} = await import("./prospects");

const user = (over: Partial<AppUser> = {}): AppUser => ({
  id: "u1", name: "Tester", email: "t@x.id", role: "admin", ...over,
});

const prospect = (over: Partial<Prospect> = {}): Prospect => ({
  id: "p1", event_id: "ov1", no: "1", date_text: "", month: "",
  contact: "", org_name: "HIMA X", campus: "ITS", location: "", mode: "",
  pic: "", contact_status: "", their_response: "", our_response: "",
  done: false, is_primary: false, source: "manual", notes: "", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(user());
  repo.getProspects.mockResolvedValue([]);
});

describe("createProspectAction", () => {
  it("refuses an intern (matrix gives prospects:view)", async () => {
    currentUser.mockResolvedValue(user({ role: "intern" }));
    expect((await createProspectAction({ org_name: "HIMA X" })).ok).toBe(false);
    expect(repo.createProspect).not.toHaveBeenCalled();
  });

  it("requires at least an org name or a contact", async () => {
    const res = await createProspectAction({ org_name: "", contact: "" });
    expect(res.ok).toBe(false);
    expect(repo.createProspect).not.toHaveBeenCalled();
  });

  it("writes the PARSED payload â€” trimmed, unknown keys stripped", async () => {
    // Regression: this action used to `parse()` and then pass the RAW input,
    // so the validation did nothing.
    await createProspectAction({ org_name: "  HIMA X  ", evil: "<script>" } as never);
    const arg = (repo.createProspect.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(arg.org_name).toBe("HIMA X");
    expect(arg.evil).toBeUndefined();
  });
});

describe("updateProspectAction", () => {
  it("validates the patch (it used to be written unchecked)", async () => {
    const res = await updateProspectAction("p1", { org_name: "x".repeat(5000) });
    expect(res.ok).toBe(false);
    expect(repo.updateProspect).not.toHaveBeenCalled();
  });

  it("rejects an empty id", async () => {
    expect((await updateProspectAction("", { org_name: "A" })).ok).toBe(false);
  });

  it("re-syncs the Ormawa Visit when the edited prospect is the primary", async () => {
    repo.getProspects.mockResolvedValue([prospect({ is_primary: true, org_name: "HIMA Y" })]);
    const res = await updateProspectAction("p1", { org_name: "HIMA Y" });
    expect(res.ok).toBe(true);
    expect(repo.syncEventFromProspect).toHaveBeenCalledWith("ov1", expect.objectContaining({ is_primary: true }));
  });

  it("reconciles the links when the form sends them", async () => {
    // syncProspectLinks is what keeps the Super Link entries in step; skipping
    // it would leave stale or orphaned rows behind.
    repo.getProspects.mockResolvedValue([prospect()]);
    await updateProspectAction("p1", { org_name: "HIMA X" }, [
      { url: "https://handbook.test", label: "Handbook", in_super_link: true },
    ]);
    expect(repo.syncProspectLinks).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
      [expect.objectContaining({ url: "https://handbook.test", in_super_link: true })],
    );
  });

  it("leaves the links alone when the caller does not send any", async () => {
    // undefined means "not editing the links" (e.g. the primary toggle). An
    // empty ARRAY means "remove them all", and confusing the two would wipe a
    // prospect's attachments on an unrelated save.
    repo.getProspects.mockResolvedValue([prospect()]);
    await updateProspectAction("p1", { org_name: "HIMA X" });
    expect(repo.syncProspectLinks).not.toHaveBeenCalled();
  });

  it("an empty array DOES clear them", async () => {
    repo.getProspects.mockResolvedValue([prospect()]);
    await updateProspectAction("p1", { org_name: "HIMA X" }, []);
    expect(repo.syncProspectLinks).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), []);
  });

  it("rejects a link that is not a real http(s) URL", async () => {
    const res = await updateProspectAction("p1", { org_name: "HIMA X" }, [
      { url: "bukan-url", label: "", in_super_link: false },
    ]);
    expect(res.ok).toBe(false);
    expect(repo.updateProspect).not.toHaveBeenCalled();
  });

  it("rejects the same URL twice on one prospect", async () => {
    const res = await updateProspectAction("p1", { org_name: "HIMA X" }, [
      { url: "https://a.test", label: "", in_super_link: false },
      { url: "https://a.test/", label: "", in_super_link: true },
    ]);
    expect(res.ok).toBe(false);
    expect(repo.updateProspect).not.toHaveBeenCalled();
  });

  it("never lets a client write the legacy link columns", async () => {
    // They belong to migration 0036 and are now owned by prospect_links; a
    // client that still sends them must not be able to re-point link_id at
    // somebody else's Super Link row.
    await updateProspectAction("p1", { link_id: "someone-elses-row", link: "https://x.test" } as never);
    const patch = ((repo.updateProspect.mock.calls[0] as unknown[])?.[1] ?? {}) as object;
    expect(patch).not.toHaveProperty("link_id");
    expect(patch).not.toHaveProperty("link");
  });

  it("does NOT touch the event for a non-primary prospect", async () => {
    repo.getProspects.mockResolvedValue([prospect({ is_primary: false })]);
    await updateProspectAction("p1", { org_name: "HIMA Z" });
    expect(repo.syncEventFromProspect).not.toHaveBeenCalled();
  });
});

describe("primary prospect", () => {
  it("only admin/coordinator/staff may set it; a guest cannot", async () => {
    currentUser.mockResolvedValue(user({ role: "guest" }));
    expect((await setPrimaryProspectAction("p1")).ok).toBe(false);
    expect(repo.setPrimaryProspect).not.toHaveBeenCalled();
  });

  it("delegates to the repo, which enforces one-per-event", async () => {
    expect((await setPrimaryProspectAction("p1")).ok).toBe(true);
    expect(repo.setPrimaryProspect).toHaveBeenCalledWith("p1");
  });

  it("can be cleared again", async () => {
    expect((await unsetPrimaryProspectAction("p1")).ok).toBe(true);
    expect(repo.unsetPrimaryProspect).toHaveBeenCalledWith("p1");
  });

  it("rejects a malformed id before hitting the repo", async () => {
    expect((await setPrimaryProspectAction("")).ok).toBe(false);
    expect(repo.setPrimaryProspect).not.toHaveBeenCalled();
  });
});

describe("deleteProspectAction", () => {
  it("needs full access â€” staff cannot delete", async () => {
    currentUser.mockResolvedValue(user({ role: "staff" }));
    expect((await deleteProspectAction("p1")).ok).toBe(false);
    expect(repo.deleteProspect).not.toHaveBeenCalled();
  });

  it("admin can", async () => {
    expect((await deleteProspectAction("p1")).ok).toBe(true);
    expect(repo.deleteProspect).toHaveBeenCalledWith("p1");
  });
});
