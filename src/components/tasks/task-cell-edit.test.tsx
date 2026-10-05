import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import type { AppUser, Division, OVEvent, Task } from "@/lib/types";

// ============================================================
// The pencil on each Work Breakdown cell: which cells get one, who sees it,
// and that it edits exactly that one field of that one row.
// ============================================================

vi.mock("@/lib/i18n/provider", () => ({ useT: () => (s: string) => s }));
const updateTaskAction = vi.hoisted(() => vi.fn(async () => ({ ok: true as const })));
vi.mock("@/lib/actions/tasks", () => ({
  bulkSetStatusAction: vi.fn(),
  bulkDeleteTasksAction: vi.fn(),
  setTaskStatusAction: vi.fn(),
  deleteTaskAction: vi.fn(),
  duplicateTaskAction: vi.fn(),
  createTaskAction: vi.fn(),
  updateTaskAction,
}));
vi.mock("@/lib/actions/task-comments", () => ({
  startTaskCommentAction: vi.fn(),
  replyTaskCommentAction: vi.fn(),
  setTaskCommentResolvedAction: vi.fn(),
  deleteTaskCommentAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const { TaskTable } = await import("./task-table");

const staff: AppUser = { id: "u1", name: "Tester", email: "t@x.id", role: "staff" };
const guest: AppUser = { id: "u2", name: "Tamu", email: "g@x.id", role: "guest" };

const divisions: Division[] = [
  { id: "d1", event_id: "ov1", key: "EVENT", name: "Event", short: "EVE", color: "#111", order: 1 },
  { id: "d2", event_id: "ov1", key: "LO", name: "Liaison Officer", short: "LO", color: "#222", order: 2 },
];
const events: OVEvent[] = [
  { id: "ov1", code: "OV1", title: "OV", partner: "", campus: "", type: "external",
    mode: "offline", cabinet: "", event_date: null, plan_start: null, plan_end: null,
    location: "", status: "planning", locked: false, order: 1 } as OVEvent,
];
const task: Task = {
  id: "t1", event_id: "ov1", division: "EVENT", no: "1", pic: "Budi", title: "Sewa venue",
  start_date: null, start_raw: "", end_date: "2026-10-10", end_raw: "",
  notes: "", evaluation: "Telat konfirmasi", result: "", status: "todo",
};

const mount = (user: AppUser) =>
  render(<TaskTable tasks={[task]} divisions={divisions} events={events} activeEventId="ov1" user={user} />);

const pencils = () => screen.queryAllByRole("button", { name: /^Edit / });

beforeEach(() => { vi.clearAllMocks(); });

describe("per-cell edit pencil", () => {
  it("puts one on every editable column, and none on Status", () => {
    mount(staff);
    expect(pencils().map((b) => b.getAttribute("aria-label"))).toEqual([
      "Edit Tugas", "Edit Evaluasi", "Edit Divisi", "Edit PIC", "Edit Deadline", "Edit Referensi", "Edit Hasil",
    ]);
    const row = screen.getByText("Sewa venue").closest("tr")!;
    const cells = [...row.querySelectorAll("td")];
    // checkbox, #, Tugas, Evaluasi, Divisi, PIC, Deadline, Status, ...
    const statusCell = cells[7];
    expect(within(statusCell).queryByRole("button", { name: /^Edit / })).toBeNull();
    expect(within(cells[1]).queryByRole("button", { name: /^Edit / })).toBeNull();
  });

  it("reserves room so the pencil does not cover the cell's content", () => {
    mount(staff);
    for (const b of pencils()) expect(b.closest("td")?.className).toContain("pr-8");
  });

  it("shows nothing to a read-only role", () => {
    mount(guest);
    expect(pencils()).toHaveLength(0);
  });

  it("edits only that field of that row", async () => {
    mount(staff);
    fireEvent.click(screen.getByRole("button", { name: "Edit Evaluasi" }));
    const box = screen.getByLabelText("Evaluasi");
    fireEvent.change(box, { target: { value: "Konfirmasi H-7" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Simpan" })); });
    expect(updateTaskAction).toHaveBeenCalledWith("t1", { evaluation: "Konfirmasi H-7" });
  });

  it("can clear a deadline", async () => {
    mount(staff);
    fireEvent.click(screen.getByRole("button", { name: "Edit Deadline" }));
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: "" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Simpan" })); });
    expect(updateTaskAction).toHaveBeenCalledWith("t1", { end_date: null });
  });
});
