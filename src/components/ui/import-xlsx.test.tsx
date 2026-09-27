import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ImportPreview } from "@/lib/actions/import";

// The dialog's job is to never let a bad file through the button, to show
// WHERE each problem is, and to refuse obviously wrong files before they are
// even uploaded. The actions are faked; their own rules are tested elsewhere.
const actions = vi.hoisted(() => ({
  previewImportAction: vi.fn(),
  commitImportAction: vi.fn(),
  importReportAction: vi.fn(),
  downloadImportTemplateAction: vi.fn(),
}));
vi.mock("@/lib/actions/import", () => actions);
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { ImportXlsxButton } = await import("./import-xlsx");

function preview(over: Partial<ImportPreview> = {}): ImportPreview {
  return {
    ok: true, total: 2, errorCount: 0, warningCount: 0, existingCount: 0, canSkipExisting: true,
    notes: [], ignoredHeaders: [], fileIssues: [], sheetName: "Data",
    columns: [{ key: "division", header: "Divisi" }, { key: "title", header: "Judul Tugas" }],
    rows: [
      { line: 2, cells: ["EVENT", "Booking"], existing: false, issues: [] },
      { line: 3, cells: ["EVENT", "Rundown"], existing: false, issues: [] },
    ],
    ...over,
  };
}

async function openAndPick(name = "isi.xlsx") {
  render(<ImportXlsxButton module="tasks" />);
  fireEvent.click(screen.getByRole("button", { name: "Import XLSX" }));
  const input = document.querySelector("input[type=file]") as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(["x"], name)] } });
  });
}

const importButton = () => screen.getAllByRole("button").find((b) => /^Impor/.test(b.textContent ?? ""))!;

beforeEach(() => vi.clearAllMocks());

describe("ImportXlsxButton", () => {
  it("refuses a .csv in the browser, without uploading it", async () => {
    await openAndPick("data.csv");
    expect(actions.previewImportAction).not.toHaveBeenCalled();
    expect(screen.getByText(/belum didukung/)).toBeTruthy();
  });

  it("previews a clean file and enables Impor with the row count", async () => {
    actions.previewImportAction.mockResolvedValue(preview());
    await openAndPick();
    expect(screen.getByText("Booking")).toBeTruthy();
    expect(importButton().textContent).toContain("Impor 2 baris");
    expect((importButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps Impor disabled and shows the message in the offending cell", async () => {
    actions.previewImportAction.mockResolvedValue(preview({
      errorCount: 1,
      rows: [{ line: 2, cells: ["Hantu", "Booking"], existing: false, issues: [{ c: 0, level: "error", message: "Divisi tidak ada." }] }],
      total: 1,
    }));
    await openAndPick();
    expect((importButton() as HTMLButtonElement).disabled).toBe(true);
    const msg = screen.getByText("Divisi tidak ada.");
    expect(msg.closest("td")?.textContent).toContain("Hantu");
    expect(screen.getByText("Unduh laporan pemeriksaan")).toBeTruthy();
  });

  it("skipping rows that already exist lowers the count, and is sent along", async () => {
    actions.previewImportAction.mockResolvedValue(preview({
      existingCount: 1, warningCount: 1,
      rows: [
        { line: 2, cells: ["EVENT", "Booking"], existing: true, issues: [{ c: -1, level: "warning", message: "Sudah ada." }] },
        { line: 3, cells: ["EVENT", "Rundown"], existing: false, issues: [] },
      ],
    }));
    actions.commitImportAction.mockResolvedValue({ ok: true, inserted: 1, skipped: 1 });
    await openAndPick();
    expect(importButton().textContent).toContain("Impor 1 baris");
    await act(async () => { fireEvent.click(importButton()); });
    const fd = actions.commitImportAction.mock.calls[0][0] as FormData;
    expect(fd.get("skipExisting")).toBe("1");
    expect(screen.getByText(/1 baris dilewati/)).toBeTruthy();
  });
});
