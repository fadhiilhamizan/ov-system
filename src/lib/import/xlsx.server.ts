import "server-only";
import ExcelJS from "exceljs";
import { COMMON_RULES } from "./modules";
import {
  optionLabels, type CellValue, type ColumnSpec, type Grid, type ImportContext, type MergeRange,
  type ModuleSpec,
} from "./core";

// ============================================================
// The file-format half of the XLSX import: spec -> template workbook, and
// uploaded workbook -> Grid. Server-only so exceljs (large, Node streams) never
// reaches the browser bundle; the dialog only ever sends the file up and
// receives plain JSON back.
//
// Every template has the same four sheets, whatever the menu:
//   Petunjuk   the rules (common + this menu) and a table describing each column
//   Data       the only sheet that is read: headers, dropdowns, formats
//   Contoh     the same layout, filled in, including merged cells where the
//              menu gives merges a meaning
//   Referensi  the valid values the dropdowns point at (divisions, statuses, ...)
// ============================================================

export const DATA_SHEET = "Data";
export const EXAMPLE_SHEET = "Contoh";
const RULES_SHEET = "Petunjuk";
const REF_SHEET = "Referensi";

/** Rows given dropdowns and formats in the empty Data sheet. */
const PREPARED_ROWS = 300;

const BRAND = "FF4F46E5";
const EXAMPLE_FILL = "FFFFF7E6";
const BORDER = { style: "thin" as const, color: { argb: "FFD4D4D8" } };
const BOX = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

const KIND_LABEL: Record<ColumnSpec["kind"], string> = {
  text: "Teks",
  longtext: "Teks panjang",
  number: "Angka",
  date: "Tanggal",
  time: "Jam (08.00)",
  enum: "Pilihan",
  bool: "Ya / Tidak",
  year: "Tahun",
  url: "Tautan https://",
  color: "Kode warna hex",
  division: "Divisi",
  divisions: "Satu divisi atau lebih",
};

function colLetter(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function styleHeader(row: ExcelJS.Row, fill = BRAND) {
  row.height = 30;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BOX;
  });
}

/** Lists on the Referensi sheet, each in its own column. Returns the absolute
 *  range a dropdown should point at, keyed by list name. */
function buildReference(wb: ExcelJS.Workbook, cols: ColumnSpec[], ctx: ImportContext) {
  const ws = wb.addWorksheet(REF_SHEET);
  const ranges = new Map<string, string>();
  const lists: { key: string; title: string; values: string[]; extra?: { title: string; values: string[] }[] }[] = [];

  if (cols.some((c) => c.kind === "division" || c.kind === "divisions")) {
    lists.push({
      key: "division",
      title: "Divisi",
      values: ctx.divisions.map((d) => d.name),
      extra: [
        { title: "Singkatan", values: ctx.divisions.map((d) => d.short) },
        { title: "Kode", values: ctx.divisions.map((d) => d.key) },
      ],
    });
  }
  for (const c of cols) {
    if (c.kind === "enum") lists.push({ key: c.key, title: c.header, values: (c.options ?? []).map((o) => o.label) });
  }
  if (cols.some((c) => c.kind === "bool")) lists.push({ key: "bool", title: "Ya / Tidak", values: ["Ya", "Tidak"] });
  if (ctx.members.length) lists.push({ key: "members", title: "Nama anggota (untuk PIC)", values: ctx.members });

  let col = 1;
  for (const list of lists) {
    const group = [{ title: list.title, values: list.values }, ...(list.extra ?? [])];
    for (const [i, g] of group.entries()) {
      const letter = colLetter(col);
      ws.getColumn(col).width = Math.max(14, Math.min(40, ...g.values.map((v) => v.length + 2), g.title.length + 4));
      const head = ws.getCell(`${letter}1`);
      head.value = g.title;
      g.values.forEach((v, r) => { ws.getCell(`${letter}${r + 2}`).value = v; });
      if (i === 0 && g.values.length) ranges.set(list.key, `'${REF_SHEET}'!$${letter}$2:$${letter}$${g.values.length + 1}`);
      col++;
    }
    col++; // a blank column between lists
  }
  styleHeader(ws.getRow(1), "FF52525B");
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return ranges;
}

/** Headers, widths, notes, formats and dropdowns shared by Data and Contoh. */
function layoutSheet(ws: ExcelJS.Worksheet, cols: ColumnSpec[], fill = BRAND) {
  ws.columns = cols.map((c) => ({
    header: c.required ? `${c.header} *` : c.header,
    key: c.key,
    width: c.width ?? 18,
  }));
  cols.forEach((c, i) => {
    const cell = ws.getRow(1).getCell(i + 1);
    const opts = c.kind === "enum" ? ` Pilihan: ${optionLabels(c)}.` : "";
    cell.note = `${c.required ? "WAJIB. " : ""}${c.help}${opts}`;
    const column = ws.getColumn(i + 1);
    if (c.kind === "time" || c.key === "nrp" || c.key === "no") column.numFmt = "@";
    if (c.kind === "date") column.numFmt = "yyyy-mm-dd";
    if (c.kind === "number") column.numFmt = "#,##0";
    if (c.kind === "longtext") column.alignment = { wrapText: true, vertical: "top" };
    else column.alignment = { vertical: "top" };
  });
  styleHeader(ws.getRow(1), fill);
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function validationFor(c: ColumnSpec, refs: Map<string, string>): ExcelJS.DataValidation | null {
  const list = (formula: string, title: string): ExcelJS.DataValidation => ({
    type: "list",
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: title,
    error: "Nilai ini tidak ada di daftar pilihan. Lihat sheet Referensi.",
  });
  if (c.kind === "enum" && refs.has(c.key)) return list(refs.get(c.key)!, c.header);
  if (c.kind === "division" && refs.has("division")) return list(refs.get("division")!, c.header);
  if (c.kind === "bool" && refs.has("bool")) return list(refs.get("bool")!, c.header);
  if (c.kind === "divisions") {
    return {
      type: "custom", allowBlank: true, formulae: ["TRUE"], showInputMessage: true,
      promptTitle: c.header, prompt: "Nama divisi, pisahkan dengan koma bila lebih dari satu. Daftar ada di sheet Referensi.",
    };
  }
  return null;
}

/** Build the template workbook for one menu. */
export async function buildTemplate(spec: ModuleSpec, ctx: ImportContext): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ormawa Visit Management System";
  wb.created = new Date();
  const cols = spec.columns(ctx);

  // ---- Petunjuk -------------------------------------------------------
  const rules = wb.addWorksheet(RULES_SHEET, { properties: { tabColor: { argb: BRAND } } });
  rules.getColumn(1).width = 4;
  rules.getColumn(2).width = 26;
  rules.getColumn(3).width = 10;
  rules.getColumn(4).width = 20;
  rules.getColumn(5).width = 70;
  let r = 1;
  const line = (text: string, opts: Partial<ExcelJS.Font> = {}) => {
    rules.mergeCells(r, 2, r, 5);
    const cell = rules.getCell(r, 2);
    cell.value = text;
    cell.font = opts;
    cell.alignment = { wrapText: true, vertical: "top" };
    rules.getRow(r).height = Math.max(16, Math.ceil(text.length / 110) * 16);
    r++;
  };
  line(`Template Import - ${spec.title}`, { bold: true, size: 16, color: { argb: BRAND } });
  line(`Ormawa Visit: ${ctx.eventTitle}`, { italic: true, color: { argb: "FF52525B" } });
  r++;
  line("Cara memakai", { bold: true, size: 12 });
  [
    "1. Isi sheet \"Data\" (satu baris = satu data). Lihat sheet \"Contoh\" untuk contoh pengisian.",
    `2. Di aplikasi, buka menu ${spec.title}, klik "Import XLSX", lalu unggah file ini.`,
    "3. Periksa pratinjau. Jika ada kesalahan, perbaiki di file lalu unggah ulang. Data baru tersimpan setelah kamu menekan tombol Impor.",
  ].forEach((s) => line(s));
  r++;
  line("Aturan umum", { bold: true, size: 12 });
  COMMON_RULES.forEach((s, i) => line(`${i + 1}. ${s}`));
  r++;
  line(`Aturan khusus ${spec.title}`, { bold: true, size: 12 });
  spec.rules.forEach((s, i) => line(`${i + 1}. ${s}`));
  if (spec.target) line(`${spec.rules.length + 1}. ${spec.target.label}: ${spec.target.help}`);
  r++;
  line("Daftar kolom", { bold: true, size: 12 });
  const head = rules.getRow(r);
  ["Kolom", "Wajib", "Format", "Keterangan"].forEach((h, i) => { head.getCell(i + 2).value = h; });
  styleHeader(head);
  r++;
  for (const c of cols) {
    const row = rules.getRow(r++);
    const extra = c.kind === "enum" ? ` Pilihan: ${optionLabels(c)}.` : c.merge === "span" ? " Merge ke bawah = sel gabungan." : "";
    row.values = [undefined, c.header, c.required ? "Ya" : "", c.formula ? "Rumus otomatis" : KIND_LABEL[c.kind], `${c.help}${extra}`];
    row.eachCell((cell) => { cell.border = BOX; cell.alignment = { wrapText: true, vertical: "top" }; });
    row.getCell(2).font = { bold: true };
  }

  // ---- Data -------------------------------------------------------------
  const data = wb.addWorksheet(DATA_SHEET, { properties: { tabColor: { argb: "FF16A34A" } } });
  layoutSheet(data, cols);

  // ---- Contoh -------------------------------------------------------------
  const ex = wb.addWorksheet(EXAMPLE_SHEET, { properties: { tabColor: { argb: "FFF59E0B" } } });
  layoutSheet(ex, cols, "FFD97706");
  const examples = spec.examples(ctx);
  examples.forEach((values, i) => {
    const rowNo = i + 2;
    cols.forEach((c, ci) => {
      const cell = ex.getCell(rowNo, ci + 1);
      if (c.formula) {
        cell.value = { formula: c.formula((key) => `${colLetter(cols.findIndex((x) => x.key === key) + 1)}${rowNo}`) };
      } else {
        const v = values[c.key];
        cell.value = v === undefined || v === "" ? null : v;
      }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXAMPLE_FILL } };
      cell.border = BOX;
    });
  });
  for (const m of spec.exampleMerges?.(ctx) ?? []) {
    const ci = cols.findIndex((c) => c.key === m.key);
    if (ci < 0 || m.span < 2 || m.row + m.span > examples.length) continue;
    // A merge keeps only the top-left value, which is what the importer reads.
    for (let k = 1; k < m.span; k++) ex.getCell(m.row + 2 + k, ci + 1).value = null;
    ex.mergeCells(m.row + 2, ci + 1, m.row + 1 + m.span, ci + 1);
    ex.getCell(m.row + 2, ci + 1).alignment = { vertical: "middle", wrapText: true };
  }
  // The explanation sits to the RIGHT of the table, in a column with no
  // header: below the table it would read as one more example row.
  const noteCol = cols.length + 2;
  ex.getColumn(noteCol).width = 44;
  const note = ex.getCell(2, noteCol);
  note.value = "Sheet ini hanya contoh dan TIDAK ikut diimpor. Isi datamu di sheet \"Data\". Sel yang digabung (merge) menunjukkan cara menulis nilai yang sama untuk beberapa baris.";
  note.font = { italic: true, color: { argb: "FF92400E" } };
  note.alignment = { wrapText: true, vertical: "top" };

  // ---- Referensi, then the Data dropdowns that point at it -------------
  const refs = buildReference(wb, cols, ctx);
  const rowsReady = Math.min(PREPARED_ROWS, spec.maxRows);
  cols.forEach((c, i) => {
    const v = validationFor(c, refs);
    const letter = colLetter(i + 1);
    for (let row = 2; row <= rowsReady + 1; row++) {
      const cell = data.getCell(`${letter}${row}`);
      if (v) cell.dataValidation = v;
      if (c.formula) {
        cell.value = { formula: c.formula((key) => `${colLetter(cols.findIndex((x) => x.key === key) + 1)}${row}`) };
        cell.font = { color: { argb: "FF71717A" } };
      }
    }
  });

  // Open on the rules; Data is the next tab.
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------------- reading ----------------

function toCell(v: ExcelJS.CellValue): CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("formula" in v || "sharedFormula" in v) {
      const res = (v as { result?: unknown }).result;
      if (res === undefined || res === null || (typeof res === "object" && !(res instanceof Date))) return null;
      return res as CellValue;
    }
    if ("hyperlink" in v) {
      const text = typeof v.text === "string"
        ? v.text
        : (v.text as { richText?: { text: string }[] } | undefined)?.richText?.map((t) => t.text).join("") ?? "";
      // A cell showing a label but linking elsewhere: the link is the data.
      return /^https?:\/\//i.test(text.trim()) ? text : v.hyperlink;
    }
    if ("error" in v) return null;
  }
  return String(v);
}

function decodeAddress(a: string): { row: number; col: number } {
  const m = a.replace(/\$/g, "").match(/^([A-Z]+)(\d+)$/i);
  if (!m) return { row: 0, col: 0 };
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: +m[2] - 1, col: col - 1 };
}

export class WorkbookError extends Error {}

/**
 * Read the sheet to import. Prefers a sheet named "Data"; a hand-made file with
 * one sheet of any name works too. The example and rules sheets are never read.
 */
export async function readWorkbook(
  buf: ArrayBuffer,
  maxRows: number,
  /** Read this sheet instead (tests read the "Contoh" sheet back). */
  sheet = DATA_SHEET,
): Promise<Grid> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    throw new WorkbookError("File tidak bisa dibaca sebagai .xlsx. Simpan ulang sebagai Excel Workbook (.xlsx) lalu coba lagi.");
  }
  const sheets = wb.worksheets.filter((s) => s.state !== "hidden" && s.state !== "veryHidden");
  const skip = new Set([EXAMPLE_SHEET, RULES_SHEET, REF_SHEET].map((s) => s.toLowerCase()));
  const ws =
    sheets.find((s) => s.name.trim().toLowerCase() === sheet.toLowerCase()) ??
    sheets.find((s) => !skip.has(s.name.trim().toLowerCase()));
  if (!ws) throw new WorkbookError("Sheet \"Data\" tidak ditemukan di file ini.");

  // Header search (10 rows) plus the row limit plus slack for blank rows.
  const lastRow = Math.min(ws.rowCount, maxRows + 200);
  const width = Math.min(ws.columnCount, 60);
  const rows: CellValue[][] = [];
  for (let r = 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const out: CellValue[] = [];
    for (let c = 1; c <= width; c++) out.push(toCell(row.getCell(c).value));
    rows.push(out);
  }
  const merges: MergeRange[] = [];
  for (const range of ws.model.merges ?? []) {
    const [a, b] = String(range).split(":");
    if (!a || !b) continue;
    const s = decodeAddress(a), e = decodeAddress(b);
    if (s.row >= lastRow) continue;
    merges.push({ top: s.row, left: s.col, bottom: Math.min(e.row, lastRow - 1), right: e.col });
  }
  return { rows, merges };
}
