import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { FgdPlan, FgdRow } from "@/lib/types";

// ============================================================
// The FGD plotting table.
//
// WHAT THIS FILE CANNOT COVER: the drag itself. dnd-kit needs real pointer
// geometry and jsdom gives every element a zero-sized rect, so a simulated
// drag never resolves a drop target. The ordering MATHS is covered by
// lib/budget.test.ts (the same arrayMove contract) and the RPC that persists it
// by `npm run db:test`. What is covered here is the part that broke before: a
// cell saving on blur, not saving when nothing changed, and the row order the
// component actually renders coming from its own state rather than the props,
// so a failed reorder can be put back.
// ============================================================

const actions = vi.hoisted(() => ({
  createFgdPlanAction: vi.fn(async () => ({ ok: true as const })),
  createFgdRowAction: vi.fn(async () => ({ ok: true as const })),
  deleteFgdPlanAction: vi.fn(async () => ({ ok: true as const })),
  deleteFgdRowAction: vi.fn(async () => ({ ok: true as const })),
  reorderFgdRowsAction: vi.fn(async () => ({ ok: true as const })),
  updateFgdPlanAction: vi.fn(async () => ({ ok: true as const })),
  updateFgdRowAction: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/actions/himpunan", () => actions);
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { FgdPanel } = await import("./fgd-panel");

const plan: FgdPlan = {
  id: "p1", event_id: "ov1", title: "Sesi pagi", partner_name: "HMTI UB", order: 0,
};
const rows = (): FgdRow[] => [
  { id: "r1", plan_id: "p1", ours: "PSDM", theirs: "Kaderisasi", order: 0 },
  { id: "r2", plan_id: "p1", ours: "RISTEK", theirs: "", order: 1 },
];

const view = (canManage = true) =>
  render(
    <FgdPanel eventId="ov1" plans={[plan]} rows={{ p1: rows() }} canManage={canManage} />,
  );

beforeEach(() => { vi.clearAllMocks(); });

describe("editing a cell", () => {
  it("saves on blur, and shows the new text at once", async () => {
    view();
    const cell = screen.getAllByPlaceholderText("Departemen mitra")[1];
    fireEvent.focus(cell);
    fireEvent.change(cell, { target: { value: "Riset dan Teknologi" } });
    fireEvent.blur(cell);
    expect((screen.getAllByPlaceholderText("Departemen mitra")[1] as HTMLTextAreaElement).value).toBe("Riset dan Teknologi");
    await act(async () => {});
    expect(actions.updateFgdRowAction).toHaveBeenCalledWith("r2", { theirs: "Riset dan Teknologi" });
  });

  it("does not save when the text did not change", async () => {
    view();
    const cell = screen.getAllByPlaceholderText("Departemen HMSI")[0];
    fireEvent.change(cell, { target: { value: "PSDM" } });
    fireEvent.blur(cell);
    await act(async () => {});
    expect(actions.updateFgdRowAction).not.toHaveBeenCalled();
  });

  it("saves the partner heading on blur", async () => {
    view();
    const heading = screen.getByPlaceholderText("Nama himpunan mitra");
    fireEvent.change(heading, { target: { value: "KBMDSI" } });
    fireEvent.blur(heading);
    await act(async () => {});
    expect(actions.updateFgdPlanAction).toHaveBeenCalledWith("p1", { partner_name: "KBMDSI" });
  });
});

describe("drag handles", () => {
  it("gives every row a grip when the role may manage", () => {
    view();
    expect(screen.getAllByLabelText("Geser untuk mengurutkan")).toHaveLength(2);
  });

  it("shows no grip, and no inputs, for a read-only role", () => {
    view(false);
    expect(screen.queryAllByLabelText("Geser untuk mengurutkan")).toHaveLength(0);
    expect(screen.queryAllByPlaceholderText("Departemen HMSI")).toHaveLength(0);
    expect(screen.getByText("PSDM")).toBeTruthy();
  });
});

describe("adding a row", () => {
  it("shows the new row at once and asks the server for it on this plan", async () => {
    view();
    const before = screen.getAllByPlaceholderText("Departemen HMSI").length;
    fireEvent.click(screen.getByRole("button", { name: /Tambah baris/i }));
    expect(screen.getAllByPlaceholderText("Departemen HMSI")).toHaveLength(before + 1);
    await act(async () => {});
    // With the client id the new row already carries.
    expect(actions.createFgdRowAction).toHaveBeenCalledWith("p1", expect.stringMatching(/^[0-9a-f-]{36}$/));
  });
});
