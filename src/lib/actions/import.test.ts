import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import type { AppUser } from "@/lib/types";

// ============================================================
// The XLSX import actions, with identity, session and persistence faked and
// everything in between real: canImport, the archive check of the workbook,
// the reader, the parser, the Zod re-validation. The invariants:
//   - a role that cannot add rows by hand cannot import them either;
//   - a file with ANY error writes nothing (all rows or none);
//   - rows land in the SESSION's edition, whatever the file says;
//   - rows that already exist can be skipped, except in the rundown;
//   - nothing about the file is stored: the only writes are the inserts.
// ============================================================

const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("./revalidate", () => ({ revalidateEntities: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getActiveEvent: async () => ({ id: "ov1", title: "OV Uji", code: "OV-UJI", locked: false }),
}));
vi.mock("@/lib/data/repo", () => ({
  getEvent: vi.fn(async (id: string) => ({ id, locked: false })),
  getDivisions: vi.fn(async () => [
    { key: "EVENT", name: "Event", short: "EVE", color: "#000", order: 1 },
  ]),
  getMembers: vi.fn(async () => [{ name: "Dewi" }, { name: "Raka" }]),
  getBudgetPlans: vi.fn(async () => [{ id: "plan1", name: "RAB", event_id: "ov1", is_primary: true, items: [] }]),
}));
vi.mock("@/lib/data/himpunan-repo", () => ({
  getFgdPlans: vi.fn(async () => []),
  getCompareSubjects: vi.fn(async () => []),
}));
const writes = vi.hoisted(() => ({
  existingRows: vi.fn(async (): Promise<Record<string, unknown>[]> => []),
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

const {
  previewImportAction, commitImportAction, downloadImportTemplateAction, importReportAction,
} = await import("./import");

const admin: AppUser = { id: "a", name: "Admin", email: "a@x", role: "admin" };
const guest: AppUser = { id: "g", name: "Tamu", email: "", role: "guest" };

async function xlsx(rows: (string | number | null)[][], subject?: string): Promise<File> {
  const wb = new ExcelJS.Workbook();
  if (subject) wb.subject = subject;
  const ws = wb.addWorksheet("Data");
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return new File([buf], "isi.xlsx");
}

function form(module: string, file: File, opts: { target?: string; skip?: boolean } = {}) {
  const fd = new FormData();
  fd.set("module", module);
  fd.set("target", opts.target ?? "");
  fd.set("file", file);
  fd.set("skipExisting", opts.skip ? "1" : "0");
  return fd;
}

const inserts = () => Object.entries(writes).filter(([k]) => k.startsWith("insert"));

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(admin);
});

describe("XLSX import actions", () => {
  it("a guest can neither preview, import, report, nor fetch a template", async () => {
    currentUser.mockResolvedValue(guest);
    const file = await xlsx([["Divisi", "Judul Tugas"], ["Event", "A"]]);
    expect((await previewImportAction(form("tasks", file))).ok).toBe(false);
    expect((await commitImportAction(form("tasks", file))).ok).toBe(false);
    expect((await importReportAction(form("tasks", file))).ok).toBe(false);
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
    expect(preview).toMatchObject({ ok: true, total: 2, errorCount: 0, existingCount: 0 });

    const res = await commitImportAction(form("tasks", file));
    expect(res).toEqual({ ok: true, inserted: 2, skipped: 0 });
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
    // The preview places the error on its row and column.
    if (preview.ok) {
      const row = preview.rows.find((r) => r.line === 3)!;
      expect(row.issues).toEqual([expect.objectContaining({ c: 0, level: "error" })]);
    }
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

  it("flags rows that already exist, and skips them only when asked", async () => {
    writes.existingRows.mockResolvedValue([{ division: "EVENT", title: "Booking ruangan" }]);
    const file = await xlsx([["Divisi", "Judul Tugas"], ["Event", "Booking ruangan"], ["Event", "Baru"]]);
    const preview = await previewImportAction(form("tasks", file));
    expect(preview).toMatchObject({ ok: true, existingCount: 1, canSkipExisting: true, errorCount: 0 });
    expect(writes.existingRows).toHaveBeenCalledWith("tasks", "ov1", "");

    const skipped = await commitImportAction(form("tasks", file, { skip: true }));
    expect(skipped).toEqual({ ok: true, inserted: 1, skipped: 1 });
    expect(writes.insertTasks).toHaveBeenLastCalledWith([expect.objectContaining({ title: "Baru" })]);

    const both = await commitImportAction(form("tasks", file, { skip: false }));
    expect(both).toEqual({ ok: true, inserted: 2, skipped: 0 });
  });

  it("never skips rows in the rundown, where merges depend on every row", async () => {
    writes.existingRows.mockResolvedValue([{ time_start: "08.00", activity: "Pembukaan" }]);
    const file = await xlsx([["Waktu Mulai", "Kegiatan"], ["08.00", "Pembukaan"], ["08.30", "FGD"]]);
    const preview = await previewImportAction(form("rundown", file));
    expect(preview).toMatchObject({ ok: true, existingCount: 1, canSkipExisting: false });
    const res = await commitImportAction(form("rundown", file, { skip: true }));
    expect(res).toEqual({ ok: true, inserted: 2, skipped: 0 });
  });

  it("names the menu when someone uploads another menu's template", async () => {
    const file = await xlsx([["Waktu Mulai", "Kegiatan"], ["08.00", "A"]], "ov-import;v=2;module=rundown;event=ov1");
    const res = await previewImportAction(form("tasks", file));
    expect(res).toEqual({ ok: false, error: expect.stringContaining("template Rundown Acara") });
  });

  it("recognises another menu's sheet by its headers when the metadata is gone", async () => {
    const file = await xlsx([["Waktu Mulai", "Waktu Selesai", "Kegiatan", "MC"], ["08.00", "08.30", "A", "B"]]);
    const res = await previewImportAction(form("tasks", file));
    expect(res).toEqual({ ok: false, error: expect.stringContaining("sepertinya untuk menu Rundown Acara") });
  });

  it("mentions a template made for another edition, and still imports into the active one", async () => {
    const file = await xlsx([["Divisi", "Judul Tugas"], ["Event", "A"]], "ov-import;v=2;module=tasks;event=ov-lain");
    const preview = await previewImportAction(form("tasks", file));
    expect(preview.ok && preview.notes[0]).toMatch(/Ormawa Visit lain/);
  });

  it("budget needs a plan of THIS edition as its target", async () => {
    const file = await xlsx([["Kategori", "Nama Item", "Qty", "Harga Satuan"], ["KONSUMSI", "Snack", 10, "Rp 15.000"]]);
    expect((await commitImportAction(form("budget", file, { target: "plan-lain" }))).ok).toBe(false);
    const res = await commitImportAction(form("budget", file, { target: "plan1" }));
    expect(res.ok).toBe(true);
    expect(writes.insertBudgetItems).toHaveBeenCalledWith("plan1", [
      expect.objectContaining({ category: "KONSUMSI", name: "Snack", qty: 10, unit_price: 15000 }),
    ]);
  });

  it("rundown: an old 'Waktu 08.00 - 08.30' column fills start, end and duration", async () => {
    const file = await xlsx([["No", "Waktu", "Kegiatan"], [1, "08.00 - 08.30", "Pembukaan"]]);
    const res = await commitImportAction(form("rundown", file));
    expect(res.ok).toBe(true);
    expect(writes.insertRundownRows).toHaveBeenCalledWith("ov1", [
      expect.objectContaining({ time_start: "08.00", time_end: "08.30", duration: "30'", activity: "Pembukaan" }),
    ]);
  });

  it("hands back the file with problems marked, and writes nothing", async () => {
    const file = await xlsx([["Divisi", "Judul Tugas"], ["Hantu", "A"]]);
    const res = await importReportAction(form("tasks", file));
    expect(res).toMatchObject({ ok: true, fileName: "isi-hasil-pemeriksaan.xlsx" });
    if (res.ok) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(new Uint8Array(Buffer.from(res.base64, "base64")).buffer);
      expect(wb.worksheets[0].name).toBe("Hasil Pemeriksaan");
    }
    expect(inserts().every(([, fn]) => fn.mock.calls.length === 0)).toBe(true);
  });

  it("rejects the wrong kind of file before reading it", async () => {
    expect(await previewImportAction(form("tasks", new File(["a,b"], "data.csv")))).toEqual({
      ok: false, error: expect.stringMatching(/belum didukung/),
    });
    const ole = new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])], "lama.xlsx");
    expect(await previewImportAction(form("tasks", ole))).toEqual({ ok: false, error: expect.stringMatching(/\.xls/) });
  });

  it("builds a template named after the active edition", async () => {
    const res = await downloadImportTemplateAction("rundown");
    expect(res).toMatchObject({ ok: true, fileName: "template-rundown-ov-uji.xlsx" });
  });
});
