import { describe, it, expect } from "vitest";
import {
  distance, existingLines, headerScore, normHeader, parseClock, parseClockRange, parseDate, parseGrid,
  parseNumber, splitPeople, suggest, type Grid, type ImportContext,
} from "./core";
import { specFor } from "./modules";

const CTX: ImportContext = {
  eventTitle: "OV",
  divisions: [
    { key: "EVENT", name: "Event", short: "EVE" },
    { key: "DIV-X1", name: "Creative Media", short: "CRE" },
  ],
  members: ["Dewi Anggraini", "Raka"],
};

const grid = (rows: Grid["rows"], merges: Grid["merges"] = []): Grid => ({ rows, merges });

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

  it("reads clock times as HH.MM, including what Sheets turns them into", () => {
    expect(parseClock("8.00")).toBe("08.00");
    expect(parseClock("08:30")).toBe("08.30");
    expect(parseClock("0730")).toBe("07.30");
    expect(parseClock("7")).toBe("07.00");
    expect(parseClock("13.00 WIB")).toBe("13.00");
    expect(parseClock(0.5)).toBe("12.00"); // Excel time fraction
    expect(parseClock(8.3)).toBe("08.30"); // "08.30" auto-converted to a number
    expect(parseClock(13)).toBe("13.00");
    expect(parseClock(new Date(Date.UTC(1899, 11, 30, 9, 15)))).toBe("09.15");
    expect(parseClock("25.00")).toBeNull();
  });

  it("reads a start-end range from one cell", () => {
    expect(parseClockRange("08.00 - 08.30")).toEqual({ start: "08.00", end: "08.30" });
    expect(parseClockRange("8:00–9:15")).toEqual({ start: "08.00", end: "09.15" });
    expect(parseClockRange("08.00 s/d 10.00")).toEqual({ start: "08.00", end: "10.00" });
    expect(parseClockRange("pagi")).toBeNull();
  });

  it("reads money the Indonesian way", () => {
    expect(parseNumber("Rp 1.500.000")).toBe(1500000);
    expect(parseNumber("Rp 150.000,-")).toBe(150000);
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

  it("suggests what someone probably meant", () => {
    expect(suggest("Evnt", ["Event", "Creative Media"])).toBe("Event");
    expect(suggest("Crea", ["Event", "Creative Media"])).toBe("Creative Media");
    expect(suggest("Keuangan", ["Event", "Creative Media"])).toBeNull();
    expect(distance("kitten", "sitting")).toBe(3);
  });

  it("splits PIC cells on commas, '&' and 'dan'", () => {
    expect(splitPeople("Dewi, Raka & Salsa dan Bima")).toEqual(["Dewi", "Raka", "Salsa", "Bima"]);
  });
});

describe("parseGrid", () => {
  it("maps columns by header in any order, including aliases", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([
      ["Deadline", "Task", "Divisi *"],
      ["2026-10-07", "Susun rundown", "EVE"],
    ]));
    expect(res.errors).toEqual([]);
    expect(res.rows[0].values).toMatchObject({ title: "Susun rundown", division: "EVENT", end_date: "2026-10-07" });
    expect(res.columnAt).toMatchObject({ end_date: 0, title: 1, division: 2 });
  });

  it("finds the header below a title row someone added", () => {
    const res = parseGrid(specFor("jobs"), CTX, grid([
      ["JOBDESC HARI-H OV 2026"],
      [null],
      ["PIC", "Tugas"],
      ["Raka", "Operator"],
    ]));
    expect(res.headerRow).toBe(2);
    expect(res.rows[0]).toMatchObject({ line: 4, values: { job: "Operator" } });
  });

  it("reports a missing required column instead of guessing", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([["Judul Tugas"], ["X"]]));
    expect(res.missingColumns).toEqual(["Divisi"]);
    expect(res.rows).toEqual([]);
  });

  it("collects every cell error with its Excel row, header and sheet column", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([
      ["Divisi", "Judul Tugas", "Status", "Deadline"],
      ["Evnt", "A", "Beres", "kapan-kapan"],
      ["Event", "", "", ""],
    ]));
    expect(res.errors).toEqual([
      expect.objectContaining({ line: 2, column: "Divisi", col: 0, level: "error", message: expect.stringContaining('Maksudmu "Event"?') }),
      expect.objectContaining({ line: 2, column: "Deadline", col: 3 }),
      expect.objectContaining({ line: 3, column: "Judul Tugas", col: 1, message: "Wajib diisi." }),
    ]);
    // "Beres" is an alias of Done, so it is not an error.
    expect(res.rows[0].values.status).toBe("done");
  });

  it("suggests the enum value that was probably meant", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([["Divisi", "Judul Tugas", "Status"], ["Event", "A", "Doen"]]));
    expect(res.errors[0].message).toMatch(/Maksudmu "Done"\?/);
  });

  it("an Excel error in a cell is an error, not a silent blank", () => {
    const res = parseGrid(specFor("jobs"), CTX, grid([["PIC", "Tugas"], ["Raka", { error: "#REF!" }]]));
    expect(res.errors[0].message).toMatch(/#REF!/);
  });

  it("folds invisible spaces pasted from chat apps", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([["Divisi", "Judul Tugas"], ["Event ​", "A"]]));
    expect(res.errors).toEqual([]);
    expect(res.rows[0].values.division).toBe("EVENT");
  });

  it("skips blank rows, quietly skips auto columns, and suggests for unknown headers", () => {
    const res = parseGrid(specFor("jobs"), CTX, grid([
      ["No", "PIC", "Tugass", "Kolom Saya"],
      [null, null, null, null],
      [1, "Raka", "Jaga lobi", "abaikan"],
    ]));
    expect(res.missingColumns).toEqual(["Tugas"]);
    const ok = parseGrid(specFor("jobs"), CTX, grid([
      ["No", "PIC", "Tugas", "Catatn", "Kolom Saya"],
      [null, null, null, null, null],
      [1, "Raka", "Jaga lobi", "x", "abaikan"],
    ]));
    expect(ok.rows).toHaveLength(1);
    expect(ok.rows[0].line).toBe(3);
    expect(ok.ignoredHeaders).toEqual(['Catatn (maksudmu "Catatan"?)', "Kolom Saya"]);
    expect(ok.notes.join(" ")).toMatch(/Kolom No diabaikan/);
  });

  it("reads only the first of two columns with the same header", () => {
    const res = parseGrid(specFor("jobs"), CTX, grid([["Tugas", "PIC", "PIC"], ["A", "Raka", "Dewi"]]));
    expect(res.rows[0].values.pic).toBe("Raka");
    expect(res.notes.join(" ")).toMatch(/PIC muncul lebih dari sekali/);
  });

  it("FILLS a merged cell into every row it covers (non-span column)", () => {
    const res = parseGrid(specFor("jobs"), CTX, grid(
      [["PIC", "Tugas"], ["Raka", "A"], [null, "B"], ["Dewi Anggraini", "C"]],
      [{ top: 1, left: 0, bottom: 2, right: 0 }],
    ));
    expect(res.rows.map((r) => r.values.pic)).toEqual(["Raka", "Raka", "Dewi Anggraini"]);
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

  it("rundown: an old single 'Waktu' column is understood", () => {
    const res = parseGrid(specFor("rundown"), CTX, grid([["No", "Waktu", "Durasi", "Kegiatan"], [1, "07.30 - 08.00", "30'", "Registrasi"]]));
    expect(res.errors).toEqual([]);
    expect(res.rows[0].values.time_range).toBe("07.30-08.00");
    expect(res.notes.join(" ")).toMatch(/No, Durasi diabaikan/);
  });

  it("keeps a row that only a merge reaches, so a span never points too far", () => {
    const res = parseGrid(specFor("rundown"), CTX, grid(
      [["Kegiatan", "MC"], ["A", "Dewi"], [null, null]],
      [{ top: 1, left: 1, bottom: 2, right: 1 }],
    ));
    expect(res.rows).toHaveLength(2);
    expect(res.errors).toEqual([expect.objectContaining({ line: 3, column: "Kegiatan", message: "Wajib diisi." })]);
  });

  it("stops at the row limit and says so", () => {
    const spec = { ...specFor("fgd"), maxRows: 2 };
    const res = parseGrid(spec, CTX, grid([["Departemen HMSI"], ["A"], ["B"], ["C"]]));
    expect(res.rows).toHaveLength(2);
    expect(res.errors[0].message).toMatch(/Maksimal 2 baris/);
  });

  it("members: several divisions in one cell, matched by name or short code", () => {
    const res = parseGrid(specFor("members"), CTX, grid([["Nama Lengkap", "Divisi"], ["Dewi", "Event, CRE"]]));
    expect(res.rows[0].values.divisions).toEqual(["EVENT", "DIV-X1"]);
  });

  it("links: completes a URL typed without https://", () => {
    const res = parseGrid(specFor("links"), CTX, grid([["Nama Tautan", "URL"], ["Folder", "drive.google.com/abc"]]));
    expect(res.rows[0].values.url).toBe("https://drive.google.com/abc");
  });

  it("prospects: puts back the 0 Excel stripped from a phone number", () => {
    const res = parseGrid(specFor("prospects"), CTX, grid([["Nama Ormawa", "Kontak"], ["HMTI", 81234567890]]));
    expect(res.rows[0].values.contact).toBe("081234567890");
    expect(res.notes.join(" ")).toMatch(/angka 0/);
  });

  it("a date cell in a text column is written like the app writes dates", () => {
    const res = parseGrid(specFor("prospects"), CTX, grid([["Nama Ormawa", "Tanggal"], ["HMTI", new Date(Date.UTC(2026, 8, 12))]]));
    expect(res.rows[0].values.date_text).toBe("12 Sep 2026");
  });

  it("notes that 03/04/2026 was read day-first", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([["Divisi", "Judul Tugas", "Deadline"], ["Event", "A", "03/04/2026"]]));
    expect(res.rows[0].values.end_date).toBe("2026-04-03");
    expect(res.notes.join(" ")).toMatch(/hari\/bulan\/tahun/);
  });

  it("warns (never errors) about a PIC who is not on the roster", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([["Divisi", "Judul Tugas", "PIC"], ["Event", "A", "Rakha, Dewi Anggraini"]]));
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([
      expect.objectContaining({ line: 2, column: "PIC", level: "warning", message: expect.stringContaining('Maksudmu "Raka"?') }),
    ]);
  });

  it("warns about a row repeated inside the file", () => {
    const res = parseGrid(specFor("tasks"), CTX, grid([
      ["Divisi", "Judul Tugas"], ["Event", "Booking ruangan"], ["EVE", "booking  ruangan"],
    ]));
    expect(res.warnings).toEqual([expect.objectContaining({ line: 3, message: "Sama dengan baris 2 di file ini." })]);
  });

  it("warns about an example row copied from the template", () => {
    const ex = specFor("fgd").examples(CTX)[0];
    const res = parseGrid(specFor("fgd"), CTX, grid([["Departemen HMSI", "Departemen Partner"], [ex.ours, ex.theirs]]));
    expect(res.warnings[0].message).toMatch(/contoh di template/);
  });
});

describe("module detection and existing rows", () => {
  it("scores which menu a sheet's headers belong to", () => {
    const g = grid([["Divisi", "Judul Tugas", "Deadline", "Status"]]);
    expect(headerScore(specFor("tasks"), CTX, g)).toBe(4);
    expect(headerScore(specFor("rundown"), CTX, g)).toBe(0);
  });

  it("matches file rows against identities already stored", () => {
    const spec = specFor("links");
    const res = parseGrid(spec, CTX, grid([
      ["Nama Tautan", "URL"],
      ["A", "https://www.Drive.google.com/x/"],
      ["B", "https://docs.google.com/y"],
    ]));
    const stored = new Set([spec.identity!({ url: "https://drive.google.com/x" })!]);
    expect([...existingLines(spec, res.rows, stored)]).toEqual([2]);
  });
});
