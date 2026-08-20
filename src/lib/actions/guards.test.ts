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
  "deleteLink", "deleteMember", "deleteRundown", "deleteTeam", "getBudgetPlans", "getMembers",
  "getEvent", "getJobs", "getRundown", "reorderBudgetItems", "reorderFaqs", "reorderJobs",
  "setEventLocked",
  "updateBudgetItem", "updateDivision", "updateEvent", "updateFaq", "updateJob",
  "updateLink", "updateMember", "updateRundown", "updateTeam",
] as const;

const repo = Object.fromEntries(
  REPO_FNS.map((n) => [n, vi.fn(async () => undefined)]),
) as Record<string, ReturnType<typeof vi.fn>>;
vi.mock("@/lib/data/repo", () => repo);

// The Himpunan menu has its own data module (0040), mocked on the same terms.
const HIMPUNAN_FNS = [
  "createFgdPlan", "updateFgdPlan", "deleteFgdPlan",
  "createFgdRow", "updateFgdRow", "deleteFgdRow",
  "createCompareSubject", "deleteCompareSubject",
  "createCompareEntry", "updateCompareEntry", "deleteCompareEntry",
] as const;
const himpunanRepo = Object.fromEntries(
  HIMPUNAN_FNS.map((n) => [n, vi.fn(async () => undefined)]),
) as Record<string, ReturnType<typeof vi.fn>>;
vi.mock("@/lib/data/himpunan-repo", () => himpunanRepo);

const links = await import("./links");
const budget = await import("./budget");
const faq = await import("./faq");
const schedule = await import("./schedule");
const manage = await import("./manage");
const himpunan = await import("./himpunan");

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
  ["budget.createPlan", () => budget.createBudgetPlanAction({ name: "RAB" })],
  ["budget.deletePlan", () => budget.deleteBudgetPlanAction("p1")],
  ["budget.setCategoryColor", () => budget.setCategoryColorAction("p1", "KONSUMSI", "#f97316")],
  ["budget.reorderItems", () => budget.reorderBudgetItemsAction(["i1", "i2"])],

  ["faq.create", () => faq.createFaqAction({ question: "Q?", answer: "A" })],
  ["faq.update", () => faq.updateFaqAction("f1", { question: "Q?", answer: "B" })],
  ["faq.delete", () => faq.deleteFaqAction("f1")],
  ["faq.reorder", () => faq.reorderFaqsAction(["f1", "f2"])],

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
  ["events.applyTemplate", () => manage.applyEventTemplateAction("ov1", { divisions: "ov2" })],
  ["events.delete", () => manage.deleteEventAction("ov1")],
  ["events.setLocked", () => manage.setEventLockedAction("ov1", true)],
  ["members.create", () => manage.createMemberAction({ name: "A", division: "EVENT" })],
  ["members.update", () => manage.updateMemberAction("m1", { name: "B" })],
  ["members.delete", () => manage.deleteMemberAction("m1")],
  ["members.bulkDelete", () => manage.bulkDeleteMembersAction(["m1"])],
  ["members.bulkUpdate", () => manage.bulkUpdateMembersAction(["m1"], { division: "EVENT" })],
  ["members.addToDivision", () => manage.addMembersToDivisionAction(["m1"], "EVENT")],
  ["divisions.create", () => manage.createDivisionAction({ name: "Divisi" })],
  ["divisions.update", () => manage.updateDivisionAction("EVENT", { name: "X" })],
  ["divisions.delete", () => manage.deleteDivisionAction("EVENT")],
  ["divisions.bulkDelete", () => manage.bulkDeleteDivisionsAction(["EVENT"])],
  ["divisions.bulkUpdate", () => manage.bulkUpdateDivisionsAction(["EVENT"], { color: "#fff" })],
  ["teams.create", () => manage.createTeamAction({ division: "EVENT" })],
  ["teams.update", () => manage.updateTeamAction("tm1", { intern: "A" })],
  ["teams.delete", () => manage.deleteTeamAction("tm1")],

  ["himpunan.createFgdPlan", () => himpunan.createFgdPlanAction({ event_id: "ov1" })],
  ["himpunan.updateFgdPlan", () => himpunan.updateFgdPlanAction("f1", { title: "X" })],
  ["himpunan.deleteFgdPlan", () => himpunan.deleteFgdPlanAction("f1")],
  ["himpunan.createFgdRow", () => himpunan.createFgdRowAction("f1")],
  ["himpunan.updateFgdRow", () => himpunan.updateFgdRowAction("r1", { ours: "X" })],
  ["himpunan.deleteFgdRow", () => himpunan.deleteFgdRowAction("r1")],
  ["himpunan.createCompareSubject", () => himpunan.createCompareSubjectAction({ event_id: "ov1", org_name: "X" })],
  ["himpunan.deleteCompareSubject", () => himpunan.deleteCompareSubjectAction("s1")],
  ["himpunan.createCompare", () => himpunan.createCompareEntryAction({ event_id: "ov1", subject_id: "s1" })],
  ["himpunan.updateCompare", () => himpunan.updateCompareEntryAction("c1", { aspect: "X" })],
  ["himpunan.deleteCompare", () => himpunan.deleteCompareEntryAction("c1")],
];

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(guest);
});

describe("a guest cannot mutate anything", () => {
  it.each(CASES)("%s is refused and never reaches the repo", async (_label, run) => {
    const res = await run();
    expect(res.ok).toBe(false);
    const touched = [...Object.entries(repo), ...Object.entries(himpunanRepo)]
      .filter(([, fn]) => fn.mock.calls.length > 0)
      .map(([name]) => name);
    expect(touched).toEqual([]);
  });

  it("covers every mutating action exported by these modules", () => {
    // Read-only actions (they fetch, they don't mutate) are exempt from the
    // guest-guard invariant.
    const READ_ONLY = new Set(["getCloneOptionsAction"]);
    const exported = [
      ...Object.keys(links), ...Object.keys(budget), ...Object.keys(faq),
      ...Object.keys(schedule), ...Object.keys(manage), ...Object.keys(himpunan),
    ].filter((k) => k.endsWith("Action") && !READ_ONLY.has(k));
    // If someone adds an action without a guard case, this fails and points at it.
    expect(CASES.length).toBe(exported.length);
  });
});
