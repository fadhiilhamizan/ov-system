import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { IMPORT_MODULES, parseGrid, type ImportContext } from "./core";
import { specFor } from "./modules";

import { buildTemplate, readWorkbook, EXAMPLE_SHEET, DATA_SHEET } from "./xlsx.server";

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

const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe("XLSX templates", () => {
  it.each(IMPORT_MODULES)("%s: the example sheet imports cleanly", async (module) => {
    const spec = specFor(module);
    const buf = await buildTemplate(spec, CTX);
    const grid = await readWorkbook(toArrayBuffer(buf), spec.maxRows, EXAMPLE_SHEET);
    const res = parseGrid(spec, CTX, grid);
    expect(res.missingColumns).toEqual([]);
    expect(res.errors).toEqual([]);
    expect(res.rows.length).toBe(spec.examples(CTX).length);
  });

  it.each(IMPORT_MODULES)("%s: has the four sheets, rules first", async (module) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(toArrayBuffer(await buildTemplate(specFor(module), CTX)));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Petunjuk", "Data", "Contoh", "Referensi"]);
  });

  it("the empty Data sheet has headers only and parses to zero rows", async () => {
    const spec = specFor("tasks");
    const grid = await readWorkbook(toArrayBuffer(await buildTemplate(spec, CTX)), spec.maxRows, DATA_SHEET);
    const res = parseGrid(spec, CTX, grid);
    expect(res.missingColumns).toEqual([]);
    expect(res.rows).toEqual([]);
  });

  it("rundown: merged example cells come back as spans, not repeated text", async () => {
    const spec = specFor("rundown");
    const grid = await readWorkbook(toArrayBuffer(await buildTemplate(spec, CTX)), spec.maxRows, EXAMPLE_SHEET);
    const res = parseGrid(spec, CTX, grid);
    // MC merged over "Pembukaan" + "Sambutan"
    expect(res.rows[1].values.mc).toBe("Dewi & Raka");
    expect(res.rows[1].spans.mc).toBe(2);
    expect(res.rows[2].values.mc).toBeNull();
    // second division column merged over the first three sessions
    expect(res.rows[0].spans["job:CRE"]).toBe(3);
    // excluded divisions never get a column
    expect(spec.columns(CTX).some((c) => c.key === "job:SEC")).toBe(false);
  });

  it("tasks: a merged Divisi cell is FILLED into each covered row", async () => {
    const spec = specFor("tasks");
    const grid = await readWorkbook(toArrayBuffer(await buildTemplate(spec, CTX)), spec.maxRows, EXAMPLE_SHEET);
    const res = parseGrid(spec, CTX, grid);
    expect(res.rows[0].values.division).toBe("EVENT");
    expect(res.rows[1].values.division).toBe("EVENT");
    expect(res.rows[1].spans).toEqual({});
  });

  it("budget: the Total column is a formula in the template", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(toArrayBuffer(await buildTemplate(specFor("budget"), CTX)));
    const v = wb.getWorksheet("Data")!.getCell("F2").value as { formula?: string };
    expect(v.formula).toContain("C2*E2");
  });

  it("refuses a file that is not a workbook", async () => {
    await expect(readWorkbook(new TextEncoder().encode("bukan xlsx").buffer as ArrayBuffer, 10)).rejects.toThrow(/xlsx/);
  });
});
