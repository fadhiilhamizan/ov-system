import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { BudgetPlan, OVEvent } from "@/lib/types";

// ============================================================
// The RAB table's two behavioural bugs.
//
// A NOTE ON WHAT THIS FILE CANNOT COVER: the decimal fix hinges on
// `input.validity.badInput`, which is how a real browser reports "0." as
// not-yet-a-number while keeping the text on screen. jsdom sanitises "0." to
// "" and never sets badInput, so that exact path is unreachable here and is
// verified in a real browser instead. What IS covered below is everything
// around it: that decimals survive a round trip, that an emptied cell does not
// silently save zero, and that a failed save rolls back one row rather than the
// whole page.
// ============================================================
const actions = vi.hoisted(() => ({
  updateBudgetItemAction: vi.fn(async () => ({ ok: true as const })),
  createBudgetItemAction: vi.fn(async () => ({ ok: true as const })),
  deleteBudgetItemAction: vi.fn(async () => ({ ok: true as const })),
  bulkDeleteBudgetItemsAction: vi.fn(async () => ({ ok: true as const })),
  duplicateBudgetItemAction: vi.fn(async () => ({ ok: true as const })),
  createBudgetPlanAction: vi.fn(async () => ({ ok: true as const })),
  deleteBudgetPlanAction: vi.fn(async () => ({ ok: true as const })),
  setCategoryColorAction: vi.fn(async () => ({ ok: true as const })),
  reorderBudgetItemsAction: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/actions/budget", () => actions);
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { BudgetView } = await import("./budget-view");

const event: OVEvent = {
  id: "ov1", code: "OV1", title: "OV", partner: "", campus: "", type: "external",
  mode: "offline", cabinet: "", event_date: null, location: "", status: "active", order: 1,
};

function plan(): BudgetPlan {
  return {
    id: "b1",
    name: "RAB Utama",
    event_id: "ov1",
    items: [
      { id: "i1", category: "KONSUMSI", no: 1, name: "Snack", qty: 10, unit: "box", unit_price: 15000, total: 150000, category_color: null },
      { id: "i2", category: "KONSUMSI", no: 2, name: "Air", qty: 4, unit: "dus", unit_price: 20000, total: 80000, category_color: null },
    ],
  };
}

/** The qty / unit-price cells, in render order: [qty i1, price i1, qty i2, price i2]. */
const numCells = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[type="number"]')];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NumCell - decimals and empty cells", () => {
  it("shows a stored decimal as typed, not rounded", () => {
    const p = plan();
    p.items[0].qty = 2.5;
    render(<BudgetView plans={[p]} events={[event]} canManage />);
    expect(numCells()[0].value).toBe("2.5");
  });

  it("saves a decimal quantity", async () => {
    vi.useFakeTimers();
    render(<BudgetView plans={[plan()]} events={[event]} canManage />);
    const qty = numCells()[0];
    fireEvent.change(qty, { target: { value: "1.25" } });
    fireEvent.blur(qty);
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(actions.updateBudgetItemAction).toHaveBeenCalledWith("i1", { qty: 1.25 });
    vi.useRealTimers();
  });

  it("does NOT write zero when a cell is emptied", async () => {
    // `Number("") || 0` used to make clearing a cell and clicking away save a
    // zero into the budget. Emptying a field is how people start retyping.
    vi.useFakeTimers();
    render(<BudgetView plans={[plan()]} events={[event]} canManage />);
    const qty = numCells()[0];
    fireEvent.change(qty, { target: { value: "" } });
    fireEvent.blur(qty);
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(actions.updateBudgetItemAction).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("puts the stored value back on screen after an abandoned edit", async () => {
    render(<BudgetView plans={[plan()]} events={[event]} canManage />);
    const qty = numCells()[0];
    fireEvent.change(qty, { target: { value: "" } });
    fireEvent.blur(qty);
    expect(numCells()[0].value).toBe("10");
  });

  it("does not save when the value did not actually change", async () => {
    vi.useFakeTimers();
    render(<BudgetView plans={[plan()]} events={[event]} canManage />);
    const qty = numCells()[0];
    fireEvent.change(qty, { target: { value: "10" } });
    fireEvent.blur(qty);
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(actions.updateBudgetItemAction).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("optimistic rollback", () => {
  it("rolls back only the row that failed, keeping an earlier successful edit", async () => {
    // REGRESSION: the rollback was `setState(plans)` - a jump all the way back
    // to the server props, which also undid edits that had already SAVED. Those
    // rows then showed a value the database did not have.
    vi.useFakeTimers();
    render(<BudgetView plans={[plan()]} events={[event]} canManage />);

    // Row 1 saves fine.
    actions.updateBudgetItemAction.mockResolvedValueOnce({ ok: true as const });
    fireEvent.change(numCells()[0], { target: { value: "99" } });
    fireEvent.blur(numCells()[0]);
    await act(async () => { await vi.runAllTimersAsync(); });

    // Row 2 fails.
    actions.updateBudgetItemAction.mockResolvedValueOnce({
      ok: false as const, error: "ditolak",
    } as never);
    fireEvent.change(numCells()[2], { target: { value: "77" } });
    fireEvent.blur(numCells()[2]);
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(numCells()[2].value).toBe("4");   // the failed row went back
    expect(numCells()[0].value).toBe("99");  // the saved row was left alone
    vi.useRealTimers();
  });
});

describe("read-only", () => {
  it("renders plain numbers, with no inputs, when the role cannot manage", () => {
    render(<BudgetView plans={[plan()]} events={[event]} canManage={false} />);
    expect(numCells()).toHaveLength(0);
    expect(screen.getByText("Snack")).toBeTruthy();
  });
});
