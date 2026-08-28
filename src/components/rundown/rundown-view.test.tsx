import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  setRundownDivisionJobAction: vi.fn(async () => ({ ok: true as const })),
  updateRundownAction: vi.fn(async () => ({ ok: true as const })),
  createRundownAction: vi.fn(async () => ({ ok: true as const })),
  deleteRundownAction: vi.fn(async () => ({ ok: true as const })),
  duplicateRundownAction: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/actions/schedule", () => actions);
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { RundownView } = await import("./rundown-view");

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
    fireEvent.change(eventCell, { target: { value: "Siapkan panggung" } });
    fireEvent.blur(eventCell);

    expect(actions.setRundownDivisionJobAction).toHaveBeenCalledTimes(1);
    expect(actions.setRundownDivisionJobAction).toHaveBeenCalledWith(
      "r1", "EVENT", "Siapkan panggung",
    );
    // The old payload shape must not come back through the generic update path.
    expect(actions.updateRundownAction).not.toHaveBeenCalled();
  });

  it("does not save a cell that was focused and left unchanged", () => {
    render(
      <RundownView
        items={[row({ division_jobs: { LO: "Jaga meja depan" } })]}
        divisions={DIVISIONS}
        eventId="ov1"
        canManage
        canDelete
      />,
    );
    fireEvent.blur(divisionCell(0, 0));
    expect(actions.setRundownDivisionJobAction).not.toHaveBeenCalled();
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
  });
});
