import { describe, it, expect } from "vitest";
import {
  parseClock, parseDate, parseGrid, parseNumber, normHeader, type Grid, type ImportContext,
} from "./core";
import { specFor } from "./modules";

const CTX: ImportContext = {
  eventTitle: "OV",
  divisions: [
    { key: "EVENT", name: "Event", short: "EVE" },
    { key: "DIV-X1", name: "Creative Media", short: "CRE" },
  ],
  members: [],
};

describe("value parsing", () => {
  it("reads dates the ways people type them", () => {
    expect(parseDate("2026-10-01")).toBe("2026-10-01");
    expect(parseDate("01/10/2026")).toBe("2026-10-01"); // day first
    expect(parseDate("1-10-26")).toBe("2026-10-01");
    expect(parseDate("1 Oktober 2026")).toBe("2026-10-01");
    expect(parseDate("Kamis, 1 Okt 2026")).toBe("2026-10-01");
    expect(parseDate(new Date(Date.UTC(2026, 9, 1)))).toBe("2026-10-01");
    expect(parseDate(46296)).toBe("2026-10-01"); // Excel serial
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("besok")).toBeNull();
  });

  it("reads clock times as HH.MM", () => {
    expect(parseClock("8.00")).toBe("08.00");
    expect(parseClock("08:30")).toBe("08.30");
    expect(parseClock("0730")).toBe("07.30");
    expect(parseClock("7")).toBe("07.00");
    expect(parseClock(0.5)).toBe("12.00"); // Excel time fraction
    expect(parseClock(new Date(Date.UTC(1899, 11, 30, 9, 15)))).toBe("09.15");
    expect(parseClock("25.00")).toBeNull();
  });

  it("reads money the Indonesian way", () => {
    expect(parseNumber("Rp 1.500.000")).toBe(1500000);
    expect(parseNumber("15000")).toBe(15000);
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("1,500,000")).toBe(1500000);
    expect(parseNumber(42)).toBe(42);
    expect(parseNumber("dua")).toBeNull();
  });

  it("compares headers loosely", () => {
    expect(normHeader("Judul Tugas *")).toBe(normHeader("judul tugas"));
    expect(normHeader("Harga Satuan (Rp)")).toBe("hargasatuan");
  });
});

const grid = (rows: Grid["rows"], merges: Grid["merges"] = []): Grid => ({ rows, merges });

describe("parseGrid", () => {
  it("maps columns by header in any order, including aliases", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([
      ["Deadline", "Task", "Divisi *"],
      ["2026-10-07", "Susun rundown", "EVE"],
    ]));
    expect(res.errors).toEqual([]);
    expect(res.rows[0].values).toMatchObject({ title: "Susun rundown", division: "EVENT", end_date: "2026-10-07" });
  });

  it("reports a missing required column instead of guessing", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([["Judul Tugas"], ["X"]]));
    expect(res.missingColumns).toEqual(["Divisi"]);
    expect(res.rows).toEqual([]);
  });

  it("collects every cell error with its Excel row and header", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([
      ["Divisi", "Judul Tugas", "Status", "Deadline"],
      ["Tidak Ada", "A", "Beres", "kapan-kapan"],
      ["Event", "", "", ""],
    ]));
    expect(res.errors).toEqual([
      expect.objectContaining({ line: 2, column: "Divisi" }),
      expect.objectContaining({ line: 2, column: "Deadline" }),
      { line: 3, column: "Judul Tugas", message: "Wajib diisi." },
    ]);
    // "Beres" is an alias of Done, so it is not an error.
    expect(res.rows[0].values.status).toBe("done");
  });

  it("skips blank rows and reports extra headers as ignored", () => {
    const res = parseGrid(specFor("jobs"), CTX, grid([
      ["PIC", "Tugas", "Kolom Saya"],
      [null, null, null],
      ["Dewi", "Jaga lobi", "abaikan"],
    ]));
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].line).toBe(3);
    expect(res.ignoredHeaders).toEqual(["Kolom Saya"]);
  });

  it("FILLS a merged cell into every row it covers (non-span column)", () => {
    const res = parseGrid(specFor("jobs"), CTX, grid(
      [["PIC", "Tugas"], ["Dewi", "A"], [null, "B"], ["Raka", "C"]],
      [{ top: 1, left: 0, bottom: 2, right: 0 }],
    ));
    expect(res.rows.map((r) => r.values.pic)).toEqual(["Dewi", "Dewi", "Raka"]);
  });

  it("turns a merged rundown cell into a SPAN on the top row", () => {
    const res = parseGrid(specFor("rundown"), CTX, grid(
      [
        ["Waktu Mulai", "Kegiatan", "MC", "Creative Media"],
        ["08.00", "Pembukaan", "Dewi", "Foto"],
        ["08.15", "Sambutan", null, null],
        ["08.30", "FGD", "Raka", null],
      ],
      [
        { top: 1, left: 2, bottom: 2, right: 2 },
        { top: 1, left: 3, bottom: 3, right: 3 },
      ],
    ));
    expect(res.errors).toEqual([]);
    expect(res.rows[0].spans).toEqual({ mc: 2, "job:DIV-X1": 3 });
    expect(res.rows[1].values.mc).toBeNull();
    expect(res.rows[2].values.mc).toBe("Raka");
  });

  it("keeps a row that only a merge reaches, so a span never points too far", () => {
    const res = parseGrid(specFor("rundown"), CTX, grid(
      [["Kegiatan", "MC"], ["A", "Dewi"], [null, null]],
      [{ top: 1, left: 1, bottom: 2, right: 1 }],
    ));
    expect(res.rows).toHaveLength(2);
    expect(res.errors).toEqual([{ line: 3, column: "Kegiatan", message: "Wajib diisi." }]);
  });

  it("stops at the row limit and says so", () => {
    const spec = { ...specFor("fgd"), maxRows: 2 };
    const res = parseGrid(spec, CTX, grid([["Departemen HMSI"], ["A"], ["B"], ["C"]]));
    expect(res.rows).toHaveLength(2);
    expect(res.errors[0].message).toMatch(/Maksimal 2 baris/);
  });

  it("members: several divisions in one cell, matched by name or short code", () => {
    const res = parseGrid(specFor("members"), CTX, grid([
      ["Nama Lengkap", "Divisi"],
      ["Dewi", "Event, CRE"],
    ]));
    expect(res.rows[0].values.divisions).toEqual(["EVENT", "DIV-X1"]);
  });

  it("links: completes a URL typed without https://", () => {
    const res = parseGrid(specFor("links"), CTX, grid([["Nama Tautan", "URL"], ["Folder", "drive.google.com/abc"]]));
    expect(res.rows[0].values.url).toBe("https://drive.google.com/abc");
  });
});
