import { describe, it, expect } from "vitest";
import { formatCommentTime, openThreadCount, sortThreads, threadSize, toThreads } from "./task-comments";
import { can } from "./permissions";
import type { AppUser, Role, TaskComment } from "./types";

function comment(over: Partial<TaskComment> & { id: string }): TaskComment {
  return {
    task_id: "t1",
    parent_id: null,
    body: "halo",
    author_id: "u1",
    author_name: "Fadhiil",
    author_role: "staff",
    resolved: false,
    resolved_at: null,
    resolved_by: "",
    created_at: "2026-09-20T03:00:00.000Z",
    ...over,
  };
}

const user = (role: Role, id = "u1"): AppUser => ({
  id,
  name: "Someone",
  email: role === "guest" ? "" : `${role}@x.id`,
  role,
});

describe("toThreads", () => {
  it("groups replies under the root that started them", () => {
    const threads = toThreads([
      comment({ id: "a" }),
      comment({ id: "a1", parent_id: "a" }),
      comment({ id: "b" }),
      comment({ id: "a2", parent_id: "a" }),
    ]);
    expect(threads.map((t) => t.root.id)).toEqual(["a", "b"]);
    expect(threads[0].replies.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(threads[1].replies).toEqual([]);
    expect(threadSize(threads[0])).toBe(3);
  });

  it("drops an orphaned reply instead of promoting it to a root", () => {
    // A root that is gone (or simply not in this slice) must not leave its
    // reply standing as a thread of its own: a root is what raises the
    // notification, and this would light a task up over an answer to nothing.
    const threads = toThreads([comment({ id: "x1", parent_id: "gone" })]);
    expect(threads).toEqual([]);
  });

  it("handles no data and no comments the same way", () => {
    expect(toThreads(undefined)).toEqual([]);
    expect(toThreads([])).toEqual([]);
  });
});

describe("openThreadCount - what the notification badge counts", () => {
  it("counts only unresolved roots", () => {
    const list = [
      comment({ id: "a" }),
      comment({ id: "a1", parent_id: "a" }),
      comment({ id: "b", resolved: true }),
    ];
    expect(openThreadCount(list)).toBe(1);
  });

  it("is zero once every thread is ticked, which is what hides the badge", () => {
    expect(openThreadCount([comment({ id: "a", resolved: true })])).toBe(0);
    expect(openThreadCount([])).toBe(0);
    expect(openThreadCount(undefined)).toBe(0);
  });

  it("never counts a reply, even one that somehow carries resolved", () => {
    // The DB CHECK refuses this row; the counter must not depend on it.
    const list = [comment({ id: "a1", parent_id: "a", resolved: false })];
    expect(openThreadCount(list)).toBe(0);
  });
});

describe("sortThreads", () => {
  it("puts open threads above finished ones, newest first inside each group", () => {
    const threads = toThreads([
      comment({ id: "old-open", created_at: "2026-01-01T00:00:00.000Z" }),
      comment({ id: "new-open", created_at: "2026-03-01T00:00:00.000Z" }),
      comment({ id: "new-done", created_at: "2026-04-01T00:00:00.000Z", resolved: true }),
    ]);
    expect(sortThreads(threads).map((t) => t.root.id)).toEqual([
      "new-open",
      "old-open",
      "new-done",
    ]);
  });

  it("does not mutate its input", () => {
    const threads = toThreads([comment({ id: "a", resolved: true }), comment({ id: "b" })]);
    const before = threads.map((t) => t.root.id);
    sortThreads(threads);
    expect(threads.map((t) => t.root.id)).toEqual(before);
  });
});

describe("formatCommentTime", () => {
  it("renders in Asia/Jakarta, not the host clock", () => {
    // 03:00 UTC is 10:00 WIB. Formatting on the host would give a different
    // answer on the server than in the browser and blow up hydration.
    expect(formatCommentTime("2026-09-20T03:00:00.000Z")).toContain("10");
    expect(formatCommentTime("2026-09-20T03:00:00.000Z")).toContain("2026");
  });

  it("returns an empty string for nothing and for junk", () => {
    expect(formatCommentTime(null)).toBe("");
    expect(formatCommentTime("")).toBe("");
    expect(formatCommentTime("bukan tanggal")).toBe("");
  });
});

describe("who may do what with a comment", () => {
  it("only admin, koordinator and staff may START a thread", () => {
    expect(can.startTaskComment(user("admin"))).toBe(true);
    expect(can.startTaskComment(user("coordinator"))).toBe(true);
    expect(can.startTaskComment(user("staff"))).toBe(true);
    // The rule this whole feature turns on.
    expect(can.startTaskComment(user("intern"))).toBe(false);
    expect(can.startTaskComment(user("guest"))).toBe(false);
  });

  it("an intern may REPLY, which is the other half of that rule", () => {
    expect(can.replyTaskComment(user("intern"))).toBe(true);
    expect(can.replyTaskComment(user("staff"))).toBe(true);
    // Tamu (and anyone inside an archived edition, who is attenuated to Tamu)
    // reads only.
    expect(can.replyTaskComment(user("guest"))).toBe(false);
  });

  it("ticking a thread as finished needs the same roles as starting one", () => {
    expect(can.resolveTaskComment(user("staff"))).toBe(true);
    expect(can.resolveTaskComment(user("intern"))).toBe(false);
  });

  it("deletes: your own always, someone else's only with full access", () => {
    expect(can.deleteTaskComment(user("intern", "me"), "me")).toBe(true);
    expect(can.deleteTaskComment(user("intern", "me"), "someone-else")).toBe(false);
    expect(can.deleteTaskComment(user("staff", "me"), "someone-else")).toBe(false);
    expect(can.deleteTaskComment(user("coordinator", "me"), "someone-else")).toBe(true);
    expect(can.deleteTaskComment(user("admin", "me"), "someone-else")).toBe(true);
    // A blank author (a legacy row, or a demo identity) is nobody's, so the
    // "it is mine" branch must not match an empty id.
    expect(can.deleteTaskComment(user("intern", ""), "")).toBe(false);
    // Read-only accounts get nothing at all, not even their own.
    expect(can.deleteTaskComment(user("guest", "me"), "me")).toBe(false);
  });
});
