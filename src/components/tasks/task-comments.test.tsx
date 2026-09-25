import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { AppUser, Role, Task, TaskComment } from "@/lib/types";

// ============================================================
// The visible half of task comments.
//
// Four rules that only exist on screen, and would each fail silently:
//   * the notification is ABSENT - not greyed, not zero - when nothing is open;
//   * ticking a thread as finished takes the notification away, while the
//     conversation stays reachable from the Edit dialog;
//   * an intern sees a reply box but no "start a note" box;
//   * every message says who wrote it and when.
// ============================================================

vi.mock("@/lib/i18n/provider", () => ({ useT: () => (s: string) => s }));

const start = vi.fn(async () => ({ ok: true as const }));
const reply = vi.fn(async () => ({ ok: true as const }));
const resolve = vi.fn(async () => ({ ok: true as const }));
const remove = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/lib/actions/task-comments", () => ({
  startTaskCommentAction: (...a: unknown[]) => start(...(a as [])),
  replyTaskCommentAction: (...a: unknown[]) => reply(...(a as [])),
  setTaskCommentResolvedAction: (...a: unknown[]) => resolve(...(a as [])),
  deleteTaskCommentAction: (...a: unknown[]) => remove(...(a as [])),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { TaskCommentBadge, TaskCommentsPanel } = await import("./task-comments");
const { TaskCommentsProvider } = await import("./task-comments-context");

const task: Task = {
  id: "t1", event_id: "ov1", division: "EVENT", no: "1", pic: "Budi",
  title: "Susun proposal", start_date: null, start_raw: "", end_date: null, end_raw: "",
  notes: "", evaluation: "", result: "", status: "todo",
};

const user = (role: Role, id = "u1"): AppUser => ({
  id, name: "Tester", email: "t@x.id", role,
});

const comment = (over: Partial<TaskComment> & { id: string }): TaskComment => ({
  task_id: "t1", parent_id: null, body: "Tolong revisi bagian anggaran",
  author_id: "u9", author_name: "Dona", author_role: "coordinator",
  resolved: false, resolved_at: null, resolved_by: "", created_at: "2026-09-20T03:00:00.000Z",
  ...over,
});

function mount(node: React.ReactNode, comments?: TaskComment[]) {
  return render(
    <TaskCommentsProvider value={comments ? { t1: comments } : undefined}>
      {node}
    </TaskCommentsProvider>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe("TaskCommentBadge - the notification on a Work Breakdown row", () => {
  it("is not rendered at all when the task has no comments", () => {
    const { container } = mount(<TaskCommentBadge task={task} user={user("staff")} />, []);
    expect(container.querySelector("button")).toBeNull();
  });

  it("is not rendered when every thread has been ticked as finished", () => {
    // This is what "menutup notifikasi pada job" means: the tick removes the
    // badge, it does not merely restyle it.
    const { container } = mount(
      <TaskCommentBadge task={task} user={user("staff")} />,
      [comment({ id: "c1", resolved: true, resolved_by: "Dona" })],
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("shows how many threads are still open", () => {
    mount(<TaskCommentBadge task={task} user={user("staff")} />, [
      comment({ id: "c1" }),
      comment({ id: "c2", body: "Satu lagi" }),
      comment({ id: "c3", resolved: true }),
      comment({ id: "c1r", parent_id: "c1", body: "Siap" }),
    ]);
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("renders nothing when the page provided no comment data at all", () => {
    const { container } = mount(<TaskCommentBadge task={task} user={user("staff")} />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("opens a mini chat with the message, its author and its time", async () => {
    mount(<TaskCommentBadge task={task} user={user("intern")} />, [comment({ id: "c1" })]);
    fireEvent.click(screen.getByRole("button", { name: /Lihat catatan tugas/ }));
    await waitFor(() => expect(screen.getByText("Tolong revisi bagian anggaran")).toBeTruthy());
    expect(screen.getByText("Dona")).toBeTruthy();
    // 03:00 UTC is 10:00 in Asia/Jakarta - the pinned zone, not the host's.
    expect(screen.getByText(/20 Sep 2026, 10\.00/)).toBeTruthy();
  });

  it("leaves finished threads out of the popover - they live in Edit now", async () => {
    mount(<TaskCommentBadge task={task} user={user("staff")} />, [
      comment({ id: "c1", body: "Masih berjalan" }),
      comment({ id: "c2", body: "Sudah kelar", resolved: true }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: /Lihat catatan tugas/ }));
    await waitFor(() => expect(screen.getByText("Masih berjalan")).toBeTruthy());
    expect(screen.queryByText("Sudah kelar")).toBeNull();
  });
});

describe("TaskCommentsPanel - the full history in the Edit dialog", () => {
  it("shows finished threads too, which is how old notes stay reachable", () => {
    mount(<TaskCommentsPanel task={task} user={user("staff")} />, [
      comment({ id: "c1", body: "Masih berjalan" }),
      comment({ id: "c2", body: "Sudah kelar", resolved: true, resolved_by: "Dona" }),
    ]);
    expect(screen.getByText("Masih berjalan")).toBeTruthy();
    expect(screen.getByText("Sudah kelar")).toBeTruthy();
    expect(screen.getByText("Selesai")).toBeTruthy();
  });

  it("gives staff a box to start a new note", () => {
    mount(<TaskCommentsPanel task={task} user={user("staff")} />, []);
    expect(screen.getByText("Catatan baru untuk tugas ini")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Kirim catatan/ })).toBeTruthy();
  });

  it("tells an intern why they have no such box, and still lets them reply", () => {
    mount(<TaskCommentsPanel task={task} user={user("intern")} />, [comment({ id: "c1" })]);
    expect(screen.queryByText("Catatan baru untuk tugas ini")).toBeNull();
    expect(screen.getByText(/Hanya admin, koordinator, dan staff/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Balas/ })).toBeTruthy();
  });

  it("renders nothing when the page provided no comment data", () => {
    const { container } = mount(<TaskCommentsPanel task={task} user={user("staff")} />);
    expect(container.textContent).toBe("");
  });

  it("sends a new note through the server action", async () => {
    mount(<TaskCommentsPanel task={task} user={user("staff")} />, []);
    fireEvent.change(screen.getByPlaceholderText(/Revisi, informasi tambahan/), {
      target: { value: "Mohon dikoreksi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Kirim catatan/ }));
    await waitFor(() =>
      expect(start).toHaveBeenCalledWith({ task_id: "t1", body: "Mohon dikoreksi" }));
  });

  it("sends a reply against the thread's ROOT, not the message clicked", async () => {
    mount(<TaskCommentsPanel task={task} user={user("intern")} />, [
      comment({ id: "c1" }),
      comment({ id: "c1r", parent_id: "c1", body: "Balasan lama" }),
    ]);
    fireEvent.change(screen.getByPlaceholderText("Tulis balasan…"), {
      target: { value: "Siap, saya perbaiki" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Balas/ }));
    await waitFor(() =>
      expect(reply).toHaveBeenCalledWith({ parent_id: "c1", body: "Siap, saya perbaiki" }));
  });

  it("keeps a finished thread replyable - the tick closes the badge, not the chat", () => {
    mount(<TaskCommentsPanel task={task} user={user("intern")} />, [
      comment({ id: "c1", resolved: true, resolved_by: "Dona" }),
    ]);
    expect(screen.getByRole("button", { name: /Balas/ })).toBeTruthy();
  });

  it("offers staff the tick, and an intern nothing to tick with", () => {
    const open = [comment({ id: "c1" })];
    const { unmount } = mount(<TaskCommentsPanel task={task} user={user("staff")} />, open);
    expect(screen.getByRole("button", { name: "Tandai selesai" })).toBeTruthy();
    unmount();

    mount(<TaskCommentsPanel task={task} user={user("intern")} />, open);
    expect(screen.queryByRole("button", { name: "Tandai selesai" })).toBeNull();
  });

  it("ticks the thread through the server action", async () => {
    mount(<TaskCommentsPanel task={task} user={user("staff")} />, [comment({ id: "c1" })]);
    fireEvent.click(screen.getByRole("button", { name: "Tandai selesai" }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith("c1", true));
  });

  it("offers to reopen a finished thread instead", async () => {
    mount(<TaskCommentsPanel task={task} user={user("staff")} />, [
      comment({ id: "c1", resolved: true }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Buka lagi" }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith("c1", false));
  });

  it("lets a writer delete only their own message", () => {
    mount(<TaskCommentsPanel task={task} user={user("intern", "u3")} />, [
      comment({ id: "c1", author_id: "u9" }),
      comment({ id: "c1r", parent_id: "c1", author_id: "u3", body: "Punyaku" }),
    ]);
    expect(screen.getAllByRole("button", { name: "Hapus catatan" })).toHaveLength(1);
  });
});
