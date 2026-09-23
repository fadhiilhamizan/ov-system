import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppUser, LinkItem, Member } from "@/lib/types";

// ------------------------------------------------------------------
// Cross-menu writes: a change in one menu that has to land in another.
// docs/INTEGRATION.md is the map; each block here pins one of its arrows.
// Same shape as tasks.test.ts: auth and repo faked, `can` + Zod real.
// ------------------------------------------------------------------
const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const revalidateEntities = vi.fn();
vi.mock("./revalidate", () => ({ revalidateEntities: (...a: unknown[]) => revalidateEntities(...a) }));
vi.mock("@/lib/session", () => ({
  getActiveEvent: async () => ({ id: "ov1", title: "OV", locked: false }),
  getActiveDivision: async () => "all",
}));

/** Records the order repo writes happen in, for the "before" assertions. */
const calls: string[] = [];
const track = <T>(name: string, value?: T) => vi.fn(async () => { calls.push(name); return value; });

const repo = {
  getEvent: vi.fn(async (id: string) => ({ id, locked: false })),
  // links
  getLink: vi.fn(async (): Promise<LinkItem | null> => null),
  updateLink: track("updateLink"),
  deleteLink: track("deleteLink"),
  bulkDeleteLinks: track("bulkDeleteLinks"),
  createLink: track("createLink", "l-new"),
  pushLinkToOwners: track("pushLinkToOwners"),
  releaseLinkOwners: track("releaseLinkOwners"),
  // members
  getMember: vi.fn(async (): Promise<Member | null> => null),
  getMembers: vi.fn(async (): Promise<Member[]> => []),
  updateMember: track("updateMember"),
  deleteMember: track("deleteMember"),
  bulkDeleteMembers: track("bulkDeleteMembers"),
  bulkUpdateMembers: track("bulkUpdateMembers"),
  renameMemberReferences: vi.fn(async () => 1),
  unseatCoordinator: track("unseatCoordinator"),
  // divisions
  updateDivision: track("updateDivision"),
  bulkUpdateDivisions: track("bulkUpdateDivisions"),
  deleteDivision: track("deleteDivision"),
  bulkDeleteDivisions: track("bulkDeleteDivisions"),
  detachDivisions: track("detachDivisions"),
};
vi.mock("@/lib/data/repo", () => repo);

const links = await import("./links");
const manage = await import("./manage");

const admin: AppUser = { id: "a", name: "Admin", email: "a@x.id", role: "admin" };

const link = (over: Partial<LinkItem> = {}): LinkItem => ({
  id: "l1", event_id: "ov1", section: "Hasil Tugas", division: "EVENT",
  name: "Proposal", url: "https://old.test", note: "Susun proposal", source: "task", ...over,
});

const budi: Member = {
  id: "m1", event_id: "ov1", name: "Budi Santoso", nickname: "Budi", nrp: "5026221001",
  type: "fungsionaris", year: 2022, division: "EVENT", divisions: ["EVENT", "LO"],
};

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  currentUser.mockResolvedValue(admin);
});

describe("Super Link <-> the task result / prospect that published it", () => {
  it("an owned entry takes only name and URL, and pushes the changed ones back", async () => {
    repo.getLink.mockResolvedValue(link());
    const res = await links.updateLinkAction("l1", {
      name: "Proposal", url: "https://new.test", division: "LO", note: "diubah", section: "Lain",
    });
    expect(res.ok).toBe(true);
    // Division/note/section belong to the owner; they would be rebuilt on its
    // next save, so they are not written here at all.
    expect(repo.updateLink).toHaveBeenCalledWith("l1", { name: "Proposal", url: "https://new.test" });
    // The name did not change, so only the URL travels back.
    expect(repo.pushLinkToOwners).toHaveBeenCalledWith("l1", { url: "https://new.test", name: undefined });
    expect(revalidateEntities).toHaveBeenCalledWith("links", "taskLinks", "prospectLinks");
  });

  it("a hand-made entry is edited as before and has no owner to push to", async () => {
    repo.getLink.mockResolvedValue(link({ source: "manual" }));
    await links.updateLinkAction("l1", { name: "Baru", division: "LO" });
    expect(repo.updateLink).toHaveBeenCalledWith("l1", { name: "Baru", division: "LO" });
    expect(repo.pushLinkToOwners).not.toHaveBeenCalled();
  });

  it("refuses to edit an entry that does not exist", async () => {
    repo.getLink.mockResolvedValue(null);
    expect((await links.updateLinkAction("l1", { name: "X" })).ok).toBe(false);
    expect(repo.updateLink).not.toHaveBeenCalled();
  });

  it("deleting releases the owner BEFORE the entry goes", async () => {
    await links.deleteLinkAction("l1");
    expect(calls).toEqual(["releaseLinkOwners", "deleteLink"]);
    expect(repo.releaseLinkOwners).toHaveBeenCalledWith(["l1"]);
  });

  it("bulk delete releases every owner first too", async () => {
    await links.bulkDeleteLinksAction(["l1", "l2"]);
    expect(calls).toEqual(["releaseLinkOwners", "bulkDeleteLinks"]);
    expect(repo.releaseLinkOwners).toHaveBeenCalledWith(["l1", "l2"]);
  });
});

describe("Anggota -> every field that names people", () => {
  it("a nickname change is carried into PIC and coordinator fields of the edition", async () => {
    repo.getMember.mockResolvedValue(budi);
    repo.getMembers.mockResolvedValue([budi]);
    const res = await manage.updateMemberAction("m1", { nickname: "Bima" });
    expect(res.ok).toBe(true);
    expect(repo.renameMemberReferences).toHaveBeenCalledWith("ov1", ["Budi", "Budi Santoso"], "Bima");
    expect(revalidateEntities).toHaveBeenCalledWith("members", "teams", "tasks", "jobs", "prospects");
  });

  it("an edit that does not touch the name ripples nowhere", async () => {
    repo.getMember.mockResolvedValue(budi);
    repo.getMembers.mockResolvedValue([budi]);
    await manage.updateMemberAction("m1", { nrp: "5026221999" });
    expect(repo.renameMemberReferences).not.toHaveBeenCalled();
    expect(repo.unseatCoordinator).not.toHaveBeenCalled();
    expect(revalidateEntities).toHaveBeenCalledWith("members");
  });

  it("leaving a division unseats them as its coordinator", async () => {
    repo.getMember.mockResolvedValue(budi);
    repo.getMembers.mockResolvedValue([budi]);
    await manage.updateMemberAction("m1", { divisions: ["EVENT"] });
    expect(repo.unseatCoordinator).toHaveBeenCalledWith("ov1", ["LO"], ["Budi", "Budi Santoso"]);
  });

  it("deleting a member unseats them everywhere but keeps their PIC history", async () => {
    repo.getMember.mockResolvedValue(budi);
    repo.getMembers.mockResolvedValue([budi]);
    await manage.deleteMemberAction("m1");
    expect(repo.unseatCoordinator).toHaveBeenCalledWith("ov1", "all", ["Budi", "Budi Santoso"]);
    expect(repo.renameMemberReferences).not.toHaveBeenCalled();
  });

  it("a namesake in ANOTHER edition does not make the name ambiguous", async () => {
    const elsewhere: Member = { ...budi, id: "m9", event_id: "ov2" };
    repo.getMember.mockResolvedValue(budi);
    repo.getMembers.mockResolvedValue([budi, elsewhere]);
    await manage.updateMemberAction("m1", { nickname: "Bima" });
    expect(repo.renameMemberReferences).toHaveBeenCalledWith("ov1", ["Budi", "Budi Santoso"], "Bima");
  });
});

describe("Divisi -> members, teams", () => {
  it("deleting a division detaches it from members and teams", async () => {
    const res = await manage.deleteDivisionAction("LO");
    expect(res.ok).toBe(true);
    expect(calls).toEqual(["deleteDivision", "detachDivisions"]);
    expect(repo.detachDivisions).toHaveBeenCalledWith("ov1", ["LO"]);
    expect(revalidateEntities).toHaveBeenCalledWith("divisions", "members", "teams");
  });

  it("bulk delete detaches every key", async () => {
    await manage.bulkDeleteDivisionsAction(["LO", "EVENT"]);
    expect(repo.detachDivisions).toHaveBeenCalledWith("ov1", ["LO", "EVENT"]);
  });

  it("an update can never change the key everything else points at", async () => {
    await manage.updateDivisionAction("LO", { key: "HIJACK", name: "Liaison" });
    expect(repo.updateDivision).toHaveBeenCalledWith("ov1", "LO", expect.not.objectContaining({ key: "HIJACK" }));
    expect(repo.updateDivision).toHaveBeenCalledWith("ov1", "LO", expect.objectContaining({ name: "Liaison" }));
  });
});
