import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AppUser, Division, OVEvent, Task, TaskComment } from "@/lib/types";

// ============================================================
// The "Catatan: masih aktif" filter in the Work Breakdown toolbar.
//
// It answers one question people actually ask standing in front of this table:
// which tasks are still waiting on something somebody wrote. A note that was
// ticked off is finished business, so it must NOT keep its task in the list -
// that is the difference between this filter and "has any comment at all", and
// it is the part a refactor is most likely to get wrong.
// ============================================================

vi.mock("@/lib/i18n/provider", () => ({ useT: () => (s: string) => s }));
vi.mock("@/lib/actions/tasks", () => ({
  bulkSetStatusAction: vi.fn(), bulkDeleteTasksAction: vi.fn(),
  setTaskStatusAction: vi.fn(), deleteTaskAction: vi.fn(),
  duplicateTaskAction: vi.fn(), createTaskAction: vi.fn(), updateTaskAction: vi.fn(),
}));
vi.mock("@/lib/actions/task-comments", () => ({
  startTaskCommentAction: vi.fn(), replyTaskCommentAction: vi.fn(),
  setTaskCommentResolvedAction: vi.fn(), deleteTaskCommentAction: vi.fn(),
}));
vi.mock("@/lib/actions/session", () => ({ setActiveDivision: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const { TasksView } = await import("./tasks-view");
const { TaskCommentsProvider } = await import("./task-comments-context");

const user: AppUser = { id: "u1", name: "Tester", email: "t@x.id", role: "staff" };
const divisions: Division[] = [
  { id: "d1", event_id: "ov1", key: "EVENT", name: "Event", short: "EVE", color: "#111", order: 1 },
];
const events: OVEvent[] = [{ id: "ov1", code: "OV1", title: "OV" } as OVEvent];

const task = (id: string, title: string): Task => ({
  id, event_id: "ov1", division: "EVENT", no: "1", pic: "Budi", title,
  start_date: null, start_raw: "", end_date: null, end_raw: "",
  notes: "", result: "", status: "todo",
});

const comment = (over: Partial<TaskComment> & { id: string; task_id: string }): TaskComment => ({
  parent_id: null, body: "Tolong revisi", author_id: "u9", author_name: "Dona",
  author_role: "coordinator", resolved: false, resolved_at: null, resolved_by: "",
  created_at: "2026-09-21T03:00:00.000Z", ...over,
});

// Judulnya sengaja tidak memakai kata "catatan": kalau tidak, judul tugas ikut
// tertangkap saat test mencari tombol filternya.
const OPEN = task("t1", "Masih ditunggu jawabannya");
const RESOLVED = task("t2", "Sudah tuntas dibahas");
const NONE = task("t3", "Tidak pernah dibahas");

function mount(comments?: Record<string, TaskComment[]>) {
  return render(
    <TaskCommentsProvider value={comments}>
      <TasksView
        tasks={[OPEN, RESOLVED, NONE]}
        divisions={divisions}
        events={events}
        activeEventId="ov1"
        user={user}
      />
    </TaskCommentsProvider>,
  );
}

const COMMENTS = {
  t1: [comment({ id: "c1", task_id: "t1" })],
  t2: [comment({ id: "c2", task_id: "t2", resolved: true, resolved_by: "Dona" })],
};

const toggle = () => screen.getByRole("button", { name: /Saring tugas yang masih punya catatan aktif/ });
const titles = () => [OPEN, RESOLVED, NONE]
  .filter((t) => screen.queryAllByText(t.title).length > 0)
  .map((t) => t.title);

beforeEach(() => { vi.clearAllMocks(); });

describe("the active-notes filter", () => {
  it("shows every task until it is switched on", () => {
    mount(COMMENTS);
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    expect(titles()).toEqual([OPEN.title, RESOLVED.title, NONE.title]);
  });

  it("keeps only tasks whose notes are still open", () => {
    mount(COMMENTS);
    fireEvent.click(toggle());
    // The resolved one drops out with the note-less one: ticked off is done,
    // not "still has a comment".
    expect(titles()).toEqual([OPEN.title]);
  });

  it("switches back off", () => {
    mount(COMMENTS);
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(titles()).toHaveLength(3);
  });

  it("counts how many tasks it would leave, before you press it", () => {
    mount(COMMENTS);
    // One open thread across three tasks. A filter that cannot say what it
    // will do is a filter people press once and never trust again.
    expect(toggle().textContent).toContain("1");
  });

  it("is cleared by Reset along with the others", () => {
    mount(COMMENTS);
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(titles()).toHaveLength(3);
  });

  it("is not rendered at all when the page provided no comment data", () => {
    // Papan Divisi and Kalender can mount this view without comments; a filter
    // that permanently matches nothing is worse than no filter.
    mount(undefined);
    expect(screen.queryByRole("button", { name: /catatan aktif/ })).toBeNull();
  });
});
