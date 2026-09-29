import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AppUser, Division, OVEvent, Task, TaskComment } from "@/lib/types";

// ============================================================
// Where the comment notification LIVES in the table.
//
// It first shipped as a column of its own, second from the right. The table
// scrolls horizontally (`overflow-x-auto` in ui/table.tsx), and the two
// columns beside it - Referensi and Hasil - are the ones that hold long links
// and long result text. So on exactly the rows most likely to carry a note,
// the marker sat off the right edge of the viewport and nothing on screen
// suggested it was there. You had to scroll sideways to discover a
// notification whose entire job is to be noticed.
//
// It now sits in the "Tugas" cell, which is near the left and effectively
// always visible, plus a stripe down the row's leading edge for scanning. This
// pins both, because neither is expressible as a type and both are one careless
// refactor away from sliding back to the right.
// ============================================================

vi.mock("@/lib/i18n/provider", () => ({ useT: () => (s: string) => s }));
vi.mock("@/lib/actions/tasks", () => ({
  bulkSetStatusAction: vi.fn(),
  bulkDeleteTasksAction: vi.fn(),
  setTaskStatusAction: vi.fn(),
  deleteTaskAction: vi.fn(),
  duplicateTaskAction: vi.fn(),
  createTaskAction: vi.fn(),
  updateTaskAction: vi.fn(),
}));
vi.mock("@/lib/actions/task-comments", () => ({
  startTaskCommentAction: vi.fn(),
  replyTaskCommentAction: vi.fn(),
  setTaskCommentResolvedAction: vi.fn(),
  deleteTaskCommentAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const { TaskTable } = await import("./task-table");
const { TaskCommentsProvider } = await import("./task-comments-context");

const user: AppUser = { id: "u1", name: "Tester", email: "t@x.id", role: "staff" };

const divisions: Division[] = [
  { id: "d1", event_id: "ov1", key: "EVENT", name: "Event", short: "EVE", color: "#111", order: 1 },
];
const events: OVEvent[] = [
  { id: "ov1", code: "OV1", title: "OV", partner: "", campus: "", type: "external",
    mode: "offline", cabinet: "", event_date: null, plan_start: null, plan_end: null,
    location: "", status: "planning", locked: false, order: 1 } as OVEvent,
];

const task = (id: string, title: string): Task => ({
  id, event_id: "ov1", division: "EVENT", no: "1", pic: "Budi", title,
  start_date: null, start_raw: "", end_date: null, end_raw: "",
  notes: "", evaluation: "", result: "", status: "todo",
});

const comment = (over: Partial<TaskComment> & { id: string; task_id: string }): TaskComment => ({
  parent_id: null, body: "Tolong revisi", author_id: "u9", author_name: "Dona",
  author_role: "coordinator", resolved: false, resolved_at: null, resolved_by: "",
  created_at: "2026-09-20T03:00:00.000Z", ...over,
});

const FLAGGED = task("t1", "Tugas bercatatan");
const PLAIN = task("t2", "Tugas biasa");

function mount(comments: Record<string, TaskComment[]>) {
  return render(
    <TaskCommentsProvider value={comments}>
      <TaskTable
        tasks={[FLAGGED, PLAIN]}
        divisions={divisions}
        events={events}
        activeEventId="ov1"
        user={user}
      />
    </TaskCommentsProvider>,
  );
}

const withNote = { t1: [comment({ id: "c1", task_id: "t1" })] };

beforeEach(() => { vi.clearAllMocks(); });

describe("the comment notification's placement", () => {
  it("sits in the same cell as the task title, not in a trailing column", () => {
    mount(withNote);
    const badge = screen.getByRole("button", { name: /Lihat catatan tugas/ });
    const cell = badge.closest("td");
    expect(cell).not.toBeNull();
    // The regression: a marker whose own cell holds nothing else is a column
    // of its own again, and will scroll out of sight.
    expect(cell?.textContent).toContain("Tugas bercatatan");
  });

  it("is one of the first cells in its row, never the last", () => {
    mount(withNote);
    const badge = screen.getByRole("button", { name: /Lihat catatan tugas/ });
    const row = badge.closest("tr")!;
    const cells = [...row.querySelectorAll("td")];
    const at = cells.indexOf(badge.closest("td")!);
    expect(at).toBeGreaterThanOrEqual(0);
    // Title is the 3rd column at most (checkbox, #, Tugas).
    expect(at).toBeLessThanOrEqual(2);
    expect(at).toBeLessThan(cells.length - 1);
  });

  it("marks the flagged row's leading edge, and leaves other rows alone", () => {
    mount(withNote);
    const flaggedRow = screen.getByText("Tugas bercatatan").closest("tr")!;
    const plainRow = screen.getByText("Tugas biasa").closest("tr")!;
    expect(flaggedRow.querySelector("td")?.className).toContain("border-l-amber");
    // Not merely "no stripe": the same 2px of transparent border, so the two
    // rows still line up horizontally.
    expect(plainRow.querySelector("td")?.className).toContain("border-l-transparent");
    expect(plainRow.querySelector("td")?.className).not.toContain("border-l-amber");
  });

  it("shows no marker and reserves no room when nothing has a note", () => {
    const { container } = mount({});
    expect(screen.queryByRole("button", { name: /Lihat catatan tugas/ })).toBeNull();
    // The reserved slot costs indent on every title, so a table with no
    // comments at all must not pay for it.
    expect(container.querySelector(".min-w-7")).toBeNull();
  });

  it("keeps the marker out of the title's dialog trigger", () => {
    // A button inside a button is a hydration error and an unclickable
    // control - the badge has to be a sibling of the trigger.
    mount(withNote);
    const badge = screen.getByRole("button", { name: /Lihat catatan tugas/ });
    expect(badge.querySelector("button")).toBeNull();
    expect(badge.closest("button:not([aria-label])")).toBeNull();
  });
});
