import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppUser, Task } from "@/lib/types";

// ------------------------------------------------------------------
// The command palette's action. It had no tests and no schema, which is easy
// to overlook because it only reads - but it is the most frequently called
// action in the app (one per debounced keystroke) and it decides, per module,
// what a role is allowed to see even as raw JSON.
// ------------------------------------------------------------------
const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("@/lib/session", () => ({
  getActiveEvent: async () => ({ id: "ov1", title: "OV", locked: false }),
  getActiveDivision: async () => "all",
}));

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1", event_id: "ov1", division: "EVENT", no: "1", pic: "",
  title: "Susun proposal", start_date: null, start_raw: "", end_date: null,
  end_raw: "", notes: "", result: "", status: "todo", ...over,
});

const repo = {
  getTasks: vi.fn(async () => [task()]),
  getDivisions: vi.fn(async () => [
    { key: "EVENT", name: "Event", short: "EVE", color: "#111", order: 1 },
  ]),
  getMembers: vi.fn(async () => [
    { id: "m1", name: "Budi Proposal", nickname: "", nrp: "5026231128", type: "fungsionaris", year: 2023, divisions: ["EVENT"] },
  ]),
  getEvents: vi.fn(async () => [{ id: "ov1", code: "OV1", title: "Ormawa Visit", partner: "", campus: "", cabinet: "", locked: false }]),
  getProspects: vi.fn(async () => [{ id: "p1", org_name: "HIMA Proposal", campus: "", pic: "", contact: "" }]),
  getLinks: vi.fn(async () => [{ id: "l1", name: "Proposal final", section: "", note: "", division: "" }]),
  getBudgetPlans: vi.fn(async () => [{ id: "b1", name: "RAB Proposal", event_id: "ov1", items: [] }]),
  getRundown: vi.fn(async () => [{ id: "r1", activity: "Bahas proposal", keterangan: "", mc: "", operator: "", time_start: "", time_end: "" }]),
  getJobs: vi.fn(async () => [{ id: "j1", job: "Cetak proposal", pic: "", notes: "" }]),
  getFaqs: vi.fn(async () => [{ id: "f1", question: "Apa itu proposal?", answer: "" }]),
};
vi.mock("@/lib/data/repo", () => repo);

const { searchAction } = await import("./search");

const user = (role: AppUser["role"]): AppUser => ({
  id: "u1", name: "Tester", email: "t@x.id", role,
});

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(user("admin"));
  repo.getTasks.mockResolvedValue([task()]);
});

describe("searchAction - the query itself", () => {
  it("returns nothing for a query shorter than two characters", async () => {
    expect(await searchAction("a")).toEqual([]);
    expect(await searchAction("  ")).toEqual([]);
    expect(repo.getTasks).not.toHaveBeenCalled();
  });

  it("trims a runaway query instead of refusing to search", async () => {
    // A search box that answers "invalid" is worse than one that searches the
    // first 200 characters. It must not throw, and must not hang on the rest.
    const res = await searchAction("proposal" + "x".repeat(5000));
    expect(Array.isArray(res)).toBe(true);
  });

  it("matches case-insensitively across a row's searchable fields", async () => {
    const hits = await searchAction("PROPOSAL");
    expect(hits.map((h) => h.group)).toContain("tasks");
    expect(hits.find((h) => h.group === "tasks")?.title).toBe("Susun proposal");
  });
});

describe("searchAction - one round of reads", () => {
  it("reads every module exactly once, in a single batch", async () => {
    // The six modules after the first four used to be awaited one at a time,
    // so a keystroke cost four parallel round trips plus six sequential ones.
    await searchAction("proposal");
    for (const fn of Object.values(repo)) expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not read a module the role cannot open", async () => {
    // A Tamu has `none` on budget and links, so those must not even be fetched,
    // let alone returned as JSON.
    currentUser.mockResolvedValue(user("guest"));
    const hits = await searchAction("proposal");
    expect(repo.getBudgetPlans).not.toHaveBeenCalled();
    expect(repo.getLinks).not.toHaveBeenCalled();
    expect(hits.map((h) => h.group)).not.toContain("budget");
    expect(hits.map((h) => h.group)).not.toContain("links");
  });

  it("still searches what the role CAN open", async () => {
    currentUser.mockResolvedValue(user("guest"));
    const hits = await searchAction("proposal");
    expect(hits.map((h) => h.group)).toContain("tasks");
  });
});

describe("searchAction - per-group cap", () => {
  it("returns at most five hits per group however many rows match", async () => {
    repo.getTasks.mockResolvedValue(
      Array.from({ length: 500 }, (_, i) => task({ id: `t${i}`, title: `Proposal ${i}` })),
    );
    const hits = await searchAction("proposal");
    expect(hits.filter((h) => h.group === "tasks")).toHaveLength(5);
  });

  it("stops scanning once a group is full", async () => {
    // The loop used to walk every remaining row and throw the matches away.
    // A getter that explodes past the point where the cap is reached proves
    // the scan really stopped.
    let touched = 0;
    const rows = Array.from({ length: 100 }, (_, i) => task({ id: `t${i}` }));
    const spied = rows.map((r, i) =>
      Object.defineProperty({ ...r }, "title", {
        get() {
          touched = Math.max(touched, i + 1);
          return `Proposal ${i}`;
        },
      }),
    );
    repo.getTasks.mockResolvedValue(spied as Task[]);
    await searchAction("proposal");
    // Five hits plus the row that trips the guard: nowhere near all 100.
    expect(touched).toBeLessThan(20);
  });
});
