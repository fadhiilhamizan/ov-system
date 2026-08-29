import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppUser, Task } from "@/lib/types";

// ------------------------------------------------------------------
// The action pipeline is `can.* -> parse() -> repo`. These tests exercise that
// whole chain with the two outer edges faked: identity (auth) and persistence
// (repo). `can` and the Zod schemas run for real, because that is exactly the
// seam where the bugs in the changelog lived.
// ------------------------------------------------------------------
const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./revalidate", () => ({ revalidateEntities: vi.fn() }));

const repo = {
  createTask: vi.fn(async () => "t-new"),
  updateTask: vi.fn(async () => {}),
  deleteTask: vi.fn(async () => {}),
  getTask: vi.fn(async (id: string): Promise<Task | null> => (id ? null : null)),
  // The bulk actions read their rows in ONE query now. The stub delegates to
  // `getTask` so every existing per-id setup below still describes the data,
  // and drops misses exactly as the real batched read does.
  getTasksByIds: vi.fn(async (ids: readonly string[]): Promise<Task[]> => {
    const rows = await Promise.all(ids.map((id) => repo.getTask(id)));
    return rows.filter((t): t is Task => !!t);
  }),
  bulkUpdateTasks: vi.fn(async () => {}),
  bulkDeleteTasks: vi.fn(async () => {}),
  syncTaskLinks: vi.fn(async () => {}),
  purgeTaskLinks: vi.fn(async () => {}),
  // archivedGuard() loads the edition to see whether it is archived. Takes the
  // id so a test can make ONE edition locked and leave the others open.
  getEvent: vi.fn(async (id: string) => ({ id, locked: false })),
};
vi.mock("@/lib/data/repo", () => repo);

const {
  createTaskAction, updateTaskAction, deleteTaskAction,
  duplicateTaskAction, bulkSetStatusAction, bulkDeleteTasksAction,
  bulkUpdateTaskFieldsAction,
} = await import("./tasks");

const user = (over: Partial<AppUser> = {}): AppUser => ({
  id: "u1", name: "Tester", email: "t@x.id", role: "admin", ...over,
});

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1", event_id: "ov1", division: "EVENT", no: "1", pic: "Budi",
  title: "Susun proposal", start_date: null, start_raw: "", end_date: null, end_raw: "",
  notes: "", result: "", status: "todo", ...over,
});

const VALID = { event_id: "ov1", division: "EVENT", title: "Tugas baru" };

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(user());
  repo.createTask.mockResolvedValue("t-new");
  repo.getTask.mockResolvedValue(task());
});

describe("createTaskAction - permission gate", () => {
  it("refuses a guest before touching the repo", async () => {
    currentUser.mockResolvedValue(user({ role: "guest" }));
    const res = await createTaskAction(VALID);
    expect(res.ok).toBe(false);
    expect(repo.createTask).not.toHaveBeenCalled();
  });

  it("allows an intern - the matrix grants tasks:limited to staff & intern", async () => {
    currentUser.mockResolvedValue(user({ role: "intern" }));
    expect((await createTaskAction(VALID)).ok).toBe(true);
  });

  it("allows a coordinator", async () => {
    currentUser.mockResolvedValue(user({ role: "coordinator" }));
    expect((await createTaskAction(VALID)).ok).toBe(true);
    expect(repo.createTask).toHaveBeenCalledTimes(1);
  });
});

describe("archive lock", () => {
  // An archived Ormawa Visit is read-only for every role but admin. The DB
  // enforces it too (writable_event() in migration 0028); these cover the app
  // half, which exists to return a sentence instead of a raw RLS error.
  const archived = { id: "ov1", locked: true };

  it("refuses a create from every non-admin role, without touching the repo", async () => {
    repo.getEvent.mockResolvedValue(archived);
    for (const role of ["coordinator", "staff", "intern"] as const) {
      currentUser.mockResolvedValue(user({ role }));
      const res = await createTaskAction(VALID);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("diarsipkan");
    }
    expect(repo.createTask).not.toHaveBeenCalled();
  });

  it("refuses an edit and a delete inside an archived edition", async () => {
    repo.getEvent.mockResolvedValue(archived);
    currentUser.mockResolvedValue(user({ role: "coordinator" }));
    expect((await updateTaskAction("t1", { status: "done" })).ok).toBe(false);
    expect((await deleteTaskAction("t1")).ok).toBe(false);
    expect(repo.updateTask).not.toHaveBeenCalled();
    expect(repo.deleteTask).not.toHaveBeenCalled();
  });

  it("still lets an admin write, so an archived edition can be corrected", async () => {
    repo.getEvent.mockResolvedValue(archived);
    currentUser.mockResolvedValue(user({ role: "admin" }));
    expect((await createTaskAction(VALID)).ok).toBe(true);
    expect((await updateTaskAction("t1", { status: "done" })).ok).toBe(true);
  });

  it("does not get in the way when the edition is open", async () => {
    repo.getEvent.mockResolvedValue({ id: "ov1", locked: false });
    currentUser.mockResolvedValue(user({ role: "intern" }));
    expect((await createTaskAction(VALID)).ok).toBe(true);
  });
});

describe("createTaskAction - validation gate", () => {
  it("rejects an empty title without writing", async () => {
    const res = await createTaskAction({ ...VALID, title: "   " });
    expect(res.ok).toBe(false);
    expect(repo.createTask).not.toHaveBeenCalled();
  });

  it("passes the PARSED data to the repo, not the raw payload", async () => {
    // Trimming + unknown-key stripping is the mass-assignment guard; a raw
    // passthrough here is the exact bug the review caught in prospects/links.
    await createTaskAction({ ...VALID, title: "  Padded  ", hacker: "x" } as never);
    const arg = (repo.createTask.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(arg.title).toBe("Padded");
    expect(arg.hacker).toBeUndefined();
  });

  it("rejects a result link that is not http(s), and never writes", async () => {
    const res = await createTaskAction(VALID, [
      { url: "javascript:alert(1)", label: "", in_super_link: false },
    ]);
    expect(res.ok).toBe(false);
    expect(repo.createTask).not.toHaveBeenCalled();
  });

  it("rejects duplicate result links (they would double-post to Super Link)", async () => {
    const res = await createTaskAction(VALID, [
      { url: "https://a.com/x", label: "", in_super_link: true },
      { url: "https://a.com/x/", label: "", in_super_link: true },
    ]);
    expect(res.ok).toBe(false);
  });

  it("syncs links only after the task exists", async () => {
    const res = await createTaskAction(VALID, [
      { url: "https://a.com/x", label: "Proposal", in_super_link: true },
    ]);
    expect(res.ok).toBe(true);
    expect(repo.syncTaskLinks).toHaveBeenCalledTimes(1);
  });
});

describe("updateTaskAction - progress-only lane", () => {
  it("lets a staff member submit status + result on a task", async () => {
    currentUser.mockResolvedValue(user({ role: "staff" }));
    const res = await updateTaskAction("t1", { status: "done", result: "selesai" });
    expect(res.ok).toBe(true);
    expect(repo.updateTask).toHaveBeenCalledWith("t1", { status: "done", result: "selesai" });
  });

  // CURRENT BEHAVIOUR, pinned deliberately: `can.editTask` and
  // `can.editTaskProgress` both resolve to atLeast(user,"tasks","limited"), and
  // the matrix gives staff & intern "limited". So the `onlyProgress` branch in
  // updateTaskAction has no effect today - a staff member may edit ANY field.
  // If the intent is "staff/intern may only move progress", the matrix (or
  // editTask) has to change; this test will fail loudly when it does.
  it("currently lets a staff member rename a task (progress-only lane is a no-op)", async () => {
    currentUser.mockResolvedValue(user({ role: "staff" }));
    const res = await updateTaskAction("t1", { title: "Judul baru" });
    expect(res.ok).toBe(true);
    expect(repo.updateTask).toHaveBeenCalledWith("t1", { title: "Judul baru" });
  });

  it("still refuses a guest", async () => {
    currentUser.mockResolvedValue(user({ role: "guest" }));
    const res = await updateTaskAction("t1", { status: "done" });
    expect(res.ok).toBe(false);
    expect(repo.updateTask).not.toHaveBeenCalled();
  });

  it("reports a missing task instead of writing", async () => {
    repo.getTask.mockResolvedValue(null);
    const res = await updateTaskAction("nope", { status: "done" });
    expect(res.ok).toBe(false);
    expect(repo.updateTask).not.toHaveBeenCalled();
  });

  it("surfaces a repo/RLS failure as an error result", async () => {
    // Silently swallowing this is why "changing status did nothing".
    repo.updateTask.mockRejectedValueOnce(new Error("permission denied for table tasks"));
    const res = await updateTaskAction("t1", { status: "done" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("permission denied");
  });
});

describe("deleteTaskAction", () => {
  it("requires full access - a staff member cannot delete", async () => {
    currentUser.mockResolvedValue(user({ role: "staff" }));
    expect((await deleteTaskAction("t1")).ok).toBe(false);
    expect(repo.deleteTask).not.toHaveBeenCalled();
  });

  it("purges the task's Super Link rows before deleting the task", async () => {
    const order: string[] = [];
    repo.purgeTaskLinks.mockImplementation(async () => void order.push("purge"));
    repo.deleteTask.mockImplementation(async () => void order.push("delete"));
    expect((await deleteTaskAction("t1")).ok).toBe(true);
    expect(order).toEqual(["purge", "delete"]);
  });
});

describe("duplicateTaskAction", () => {
  it("copies the plan but resets progress", async () => {
    repo.getTask.mockResolvedValue(task({ status: "done", result: "hasil lama" }));
    expect((await duplicateTaskAction("t1")).ok).toBe(true);
    const arg = (repo.createTask.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(arg.status).toBe("todo");
    expect(arg.result ?? "").toBe("");
    expect(String(arg.title)).toContain("salinan");
  });
});

describe("bulk task actions", () => {
  it("applies one batched write and reports nothing skipped", async () => {
    const res = await bulkSetStatusAction(["t1", "t2"], "done");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.count).toBe(2);
      expect(res.skipped).toBe(0);
    }
    expect(repo.bulkUpdateTasks).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid status outright", async () => {
    const res = await bulkSetStatusAction(["t1"], "bogus" as never);
    expect(res.ok).toBe(false);
    expect(repo.bulkUpdateTasks).not.toHaveBeenCalled();
  });

  it("counts rows it could not act on instead of failing silently", async () => {
    repo.getTask.mockImplementation(async (id: string) => (id === "gone" ? null : task({ id })));
    const res = await bulkSetStatusAction(["t1", "gone"], "done");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.count).toBe(1);
      expect(res.skipped).toBe(1);
    }
  });

  it("surfaces a bulk write failure", async () => {
    repo.bulkUpdateTasks.mockRejectedValueOnce(new Error("permission denied"));
    expect((await bulkSetStatusAction(["t1"], "done")).ok).toBe(false);
  });

  // ----------------------------------------------------------------
  // bulkUpdateTaskFieldsAction - the Work Breakdown "Ubah massal" editor.
  // The load-bearing property is that ONLY the ticked fields travel: a bulk
  // write lands on rows nobody opened, so a key that slipped through would
  // blank a PIC or a deadline across the whole selection.
  // ----------------------------------------------------------------
  it("writes only the fields that were supplied", async () => {
    repo.getTask.mockImplementation(async (id: string) => task({ id }));
    const res = await bulkUpdateTaskFieldsAction(["t1", "t2"], { end_date: "2026-09-01" });
    expect(res.ok).toBe(true);
    expect(repo.bulkUpdateTasks).toHaveBeenCalledTimes(1);
    expect(repo.bulkUpdateTasks).toHaveBeenCalledWith(["t1", "t2"], { end_date: "2026-09-01" });
  });

  it("can set all three fields together", async () => {
    repo.getTask.mockImplementation(async (id: string) => task({ id }));
    await bulkUpdateTaskFieldsAction(["t1"], { division: "LO", pic: "Sinta", end_date: null });
    expect(repo.bulkUpdateTasks).toHaveBeenCalledWith(["t1"], { division: "LO", pic: "Sinta", end_date: null });
  });

  it("refuses an empty patch rather than issuing a no-op write", async () => {
    const res = await bulkUpdateTaskFieldsAction(["t1"], {});
    expect(res.ok).toBe(false);
    expect(repo.bulkUpdateTasks).not.toHaveBeenCalled();
  });

  it("strips keys outside the bulk allow-list (title stays per-task)", async () => {
    repo.getTask.mockImplementation(async (id: string) => task({ id }));
    const res = await bulkUpdateTaskFieldsAction(
      ["t1"],
      { pic: "Sinta", title: "diretas", status: "done" } as never,
    );
    expect(res.ok).toBe(true);
    expect(repo.bulkUpdateTasks).toHaveBeenCalledWith(["t1"], { pic: "Sinta" });
  });

  it("needs edit access, not just progress access", async () => {
    currentUser.mockResolvedValue(user({ role: "guest" }));
    const res = await bulkUpdateTaskFieldsAction(["t1"], { pic: "Sinta" });
    expect(res.ok).toBe(false);
    expect(repo.bulkUpdateTasks).not.toHaveBeenCalled();
  });

  it("refuses when a selected task sits in an archived edition", async () => {
    currentUser.mockResolvedValue(user({ role: "coordinator" }));
    repo.getTask.mockImplementation(async (id: string) => task({ id }));
    repo.getEvent.mockResolvedValue({ id: "ov1", locked: true });
    const res = await bulkUpdateTaskFieldsAction(["t1"], { pic: "Sinta" });
    expect(res.ok).toBe(false);
    expect(repo.bulkUpdateTasks).not.toHaveBeenCalled();
    repo.getEvent.mockResolvedValue({ id: "ov1", locked: false });
  });

  it("bulk delete needs full access and purges links for each row", async () => {
    currentUser.mockResolvedValue(user({ role: "staff" }));
    const denied = await bulkDeleteTasksAction(["t1"]);
    expect(denied.ok).toBe(true);
    if (denied.ok) expect(denied.count).toBe(0); // all skipped, nothing deleted
    expect(repo.bulkDeleteTasks).not.toHaveBeenCalled();

    currentUser.mockResolvedValue(user({ role: "admin" }));
    repo.getTask.mockImplementation(async (id: string) => task({ id }));
    const ok = await bulkDeleteTasksAction(["t1", "t2"]);
    expect(ok.ok).toBe(true);
    expect(repo.purgeTaskLinks).toHaveBeenCalledTimes(2);
    expect(repo.bulkDeleteTasks).toHaveBeenCalledTimes(1);
  });
});

// ------------------------------------------------------------------
// Archive lock. `writable_event()` in migration 0028 is the real control; these
// cover the UX half, whose whole job is to answer with a sentence a committee
// member can act on instead of a raw "new row violates row-level security
// policy". A missing guard is invisible until someone hits it in an archived
// edition, which is exactly when it is least welcome.
// ------------------------------------------------------------------
describe("archive lock on task writes", () => {
  const archived = (lockedId: string) =>
    repo.getEvent.mockImplementation(async (id: string) => ({ id, locked: id === lockedId }));

  beforeEach(() => {
    currentUser.mockResolvedValue(user({ role: "coordinator" }));
    repo.getTask.mockImplementation(async (id: string) => task({ id }));
  });

  it("refuses a bulk STATUS change in an archived edition", async () => {
    archived("ov1");
    const res = await bulkSetStatusAction(["t1", "t2"], "done");
    expect(res.ok).toBe(false);
    expect(repo.bulkUpdateTasks).not.toHaveBeenCalled();
  });

  it("refuses a bulk DELETE in an archived edition", async () => {
    archived("ov1");
    const res = await bulkDeleteTasksAction(["t1"]);
    expect(res.ok).toBe(false);
    expect(repo.bulkDeleteTasks).not.toHaveBeenCalled();
    expect(repo.purgeTaskLinks).not.toHaveBeenCalled();
  });

  it("refuses the WHOLE batch when only one row sits in the archived edition", async () => {
    // All-or-nothing: writing the writable half and silently dropping the rest
    // would report a count that does not match what changed.
    archived("ov-arsip");
    repo.getTask.mockImplementation(async (id: string) =>
      task({ id, event_id: id === "t2" ? "ov-arsip" : "ov1" }),
    );
    const res = await bulkSetStatusAction(["t1", "t2"], "done");
    expect(res.ok).toBe(false);
    expect(repo.bulkUpdateTasks).not.toHaveBeenCalled();
  });

  it("refuses MOVING a task into an archived edition", async () => {
    // The guard used to check only the edition the task came FROM, so a task
    // could be dropped into a locked one.
    archived("ov-arsip");
    const res = await updateTaskAction("t1", { event_id: "ov-arsip" });
    expect(res.ok).toBe(false);
    expect(repo.updateTask).not.toHaveBeenCalled();
  });

  it("still allows moving a task between two OPEN editions", async () => {
    archived("ov-arsip");
    const res = await updateTaskAction("t1", { event_id: "ov2" });
    expect(res.ok).toBe(true);
    expect(repo.updateTask).toHaveBeenCalledWith("t1", { event_id: "ov2" });
  });

  it("lets an admin through: they can still correct an archived edition", async () => {
    archived("ov1");
    currentUser.mockResolvedValue(user({ role: "admin" }));
    const res = await bulkSetStatusAction(["t1"], "done");
    expect(res.ok).toBe(true);
    expect(repo.bulkUpdateTasks).toHaveBeenCalledTimes(1);
  });
});
