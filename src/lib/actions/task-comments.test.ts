import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppUser, Task, TaskComment } from "@/lib/types";

// ------------------------------------------------------------------
// Same shape as tasks.test.ts: identity and persistence are faked, `can.*` and
// the Zod schemas run for real. The rules worth pinning here are the ones the
// UI cannot enforce on its own - who may START a thread as opposed to reply to
// one, what a reply may point at, and that the archive lock reaches a table
// that has no `event_id` of its own.
// ------------------------------------------------------------------
const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./revalidate", () => ({ revalidateEntities: vi.fn() }));

const repo = {
  createTaskComment: vi.fn(async () => "c-new"),
  deleteTaskComment: vi.fn(async () => {}),
  setTaskCommentResolved: vi.fn(async () => {}),
  getTaskComment: vi.fn(async (): Promise<TaskComment | null> => null),
  getTask: vi.fn(async (): Promise<Task | null> => null),
  getEvent: vi.fn(async (id: string) => ({ id, locked: false })),
};
vi.mock("@/lib/data/repo", () => repo);

const {
  startTaskCommentAction, replyTaskCommentAction,
  setTaskCommentResolvedAction, deleteTaskCommentAction,
} = await import("./task-comments");

const user = (over: Partial<AppUser> = {}): AppUser => ({
  id: "u1", name: "Tester", email: "t@x.id", role: "admin", ...over,
});

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1", event_id: "ov1", division: "EVENT", no: "1", pic: "Budi",
  title: "Susun proposal", start_date: null, start_raw: "", end_date: null, end_raw: "",
  notes: "", evaluation: "", result: "", status: "todo", ...over,
});

const comment = (over: Partial<TaskComment> = {}): TaskComment => ({
  id: "c1", task_id: "t1", parent_id: null, body: "Tolong revisi bagian anggaran",
  author_id: "u9", author_name: "Koordinator", author_role: "coordinator",
  resolved: false, resolved_at: null, resolved_by: "", created_at: "2026-09-20T03:00:00.000Z",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(user());
  repo.getTask.mockResolvedValue(task());
  repo.getTaskComment.mockResolvedValue(comment());
  // `clearAllMocks` wipes recorded calls but KEEPS an implementation set with
  // mockResolvedValue, so the archived-edition cases below would otherwise
  // leave every later test running against a locked Ormawa Visit.
  repo.getEvent.mockImplementation(async (id: string) => ({ id, locked: false }));
});

describe("startTaskCommentAction - who may open a thread", () => {
  it.each(["admin", "coordinator", "staff"] as const)("%s may start one", async (role) => {
    currentUser.mockResolvedValue(user({ role }));
    const res = await startTaskCommentAction({ task_id: "t1", body: "Catatan" });
    expect(res.ok).toBe(true);
    expect(repo.createTaskComment).toHaveBeenCalledTimes(1);
  });

  it("refuses an intern before touching the repo - the rule the feature turns on", async () => {
    currentUser.mockResolvedValue(user({ role: "intern" }));
    const res = await startTaskCommentAction({ task_id: "t1", body: "Catatan" });
    expect(res.ok).toBe(false);
    expect(repo.createTaskComment).not.toHaveBeenCalled();
  });

  it("refuses a guest", async () => {
    currentUser.mockResolvedValue(user({ role: "guest" }));
    expect((await startTaskCommentAction({ task_id: "t1", body: "Catatan" })).ok).toBe(false);
    expect(repo.createTaskComment).not.toHaveBeenCalled();
  });

  it("stores the root with no parent, and stamps the author", async () => {
    currentUser.mockResolvedValue(user({ id: "u7", name: "Dona", role: "staff" }));
    await startTaskCommentAction({ task_id: "t1", body: "  Revisi bagian anggaran  " });
    expect(repo.createTaskComment).toHaveBeenCalledWith({
      task_id: "t1",
      parent_id: null,
      // The schema trims, so leading/trailing whitespace never reaches the row.
      body: "Revisi bagian anggaran",
      author_id: "u7",
      author_name: "Dona",
      author_role: "staff",
    });
  });

  it("refuses an empty or whitespace-only message", async () => {
    expect((await startTaskCommentAction({ task_id: "t1", body: "   " })).ok).toBe(false);
    expect(repo.createTaskComment).not.toHaveBeenCalled();
  });

  it("refuses a message past the length cap", async () => {
    const res = await startTaskCommentAction({ task_id: "t1", body: "x".repeat(4001) });
    expect(res.ok).toBe(false);
    expect(repo.createTaskComment).not.toHaveBeenCalled();
  });

  it("refuses an unknown task", async () => {
    repo.getTask.mockResolvedValue(null);
    expect((await startTaskCommentAction({ task_id: "nope", body: "Hai" })).ok).toBe(false);
    expect(repo.createTaskComment).not.toHaveBeenCalled();
  });

  it("refuses when the task's edition is archived", async () => {
    // A comment has no event_id of its own, so the lock can only be found
    // through the parent task. That indirection is the whole risk here.
    currentUser.mockResolvedValue(user({ role: "coordinator" }));
    repo.getEvent.mockResolvedValue({ id: "ov1", locked: true });
    const res = await startTaskCommentAction({ task_id: "t1", body: "Catatan" });
    expect(res.ok).toBe(false);
    expect(repo.createTaskComment).not.toHaveBeenCalled();
  });

  it("lets an admin comment inside an archived edition", async () => {
    repo.getEvent.mockResolvedValue({ id: "ov1", locked: true });
    expect((await startTaskCommentAction({ task_id: "t1", body: "Catatan" })).ok).toBe(true);
  });
});

describe("replyTaskCommentAction", () => {
  it("lets an intern reply - the other half of the start/reply split", async () => {
    currentUser.mockResolvedValue(user({ id: "u3", name: "Intern", role: "intern" }));
    const res = await replyTaskCommentAction({ parent_id: "c1", body: "Siap, saya perbaiki" });
    expect(res.ok).toBe(true);
    expect(repo.createTaskComment).toHaveBeenCalledWith({
      task_id: "t1",
      parent_id: "c1",
      body: "Siap, saya perbaiki",
      author_id: "u3",
      author_name: "Intern",
      author_role: "intern",
    });
  });

  it("refuses a guest", async () => {
    currentUser.mockResolvedValue(user({ role: "guest" }));
    expect((await replyTaskCommentAction({ parent_id: "c1", body: "Hai" })).ok).toBe(false);
    expect(repo.createTaskComment).not.toHaveBeenCalled();
  });

  it("refuses a reply to a reply - threads stay one level deep", async () => {
    repo.getTaskComment.mockResolvedValue(comment({ id: "c2", parent_id: "c1" }));
    const res = await replyTaskCommentAction({ parent_id: "c2", body: "Hai" });
    expect(res.ok).toBe(false);
    expect(repo.createTaskComment).not.toHaveBeenCalled();
  });

  it("still accepts a reply on a thread that was ticked as finished", async () => {
    // Closing a thread closes the NOTIFICATION, not the conversation.
    repo.getTaskComment.mockResolvedValue(comment({ resolved: true }));
    expect((await replyTaskCommentAction({ parent_id: "c1", body: "Nambahin" })).ok).toBe(true);
  });

  it("refuses when the parent task's edition is archived", async () => {
    currentUser.mockResolvedValue(user({ role: "staff" }));
    repo.getEvent.mockResolvedValue({ id: "ov1", locked: true });
    expect((await replyTaskCommentAction({ parent_id: "c1", body: "Hai" })).ok).toBe(false);
    expect(repo.createTaskComment).not.toHaveBeenCalled();
  });
});

describe("setTaskCommentResolvedAction", () => {
  it("lets staff close a thread and records who did it", async () => {
    currentUser.mockResolvedValue(user({ name: "Dona", role: "staff" }));
    expect((await setTaskCommentResolvedAction("c1", true)).ok).toBe(true);
    expect(repo.setTaskCommentResolved).toHaveBeenCalledWith("c1", true, "Dona");
  });

  it("clears the name again when the thread is reopened", async () => {
    repo.getTaskComment.mockResolvedValue(comment({ resolved: true }));
    expect((await setTaskCommentResolvedAction("c1", false)).ok).toBe(true);
    expect(repo.setTaskCommentResolved).toHaveBeenCalledWith("c1", false, "");
  });

  it("refuses an intern", async () => {
    currentUser.mockResolvedValue(user({ role: "intern" }));
    expect((await setTaskCommentResolvedAction("c1", true)).ok).toBe(false);
    expect(repo.setTaskCommentResolved).not.toHaveBeenCalled();
  });

  it("refuses to tick a reply - resolved describes the thread, not one message", async () => {
    repo.getTaskComment.mockResolvedValue(comment({ id: "c2", parent_id: "c1" }));
    expect((await setTaskCommentResolvedAction("c2", true)).ok).toBe(false);
    expect(repo.setTaskCommentResolved).not.toHaveBeenCalled();
  });

  it("refuses inside an archived edition", async () => {
    currentUser.mockResolvedValue(user({ role: "coordinator" }));
    repo.getEvent.mockResolvedValue({ id: "ov1", locked: true });
    expect((await setTaskCommentResolvedAction("c1", true)).ok).toBe(false);
    expect(repo.setTaskCommentResolved).not.toHaveBeenCalled();
  });
});

describe("deleteTaskCommentAction", () => {
  it("lets the author remove their own message", async () => {
    currentUser.mockResolvedValue(user({ id: "u9", role: "intern" }));
    repo.getTaskComment.mockResolvedValue(comment({ author_id: "u9" }));
    expect((await deleteTaskCommentAction("c1")).ok).toBe(true);
    expect(repo.deleteTaskComment).toHaveBeenCalledWith("c1");
  });

  it("refuses somebody else's message without full access", async () => {
    currentUser.mockResolvedValue(user({ id: "u3", role: "staff" }));
    expect((await deleteTaskCommentAction("c1")).ok).toBe(false);
    expect(repo.deleteTaskComment).not.toHaveBeenCalled();
  });

  it("lets a koordinator remove anyone's", async () => {
    currentUser.mockResolvedValue(user({ id: "u3", role: "coordinator" }));
    expect((await deleteTaskCommentAction("c1")).ok).toBe(true);
  });

  it("refuses a guest even on a row that carries their id", async () => {
    currentUser.mockResolvedValue(user({ id: "u9", role: "guest" }));
    repo.getTaskComment.mockResolvedValue(comment({ author_id: "u9" }));
    expect((await deleteTaskCommentAction("c1")).ok).toBe(false);
    expect(repo.deleteTaskComment).not.toHaveBeenCalled();
  });

  it("refuses inside an archived edition", async () => {
    currentUser.mockResolvedValue(user({ id: "u3", role: "coordinator" }));
    repo.getEvent.mockResolvedValue({ id: "ov1", locked: true });
    expect((await deleteTaskCommentAction("c1")).ok).toBe(false);
    expect(repo.deleteTaskComment).not.toHaveBeenCalled();
  });
});

describe("a write error is never swallowed", () => {
  it("reports the repo's message instead of claiming it saved", async () => {
    repo.createTaskComment.mockRejectedValueOnce(
      new Error("new row violates row-level security policy"),
    );
    const res = await startTaskCommentAction({ task_id: "t1", body: "Catatan" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("row-level security");
  });
});
