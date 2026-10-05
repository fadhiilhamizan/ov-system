import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { Division, RundownItem } from "@/lib/types";

// ============================================================
// The first component test in this project, and it exists for a specific
// reason: the two most expensive rundown bugs were both invisible to every
// other gate. `tsc`, `eslint` and 456 logic tests were all green while the
// table remounted its inputs on every save and silently reverted a division
// cell that had just been filled in.
//
// Both assertions below fail against the code as it was before v1.38.1, which
// is the only thing that makes them worth keeping.
// ============================================================

const actions = vi.hoisted(() => ({
  saveRundownChangesAction: vi.fn(async (changes: unknown) => ({ ok: true as const, changes })),
  createRundownAction: vi.fn(async () => ({ ok: true as const })),
  deleteRundownAction: vi.fn(async () => ({ ok: true as const })),
  bulkDeleteRundownAction: vi.fn(async () => ({ ok: true as const })),
  duplicateRundownAction: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/actions/schedule", () => actions);
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { RundownView } = await import("./rundown-view");
const { FLUSH_DELAY } = await import("./use-rundown-queue");

/** Let the batch timer fire and the save chain run. */
async function flushQueue() {
  await act(async () => { await vi.advanceTimersByTimeAsync(FLUSH_DELAY + 50); });
}

const DIVISIONS: Division[] = [
  { key: "LO", name: "Liaison Officer", short: "LO", color: "#6366f1", order: 1 },
  { key: "EVENT", name: "Event", short: "EVE", color: "#10b981", order: 2 },
];

function row(over: Partial<RundownItem> = {}): RundownItem {
  return {
    id: "r1", event_id: "ov1", variant: "A", no: 1,
    time_start: "08.00", time_end: "08.30", duration: "30'",
    activity: "Registrasi", keterangan: "", mc: "", operator: "",
    division_jobs: {}, merges: {},
    ...over,
  };
}

/** The textarea for one division column on one row. */
function divisionCell(rowIndex: number, divIndex: number): HTMLTextAreaElement {
  const tr = document.querySelectorAll("tbody tr")[rowIndex];
  const areas = tr.querySelectorAll("textarea");
  // order per row: Kegiatan, MC, Operator, ...divisions, Catatan
  return areas[3 + divIndex] as HTMLTextAreaElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("RundownView", () => {
  it("renders one column per division that is not excluded from the rundown", () => {
    render(
      <RundownView
        items={[row()]}
        divisions={[...DIVISIONS, {
          key: "SECRETARY", name: "Sekretaris", short: "SEC",
          color: "#f59e0b", order: 3, exclude_from_rundown: true,
        }]}
        eventId="ov1"
        canManage
        canDelete
      />,
    );
    const heads = [...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim());
    expect(heads).toContain("LO");
    expect(heads).toContain("EVE");
    expect(heads).not.toContain("SEC");
  });

  it("keeps the same input element across a re-render (no remount)", () => {
    // REGRESSION, A1: MergeableCell used to be declared inside RundownView's
    // body, so every render produced a new component TYPE and React tore down
    // and rebuilt every merged cell. The autosave indicator alone re-renders
    // this component three times per save, so the input a person was typing in
    // was destroyed under them, taking the caret and any uncommitted text.
    //
    // Identity of the DOM node is the whole assertion: reconciliation keeps it
    // when the type is stable and replaces it when it is not.
    const { rerender } = render(
      <RundownView items={[row()]} divisions={DIVISIONS} eventId="ov1" canManage canDelete />,
    );
    const before = divisionCell(0, 0);
    expect(before.tagName).toBe("TEXTAREA");

    // A fresh array with identical content: the same thing a revalidation or an
    // autosave state change does to this component.
    rerender(
      <RundownView items={[row()]} divisions={DIVISIONS} eventId="ov1" canManage canDelete />,
    );

    expect(divisionCell(0, 0)).toBe(before);
  });

  it("sends only the division key it changed, not the whole division_jobs map", async () => {
    // REGRESSION, A2: the cell used to submit
    // `{ ...item.division_jobs, [key]: value }`, rebuilt from the props React
    // happened to be holding. Filling in a second division before the first
    // save came back reverted the first one, with the toast still saying saved.
    render(
      <RundownView
        items={[row({ division_jobs: { LO: "Jaga meja depan" } })]}
        divisions={DIVISIONS}
        eventId="ov1"
        canManage
        canDelete
      />,
    );

    const eventCell = divisionCell(0, 1);
    fireEvent.focus(eventCell);
    fireEvent.change(eventCell, { target: { value: "Siapkan panggung" } });
    fireEvent.blur(eventCell);
    await flushQueue();

    expect(actions.saveRundownChangesAction).toHaveBeenCalledTimes(1);
    // Only the EVENT key: the LO job must not be re-sent from stale props.
    expect(actions.saveRundownChangesAction).toHaveBeenCalledWith([
      { id: "r1", patch: { division_jobs: { EVENT: "Siapkan panggung" } } },
    ]);
  });

  it("shows an edit at once and batches several cells into ONE save", async () => {
    // The table used to make one round trip per cell, each followed by a
    // revalidation, which is what made it feel stuck. Now edits are visible
    // immediately and a pause sends them together.
    render(<RundownView items={[row()]} divisions={DIVISIONS} eventId="ov1" canManage canDelete />);
    const lo = divisionCell(0, 0);
    fireEvent.focus(lo);
    fireEvent.change(lo, { target: { value: "Jaga meja" } });
    fireEvent.blur(lo);
    const ev = divisionCell(0, 1);
    fireEvent.focus(ev);
    fireEvent.change(ev, { target: { value: "Panggung" } });
    fireEvent.blur(ev);

    expect(actions.saveRundownChangesAction).not.toHaveBeenCalled();
    expect(divisionCell(0, 0).value).toBe("Jaga meja");
    await flushQueue();
    expect(actions.saveRundownChangesAction).toHaveBeenCalledTimes(1);
    expect(actions.saveRundownChangesAction).toHaveBeenCalledWith([
      { id: "r1", patch: { division_jobs: { LO: "Jaga meja", EVENT: "Panggung" } } },
    ]);
  });

  it("does not reset a focused cell when fresh props arrive mid-typing", () => {
    const { rerender } = render(
      <RundownView items={[row()]} divisions={DIVISIONS} eventId="ov1" canManage canDelete />,
    );
    const cell = divisionCell(0, 0);
    fireEvent.focus(cell);
    fireEvent.change(cell, { target: { value: "Sedang diketik" } });
    rerender(
      <RundownView
        items={[row({ division_jobs: { LO: "Dari server" } })]}
        divisions={DIVISIONS}
        eventId="ov1"
        canManage
        canDelete
      />,
    );
    expect(divisionCell(0, 0).value).toBe("Sedang diketik");
  });

  it("adds a row immediately, before the server answers", () => {
    render(<RundownView items={[row()]} divisions={DIVISIONS} eventId="ov1" canManage canDelete />);
    fireEvent.click(screen.getByText("Tambah baris"));
    expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("does not save a cell that was focused and left unchanged", async () => {
    render(
      <RundownView
        items={[row({ division_jobs: { LO: "Jaga meja depan" } })]}
        divisions={DIVISIONS}
        eventId="ov1"
        canManage
        canDelete
      />,
    );
    fireEvent.focus(divisionCell(0, 0));
    fireEvent.blur(divisionCell(0, 0));
    await flushQueue();
    expect(actions.saveRundownChangesAction).not.toHaveBeenCalled();
  });

  it("renders read-only cells with no inputs when the user cannot manage", () => {
    render(
      <RundownView
        items={[row({ division_jobs: { LO: "Jaga meja depan" } })]}
        divisions={DIVISIONS}
        eventId="ov1"
        canManage={false}
        canDelete={false}
      />,
    );
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(screen.getByText("Jaga meja depan")).toBeTruthy();
    // No handle and no ticks for a read-only role.
    expect(screen.queryByRole("button", { name: "Geser untuk mengurutkan" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("deletes several ticked rows in ONE call", async () => {
    render(
      <RundownView
        items={[row(), row({ id: "r2", no: 2 }), row({ id: "r3", no: 3 })]}
        divisions={DIVISIONS}
        eventId="ov1"
        canManage
        canDelete
      />,
    );
    const ticks = screen.getAllByRole("checkbox", { name: "Pilih baris" });
    fireEvent.click(ticks[0]);
    fireEvent.click(ticks[2]);
    expect(screen.getByText(/2\s*dipilih/)).toBeTruthy();
    fireEvent.click(screen.getByText("Hapus"));
    const confirm = screen.getAllByText("Hapus").at(-1)!;
    fireEvent.click(confirm);
    // Gone from the table before the server answers.
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
    await flushQueue();
    expect(actions.bulkDeleteRundownAction).toHaveBeenCalledWith(["r1", "r3"]);
    expect(actions.deleteRundownAction).not.toHaveBeenCalled();
  });

  it("shrinks a merged run BEFORE deleting a row inside it", async () => {
    render(
      <RundownView
        items={[
          row({ merges: { mc: 3 }, mc: "Dewi" }),
          row({ id: "r2", no: 2 }),
          row({ id: "r3", no: 3 }),
        ]}
        divisions={DIVISIONS}
        eventId="ov1"
        canManage
        canDelete
      />,
    );
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Pilih baris" })[1]);
    fireEvent.click(screen.getByText("Hapus"));
    fireEvent.click(screen.getAllByText("Hapus").at(-1)!);
    await flushQueue();
    expect(actions.saveRundownChangesAction).toHaveBeenCalledWith([{ id: "r1", patch: { merges: { mc: 2 } } }]);
    expect(actions.deleteRundownAction).toHaveBeenCalledWith("r2");
    expect(actions.saveRundownChangesAction.mock.invocationCallOrder[0])
      .toBeLessThan(actions.deleteRundownAction.mock.invocationCallOrder[0]);
  });

  it("offers no drag handle on a merged row", () => {
    render(
      <RundownView
        items={[
          row({ merges: { LO: 2 } }),
          row({ id: "r2", no: 2 }),
          row({ id: "r3", no: 3 }),
        ]}
        divisions={DIVISIONS}
        eventId="ov1"
        canManage
        canDelete
      />,
    );
    const rows = document.querySelectorAll("tbody tr");
    const handle = (tr: Element) => tr.querySelector('button[aria-label="Geser untuk mengurutkan"]');
    expect(handle(rows[0])).toBeNull();
    expect(handle(rows[1])).toBeNull();
    expect(handle(rows[2])).not.toBeNull();
  });
});
