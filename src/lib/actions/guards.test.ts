import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppUser } from "@/lib/types";

// ------------------------------------------------------------------
// One invariant, checked across every mutating action module: a read-only
// account (guest) must never reach the data layer. This is the cheap, broad
// half of action coverage â€” the per-module files assert the interesting
// validation and business rules.
// ------------------------------------------------------------------
const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./revalidate", () => ({ revalidateEntities: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getActiveEvent: async () => ({ id: "ov1", title: "OV" }),
  getActiveDivision: async () => "all",
}));

// Every repo function these modules import, stubbed. A guest reaching ANY of
// them is the failure we are guarding against, so the assertion is "none were
// called" rather than a throw (throwing breaks ESM module binding at import).
const REPO_FNS = [
  "bulkDeleteBudgetItems", "bulkDeleteDivisions", "bulkDeleteLinks", "bulkDeleteMembers",
  "bulkUpdateDivisions", "bulkUpdateMembers", "cloneEventData", "createBudgetItem",
  "createBudgetPlan", "createDivision", "createEvent", "createFaq", "createJob",
  "createLink", "createMember", "createRundown", "createTeam", "deleteBudgetItem",
  "deleteBudgetPlan", "deleteDivision", "deleteEvent", "deleteFaq", "deleteJob",
  "deleteLink", "deleteMember", "deleteRundown", "deleteTeam", "getBudgetPlans",
  "getEvent", "getJobs", "getRundown", "reorderJobs", "setEventLocked",
  "updateBudgetItem", "updateDivision", "updateEvent", "updateFaq", "updateJob",
  "updateLink", "updateMember", "updateRundown", "updateTeam",
] as const;

const repo = Object.fromEntries(
  REPO_FNS.map((n) => [n, vi.fn(async () => undefined)]),
) as Record<string, ReturnType<typeof vi.fn>>;
vi.mock("@/lib/data/repo", () => repo);

const links = await import("./links");
const budget = await import("./budget");
const faq = await import("./faq");
const schedule = await import("./schedule");
const manage = await import("./manage");

const guest: AppUser = {
  id: "g", name: "Tamu", email: "", role: "guest",
};

/** Every case: [label, () => actionPromise] */
const CASES: [string, () => Promise<{ ok: boolean }>][] = [
  ["links.create", () => links.createLinkAction({ name: "A", url: "https://a.com" })],
  ["links.update", () => links.updateLinkAction("l1", { name: "B" })],
  ["links.delete", () => links.deleteLinkAction("l1")],
  ["links.bulkDelete", () => links.bulkDeleteLinksAction(["l1"])],

  ["budget.updateItem", () => budget.updateBudgetItemAction("i1", { qty: 1 })],
  ["budget.createItem", () => budget.createBudgetItemAction("p1", { category: "K", name: "N" })],
  ["budget.deleteItem", () => budget.deleteBudgetItemAction("i1")],
  ["budget.duplicateItem", () => budget.duplicateBudgetItemAction("i1")],
  ["budget.bulkDeleteItems", () => budget.bulkDeleteBudgetItemsAction(["i1"])],
  ["budget.createPlan", () => budget.createBudgetPlanAction({ name: "RAB", event_id: "ov1" })],
  ["budget.deletePlan", () => budget.deleteBudgetPlanAction("p1")],
  ["budget.setCategoryColor", () => budget.setCategoryColorAction("p1", "KONSUMSI", "#f97316")],

  ["faq.create", () => faq.createFaqAction({ question: "Q?", answer: "A" })],
  ["faq.update", () => faq.updateFaqAction("f1", { question: "Q?", answer: "B" })],
  ["faq.delete", () => faq.deleteFaqAction("f1")],

  ["rundown.create", () => schedule.createRundownAction({ event_id: "ov1" })],
  ["rundown.update", () => schedule.updateRundownAction("r1", { activity: "X" })],
  ["rundown.duplicate", () => schedule.duplicateRundownAction("r1")],
  ["rundown.delete", () => schedule.deleteRundownAction("r1")],
  ["jobs.create", () => schedule.createJobAction({ event_id: "ov1", job: "MC" })],
  ["jobs.update", () => schedule.updateJobAction("j1", { job: "MC2" })],
  ["jobs.duplicate", () => schedule.duplicateJobAction("j1")],
  ["jobs.delete", () => schedule.deleteJobAction("j1")],
  ["jobs.reorder", () => schedule.reorderJobsAction(["j1", "j2"])],

  ["events.create", () => manage.createEventAction({ title: "OV Baru" })],
  ["events.update", () => manage.updateEventAction("ov1", { title: "X" })],
  ["events.duplicate", () => manage.duplicateEventAction("ov1")],
  ["events.delete", () => manage.deleteEventAction("ov1")],
  ["events.setLocked", () => manage.setEventLockedAction("ov1", true)],
  ["members.create", () => manage.createMemberAction({ name: "A", division: "EVENT" })],
  ["members.update", () => manage.updateMemberAction("m1", { name: "B" })],
  ["members.delete", () => manage.deleteMemberAction("m1")],
  ["members.bulkDelete", () => manage.bulkDeleteMembersAction(["m1"])],
  ["members.bulkUpdate", () => manage.bulkUpdateMembersAction(["m1"], { division: "EVENT" })],
  ["divisions.create", () => manage.createDivisionAction({ name: "Divisi" })],
  ["divisions.update", () => manage.updateDivisionAction("EVENT", { name: "X" })],
  ["divisions.delete", () => manage.deleteDivisionAction("EVENT")],
  ["divisions.bulkDelete", () => manage.bulkDeleteDivisionsAction(["EVENT"])],
  ["divisions.bulkUpdate", () => manage.bulkUpdateDivisionsAction(["EVENT"], { color: "#fff" })],
  ["teams.create", () => manage.createTeamAction({ division: "EVENT" })],
  ["teams.update", () => manage.updateTeamAction("tm1", { intern: "A" })],
  ["teams.delete", () => manage.deleteTeamAction("tm1")],
];

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(guest);
});

describe("a guest cannot mutate anything", () => {
  it.each(CASES)("%s is refused and never reaches the repo", async (_label, run) => {
    const res = await run();
    expect(res.ok).toBe(false);
    const touched = Object.entries(repo)
      .filter(([, fn]) => fn.mock.calls.length > 0)
      .map(([name]) => name);
    expect(touched).toEqual([]);
  });

  it("covers every mutating action exported by these modules", () => {
    const exported = [
      ...Object.keys(links), ...Object.keys(budget), ...Object.keys(faq),
      ...Object.keys(schedule), ...Object.keys(manage),
    ].filter((k) => k.endsWith("Action"));
    // If someone adds an action without a guard case, this fails and points at it.
    expect(CASES.length).toBe(exported.length);
  });
});
