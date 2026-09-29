import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { IMPORT_MODULES, parseGrid, TEMPLATE_VERSION, type ImportContext } from "./core";
import { specFor } from "./modules";
import {
  annotateWorkbook, buildTemplate, readWorkbook, readMeta, EXAMPLE_SHEET, DATA_SHEET,
} from "./xlsx.server";

// ============================================================
// Every template must be able to import its own example.
//
// This is the test that keeps "the template works" true per menu: it builds
// the real .xlsx with exceljs, reads the "Contoh" sheet back through the same
// reader the upload uses, and parses it with the same spec. A column renamed
// in one place and not the other, an example value the parser rejects, or a
// merge the reader loses all fail here, not in front of a committee member.
// ============================================================

const CTX: ImportContext = {
  eventTitle: "OV Uji",
  divisions: [
    { key: "EVENT", name: "Event", short: "EVE" },
    { key: "CRE", name: "Creative", short: "CRE" },
    { key: "SEC", name: "Sekretaris", short: "SEC", exclude_from_rundown: true },
  ],
  members: ["Dewi", "Raka", "Salsa", "Bima"],
};

const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function load(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(ab(buf));
  return wb;
}

describe("XLSX templates", () => {
  it.each(IMPORT_MODULES)("%s: the example sheet imports without errors", async (module) => {
    const spec = specFor(module);
    const read = await readWorkbook(ab(await buildTemplate(spec, CTX)), spec.maxRows, EXAMPLE_SHEET);
    const res = parseGrid(spec, CTX, read.grid);
    expect(res.missingColumns).toEqual([]);
    expect(res.errors).toEqual([]);
    expect(res.rows.length).toBe(spec.examples(CTX).length);
    // ...and every example row is recognised as one, so a copied example is
    // flagged when it turns up on the Data sheet.
    expect(res.warnings.filter((w) => /contoh/.test(w.message))).toHaveLength(res.rows.length);
  });

  it.each(IMPORT_MODULES)("%s: four sheets, rules first, Referensi protected", async (module) => {
    const wb = await load(await buildTemplate(specFor(module), CTX));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Petunjuk", "Data", "Contoh", "Referensi"]);
    expect((wb.getWorksheet("Referensi") as unknown as { sheetProtection?: object }).sheetProtection).toBeTruthy();
  });

  it("records which menu and edition the template was made for", async () => {
    const buf = await buildTemplate(specFor("rundown"), CTX, "ov-42");
    const read = await readWorkbook(ab(buf), 300);
    expect(read.meta).toEqual({ version: TEMPLATE_VERSION, module: "rundown", eventId: "ov-42" });
    expect(readMeta("something else")).toBeNull();
  });

  it("the empty Data sheet has headers only and parses to zero rows", async () => {
    const spec = specFor("tasks");
    const read = await readWorkbook(ab(await buildTemplate(spec, CTX)), spec.maxRows, DATA_SHEET);
    const res = parseGrid(spec, CTX, read.grid);
    expect(res.missingColumns).toEqual([]);
    expect(res.rows).toEqual([]);
    expect(read.sheetName).toBe("Data");
  });

  it("Data cells carry an input hint, text columns are text, and dropdowns point at Referensi", async () => {
    const wb = await load(await buildTemplate(specFor("prospects"), CTX));
    const ws = wb.getWorksheet("Data")!;
    const heads = Array.from(ws.getRow(1).values as unknown[], (x) => String(x ?? ""));
    const col = (h: string) => heads.findIndex((x) => x.startsWith(h));
    const contact = ws.getCell(2, col("Kontak"));
    expect(contact.dataValidation?.prompt).toMatch(/narahubung/i);
    // A phone number typed into a text column keeps its leading 0.
    expect(ws.getColumn(col("Kontak")).numFmt).toBe("@");
    const mode = ws.getCell(2, col("Mode"));
    expect(mode.dataValidation?.type).toBe("list");
    expect(String(mode.dataValidation?.formulae?.[0])).toContain("Referensi");
  });

  it("required cells are highlighted by conditional formatting", async () => {
    const wb = await load(await buildTemplate(specFor("tasks"), CTX));
    const cf = (wb.getWorksheet("Data") as unknown as { conditionalFormattings: { ref: string }[] }).conditionalFormattings;
    // Divisi and Judul Tugas are the required ones.
    expect(cf.map((c) => c.ref)).toEqual(["A2:A301", "B2:B301"]);
  });

  it("the rundown template has no upload-only column, but the rules sheet explains it", async () => {
    const wb = await load(await buildTemplate(specFor("rundown"), CTX));
    const heads = (wb.getWorksheet("Data")!.getRow(1).values as unknown[]).map(String);
    expect(heads).not.toContain("Waktu");
    const rulesText = JSON.stringify(wb.getWorksheet("Petunjuk")!.getSheetValues());
    expect(rulesText).toContain("Kolom alternatif");
    expect(rulesText).toContain("Gabungkan secara vertikal");
  });

  it("rundown: merged example cells come back as spans, not repeated text", async () => {
    const spec = specFor("rundown");
    const read = await readWorkbook(ab(await buildTemplate(spec, CTX)), spec.maxRows, EXAMPLE_SHEET);
    const res = parseGrid(spec, CTX, read.grid);
    expect(res.rows[1].values.mc).toBe("Dewi & Raka");
    expect(res.rows[1].spans.mc).toBe(2);
    expect(res.rows[2].values.mc).toBeNull();
    expect(res.rows[0].spans["job:CRE"]).toBe(3);
    expect(spec.columns(CTX).some((c) => c.key === "job:SEC")).toBe(false);
  });

  it("tasks: a merged Divisi cell is FILLED into each covered row", async () => {
    const spec = specFor("tasks");
    const read = await readWorkbook(ab(await buildTemplate(spec, CTX)), spec.maxRows, EXAMPLE_SHEET);
    const res = parseGrid(spec, CTX, read.grid);
    expect(res.rows[0].values.division).toBe("EVENT");
    expect(res.rows[1].values.division).toBe("EVENT");
    expect(res.rows[1].spans).toEqual({});
  });

  it("budget: the Total column is a formula, and it is never imported", async () => {
    const wb = await load(await buildTemplate(specFor("budget"), CTX));
    const v = wb.getWorksheet("Data")!.getCell("F2").value as { formula?: string };
    expect(v.formula).toContain("C2*E2");
  });
});

describe("reading uploads", () => {
  async function upload(rows: unknown[][], setup?: (ws: ExcelJS.Worksheet) => void) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Data");
    rows.forEach((r) => ws.addRow(r));
    setup?.(ws);
    return ab(Buffer.from(await wb.xlsx.writeBuffer()));
  }

  it("reads formula results, and Excel errors as errors", async () => {
    const buf = await upload([["Kategori", "Nama Item", "Qty"], ["A", "B", null]], (ws) => {
      ws.getCell("C2").value = { formula: "1/0", result: { error: "#DIV/0!" } } as ExcelJS.CellFormulaValue;
    });
    const read = await readWorkbook(buf, 100);
    const res = parseGrid(specFor("budget"), CTX, read.grid);
    expect(res.errors[0].message).toMatch(/#DIV\/0!/);
  });

  it("a hyperlink cell labelled 'Link' imports its target", async () => {
    const buf = await upload([["Nama Tautan", "URL"], ["Folder", null]], (ws) => {
      ws.getCell("B2").value = { text: "Link", hyperlink: "https://drive.google.com/x" };
    });
    const res = parseGrid(specFor("links"), CTX, (await readWorkbook(buf, 100)).grid);
    expect(res.rows[0].values.url).toBe("https://drive.google.com/x");
  });

  it("refuses a file that is not a workbook, with a readable reason", async () => {
    await expect(readWorkbook(new TextEncoder().encode("bukan xlsx").buffer as ArrayBuffer, 10)).rejects.toThrow(/\.xlsx/);
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    await expect(readWorkbook(ole.buffer, 10)).rejects.toThrow(/\.xls/);
  });
});

describe("the report", () => {
  it("marks each problem cell and lists everything on a first sheet", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Data");
    ws.addRow(["Divisi", "Judul Tugas"]);
    ws.addRow(["Hantu", "A"]);
    ws.addRow(["Event", "B"]);
    const buf = ab(Buffer.from(await wb.xlsx.writeBuffer()));

    const out = await load(await annotateWorkbook(buf, "Data", 0, [
      { line: 2, column: "Divisi", key: "division", col: 0, level: "error", message: "Divisi tidak ada." },
      { line: 3, column: "-", level: "warning", message: "Sudah ada." },
    ]));
    expect(out.worksheets[0].name).toBe("Hasil Pemeriksaan");
    const data = out.getWorksheet("Data")!;
    const bad = data.getCell("A2");
    expect((bad.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFFECACA");
    expect(String(bad.note)).toContain("Divisi tidak ada.");
    expect(data.getCell("C1").value).toBe("Hasil Pemeriksaan");
    expect(String(data.getCell("C3").value)).toContain("Sudah ada.");
    // The original values are untouched.
    expect(data.getCell("B2").value).toBe("A");
  });
});
