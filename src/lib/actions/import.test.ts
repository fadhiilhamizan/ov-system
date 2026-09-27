import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import type { AppUser } from "@/lib/types";

// ============================================================
// The XLSX import actions, with identity, session and persistence faked and
// everything in between real: canImport, the workbook reader, the parser, the
// Zod re-validation. The invariants:
//   - a role that cannot add rows by hand cannot import them either;
//   - a file with ANY error writes nothing (all rows or none);
//   - rows land in the SESSION's edition, whatever the file says.
// ============================================================

const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("./revalidate", () => ({ revalidateEntities: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getActiveEvent: async () => ({ id: "ov1", title: "OV Uji", locked: false }),
}));
vi.mock("@/lib/data/repo", () => ({
  getEvent: vi.fn(async (id: string) => ({ id, locked: false })),
  getDivisions: vi.fn(async () => [
    { key: "EVENT", name: "Event", short: "EVE", color: "#000", order: 1 },
  ]),
  getMembers: vi.fn(async () => []),
  getBudgetPlans: vi.fn(async () => [{ id: "plan1", name: "RAB", event_id: "ov1", is_primary: true, items: [] }]),
}));
vi.mock("@/lib/data/himpunan-repo", () => ({
  getFgdPlans: vi.fn(async () => []),
  getCompareSubjects: vi.fn(async () => []),
}));
const writes = vi.hoisted(() => ({
  insertTasks: vi.fn(async () => {}),
  insertProspects: vi.fn(async () => {}),
  insertLinks: vi.fn(async () => {}),
  insertBudgetItems: vi.fn(async () => {}),
  insertRundownRows: vi.fn(async () => {}),
  insertJobs: vi.fn(async () => {}),
  insertMembers: vi.fn(async () => {}),
  insertFgdRows: vi.fn(async () => {}),
  insertCompareEntries: vi.fn(async () => {}),
}));
vi.mock("@/lib/data/import-repo", () => writes);

const { previewImportAction, commitImportAction, downloadImportTemplateAction } = await import("./import");

const admin: AppUser = { id: "a", name: "Admin", email: "a@x", role: "admin" };
const guest: AppUser = { id: "g", name: "Tamu", email: "", role: "guest" };

async function xlsx(rows: (string | number | null)[][]): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data");
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return new File([buf], "isi.xlsx");
}

function form(module: string, file: File, target = "") {
  const fd = new FormData();
  fd.set("module", module);
  fd.set("target", target);
  fd.set("file", file);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(admin);
});

describe("XLSX import actions", () => {
  it("a guest can neither preview, import, nor fetch a template", async () => {
    currentUser.mockResolvedValue(guest);
    const file = await xlsx([["Divisi", "Judul Tugas"], ["Event", "A"]]);
    expect((await previewImportAction(form("tasks", file))).ok).toBe(false);
    expect((await commitImportAction(form("tasks", file))).ok).toBe(false);
    expect((await downloadImportTemplateAction("tasks")).ok).toBe(false);
    expect(Object.values(writes).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });

  it("imports a clean file into the session's edition, in one insert", async () => {
    const file = await xlsx([
      ["Divisi", "Judul Tugas", "Status"],
      ["Event", "Booking ruangan", "On Going"],
      ["EVE", "Susun rundown", ""],
    ]);
    const preview = await previewImportAction(form("tasks", file));
    expect(preview).toMatchObject({ ok: true, total: 2, errorCount: 0 });

    const res = await commitImportAction(form("tasks", file));
    expect(res).toEqual({ ok: true, inserted: 2 });
    expect(writes.insertTasks).toHaveBeenCalledTimes(1);
    expect(writes.insertTasks).toHaveBeenCalledWith([
      expect.objectContaining({ event_id: "ov1", division: "EVENT", title: "Booking ruangan", status: "ongoing" }),
      expect.objectContaining({ event_id: "ov1", division: "EVENT", title: "Susun rundown" }),
    ]);
  });

  it("refuses the WHOLE file when any row has an error", async () => {
    const file = await xlsx([
      ["Divisi", "Judul Tugas"],
      ["Event", "Baik"],
      ["Divisi Hantu", "Buruk"],
    ]);
    const preview = await previewImportAction(form("tasks", file));
    expect(preview).toMatchObject({ ok: true, errorCount: 1 });
    const res = await commitImportAction(form("tasks", file));
    expect(res.ok).toBe(false);
    expect(writes.insertTasks).not.toHaveBeenCalled();
  });

  it("runs the menu's own rules too (a member name may not contain a comma)", async () => {
    const file = await xlsx([["Nama Lengkap", "Divisi"], ["Dewi, S.Kom", "Event"]]);
    const preview = await previewImportAction(form("members", file));
    expect(preview).toMatchObject({ ok: true, errorCount: 1 });
    expect((await commitImportAction(form("members", file))).ok).toBe(false);
    expect(writes.insertMembers).not.toHaveBeenCalled();
  });

  it("budget needs a plan of THIS edition as its target", async () => {
    const file = await xlsx([["Kategori", "Nama Item", "Qty", "Harga Satuan"], ["KONSUMSI", "Snack", 10, "Rp 15.000"]]);
    expect((await commitImportAction(form("budget", file, "plan-lain"))).ok).toBe(false);
    const res = await commitImportAction(form("budget", file, "plan1"));
    expect(res.ok).toBe(true);
    expect(writes.insertBudgetItems).toHaveBeenCalledWith("plan1", [
      expect.objectContaining({ category: "KONSUMSI", name: "Snack", qty: 10, unit_price: 15000 }),
    ]);
  });

  it("rejects something that is not an .xlsx before reading it", async () => {
    const res = await previewImportAction(form("tasks", new File(["a,b"], "data.csv")));
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/xlsx/) });
  });

  it("builds a template for the active edition", async () => {
    const res = await downloadImportTemplateAction("rundown");
    expect(res).toMatchObject({ ok: true, fileName: "template-rundown.xlsx" });
  });
});
