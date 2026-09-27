import "server-only";
import ExcelJS from "exceljs";
import { COMMON_RULES } from "./modules";
import { ARCHIVE_MESSAGE, inspectArchive } from "./zip-guard";
import { todayYmd } from "../format";
import {
  TEMPLATE_VERSION, isImportModule, optionLabels,
  type CellValue, type ColumnSpec, type Grid, type ImportContext, type ImportModule, type MergeRange,
  type ModuleSpec, type RowIssue,
} from "./core";

// ============================================================
// The file-format half of the XLSX import: spec -> template workbook,
// uploaded workbook -> Grid, and Grid + issues -> an annotated copy the person
// can fix in Excel. Server-only so exceljs (large, Node streams) never reaches
// the browser bundle; the dialog only ever sends the file up and receives
// plain JSON (or base64) back.
//
// NOTHING here touches storage. The uploaded bytes arrive in the Server
// Action's request, live in memory for the length of that request, and are
// garbage once it returns. No Supabase Storage, no table, no temp file.
//
// Every template has the same four sheets, whatever the menu:
//   Petunjuk   how to use it, a pre-upload checklist, how to merge cells,
//              the rules, and a table describing each column with an example
//   Data       the only sheet that is read: headers, dropdowns, input hints,
//              text-formatted columns, and required cells that turn red
//   Contoh     the same layout, filled in, including merged cells
//   Referensi  the valid values the dropdowns point at (read-only)
// ============================================================

export const DATA_SHEET = "Data";
export const EXAMPLE_SHEET = "Contoh";
const RULES_SHEET = "Petunjuk";
const REF_SHEET = "Referensi";
const REPORT_SHEET = "Hasil Pemeriksaan";

/** Rows given dropdowns, hints and formats in the empty Data sheet. */
const PREPARED_ROWS = 300;

const BRAND = "FF4F46E5";
const EXAMPLE_FILL = "FFFFF7E6";
const ERROR_FILL = "FFFECACA";
const WARN_FILL = "FFFEF3C7";
const MUTED = "FF52525B";
const BORDER = { style: "thin" as const, color: { argb: "FFD4D4D8" } };
const BOX = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

const KIND_LABEL: Record<ColumnSpec["kind"], string> = {
  text: "Teks",
  longtext: "Teks panjang",
  number: "Angka",
  date: "Tanggal",
  time: "Jam (08.00)",
  timerange: "Rentang jam (08.00 - 08.30)",
  enum: "Pilihan (dropdown)",
  bool: "Ya / Tidak",
  year: "Tahun",
  url: "Tautan https://",
  color: "Kode warna hex",
  division: "Divisi (dropdown)",
  divisions: "Satu divisi atau lebih",
};

/** Kinds whose cells must stay TEXT in Excel: otherwise "08.30" becomes 8.3,
 *  "0812..." loses its 0, and "1/2" turns into a date. */
const TEXT_KINDS = new Set<ColumnSpec["kind"]>([
  "text", "longtext", "time", "timerange", "enum", "url", "color", "division", "divisions",
]);

export function colLetter(n: number): string {
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

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ---------------- template metadata ----------------

/**
 * Which menu and edition a template was made for, written into the workbook's
 * document properties (File > Info > Subject). Excel keeps it through a save;
 * Google Sheets drops it, which is why every check that uses it is a hint on
 * top of the header matching, never a requirement.
 */
export interface TemplateMeta {
  version: number;
  module: ImportModule;
  eventId: string;
}

const META_PREFIX = "ov-import";

function writeMeta(meta: TemplateMeta): string {
  return `${META_PREFIX};v=${meta.version};module=${meta.module};event=${meta.eventId}`;
}

export function readMeta(subject: string | undefined): TemplateMeta | null {
  if (!subject?.startsWith(META_PREFIX)) return null;
  const kv = Object.fromEntries(
    subject.split(";").slice(1).map((p) => p.split("=") as [string, string]),
  );
  if (!isImportModule(kv.module)) return null;
  return { version: Number(kv.v) || 0, module: kv.module, eventId: kv.event ?? "" };
}

// ---------------- template ----------------

/** Lists on the Referensi sheet, each in its own column. Returns the absolute
 *  range a dropdown should point at, keyed by list name. */
function buildReference(wb: ExcelJS.Workbook, cols: ColumnSpec[], ctx: ImportContext) {
  const ws = wb.addWorksheet(REF_SHEET, { properties: { tabColor: { argb: MUTED } } });
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
  if (ctx.members.length && cols.some((c) => c.people)) {
    lists.push({ key: "members", title: "Nama anggota (untuk PIC)", values: ctx.members });
  }

  let col = 1;
  for (const list of lists) {
    const group = [{ title: list.title, values: list.values }, ...(list.extra ?? [])];
    for (const [i, g] of group.entries()) {
      const letter = colLetter(col);
      ws.getColumn(col).width = Math.max(14, Math.min(40, Math.max(...g.values.map((v) => v.length + 2), g.title.length + 4)));
      ws.getCell(`${letter}1`).value = g.title;
      g.values.forEach((v, r) => { ws.getCell(`${letter}${r + 2}`).value = v; });
      if (i === 0 && g.values.length) ranges.set(list.key, `'${REF_SHEET}'!$${letter}$2:$${letter}$${g.values.length + 1}`);
      col++;
    }
    col++; // a blank column between lists
  }
  if (!lists.length) ws.getCell("A1").value = "Menu ini tidak memakai daftar pilihan.";
  else styleHeader(ws.getRow(1), MUTED);
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return { ws, ranges };
}

/** Headers, widths, notes and formats shared by Data and Contoh. */
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
    if (TEXT_KINDS.has(c.kind) || c.key === "nrp" || c.key === "no") column.numFmt = "@";
    if (c.kind === "date") column.numFmt = "yyyy-mm-dd";
    if (c.kind === "number") column.numFmt = "#,##0";
    column.alignment = c.kind === "longtext" ? { wrapText: true, vertical: "top" } : { vertical: "top" };
  });
  styleHeader(ws.getRow(1), fill);
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/**
 * The Excel validation for one column. Every column gets one, even when there
 * is nothing to restrict, because the validation carries the INPUT MESSAGE:
 * the little yellow hint Excel shows when a cell is selected, which is the
 * only place a person filling row 87 still sees what the column wants.
 * Restrictions use errorStyle "warning", so a value outside the list can still
 * be kept (the importer knows the aliases) after a nudge.
 */
function validationFor(c: ColumnSpec, refs: Map<string, string>): ExcelJS.DataValidation {
  const base = {
    allowBlank: !c.required,
    showInputMessage: true,
    promptTitle: clip(`${c.header}${c.required ? " (wajib)" : ""}`, 32),
    prompt: clip(c.kind === "enum" ? `${c.help} Pilihan: ${optionLabels(c)}.` : c.help, 250),
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: clip(c.header, 32),
  };
  const list = (range: string): ExcelJS.DataValidation => ({
    ...base, type: "list", formulae: [range],
    error: "Nilai ini tidak ada di daftar pilihan. Lihat sheet Referensi.",
  });
  if (c.kind === "enum" && refs.has(c.key)) return list(refs.get(c.key)!);
  if (c.kind === "division" && refs.has("division")) return list(refs.get("division")!);
  if (c.kind === "bool" && refs.has("bool")) return list(refs.get("bool")!);
  if (c.kind === "number") {
    return { ...base, type: "decimal", operator: "greaterThanOrEqual", formulae: [0], error: "Isi dengan angka 0 atau lebih." };
  }
  if (c.kind === "year") {
    return { ...base, type: "whole", operator: "between", formulae: [2000, 2100], error: "Isi dengan tahun, mis. 2025." };
  }
  if (c.kind === "date") {
    return {
      ...base, type: "date", operator: "greaterThan", formulae: [new Date(Date.UTC(2000, 0, 1))],
      error: "Isi dengan tanggal, mis. 2026-10-01 atau 01/10/2026.",
    };
  }
  if (c.max) {
    return {
      ...base, type: "textLength", operator: "lessThanOrEqual", formulae: [c.max],
      error: `Maksimal ${c.max} karakter.`,
    };
  }
  return { ...base, type: "custom", formulae: ["TRUE"] };
}

/** Examples to show in the column table of the rules sheet. */
function exampleOf(spec: ModuleSpec, ctx: ImportContext, key: string): string {
  for (const ex of spec.examples(ctx)) {
    const v = ex[key];
    if (v !== undefined && v !== "") return String(v);
  }
  return "";
}

/** Build the template workbook for one menu, for one edition. */
export async function buildTemplate(
  spec: ModuleSpec,
  ctx: ImportContext,
  eventId = "",
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ormawa Visit Management System";
  wb.created = new Date();
  wb.title = `Template Import ${spec.title}`;
  wb.subject = writeMeta({ version: TEMPLATE_VERSION, module: spec.module, eventId });
  wb.description = `Template impor ${spec.title} untuk Ormawa Visit ${ctx.eventTitle}. Isi sheet Data.`;
  const cols = spec.columns(ctx).filter((c) => !c.uploadOnly);
  const hasSpan = cols.some((c) => c.merge === "span");

  // ---- Petunjuk -------------------------------------------------------
  const rules = wb.addWorksheet(RULES_SHEET, { properties: { tabColor: { argb: BRAND } } });
  rules.getColumn(1).width = 3;
  rules.getColumn(2).width = 24;
  rules.getColumn(3).width = 8;
  rules.getColumn(4).width = 20;
  rules.getColumn(5).width = 24;
  rules.getColumn(6).width = 62;
  let r = 1;
  const line = (text: string, font: Partial<ExcelJS.Font> = {}, fill?: string) => {
    rules.mergeCells(r, 2, r, 6);
    const cell = rules.getCell(r, 2);
    cell.value = text;
    cell.font = font;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    rules.getRow(r).height = Math.max(17, Math.ceil(text.length / 120) * 16);
    r++;
  };
  const heading = (text: string) => { r++; line(text, { bold: true, size: 12, color: { argb: BRAND } }); };

  line(`Template Import - ${spec.title}`, { bold: true, size: 16, color: { argb: BRAND } });
  line(`Ormawa Visit: ${ctx.eventTitle}   |   Dibuat: ${todayYmd()}   |   Versi template ${TEMPLATE_VERSION}`, { italic: true, color: { argb: MUTED } });
  line(
    "Template ini dibuat untuk Ormawa Visit di atas: daftar divisinya mengikuti edisi itu. Untuk edisi lain, unduh template baru dari aplikasi.",
    { color: { argb: MUTED } },
  );

  heading("Cara memakai");
  [
    "1. Buka sheet \"Data\" dan isi satu baris untuk satu data. Pilih sel mana saja untuk melihat petunjuk kolomnya.",
    "2. Lihat sheet \"Contoh\" bila ragu cara mengisi. Sheet itu tidak ikut diimpor.",
    `3. Di aplikasi, buka menu ${spec.title}, klik "Import XLSX", lalu unggah file ini.`,
    "4. Periksa pratinjau. Kalau ada kesalahan, unduh \"laporan pemeriksaan\": sel yang salah diberi warna dan catatan. Perbaiki, lalu unggah ulang.",
    "5. Tekan Impor. Data baru tersimpan setelah langkah ini.",
  ].forEach((s) => line(s));

  heading("Cek sebelum mengunggah");
  [
    "[ ] Baris 1 sheet Data masih berisi judul kolom dari template.",
    "[ ] Semua kolom bertanda * sudah terisi. Sel wajib yang masih kosong otomatis berwarna merah muda.",
    "[ ] Kolom pilihan diisi dari dropdown (daftar lengkapnya di sheet Referensi).",
    "[ ] Tidak ada baris contoh yang ikut tersalin ke sheet Data.",
    "[ ] File disimpan sebagai .xlsx (dari Google Sheets: File > Download > Microsoft Excel).",
  ].forEach((s) => line(s));

  heading("Cara menggabung (merge) sel");
  line("Excel: blok beberapa sel dalam satu kolom > tab Beranda (Home) > Gabung & Tengahkan (Merge & Center).");
  line("Google Sheets: blok beberapa sel dalam satu kolom > menu Format > Gabungkan sel > Gabungkan secara vertikal.");
  line(
    hasSpan
      ? `Di ${spec.title}, merge pada kolom ${cols.filter((c) => c.merge === "span").map((c) => c.header).join(", ")} menjadi SEL GABUNGAN di aplikasi. Merge di kolom lain berarti nilai yang sama untuk setiap baris yang digabung.`
      : "Sel yang di-merge ke bawah berarti nilai yang sama untuk setiap baris yang digabung, jadi tidak perlu diketik berulang.",
    { italic: true },
  );

  heading("Aturan umum");
  COMMON_RULES.forEach((s, i) => line(`${i + 1}. ${s}`));

  heading(`Aturan khusus ${spec.title}`);
  spec.rules.forEach((s, i) => line(`${i + 1}. ${s}`));
  if (spec.target) line(`${spec.rules.length + 1}. ${spec.target.label}: ${spec.target.help}`);
  if (spec.autoColumns?.length) {
    line(`Tidak perlu diisi (dibuat otomatis oleh aplikasi): ${spec.autoColumns.join(", ")}.`, { italic: true, color: { argb: MUTED } });
  }

  heading("Daftar kolom");
  const head = rules.getRow(r);
  ["Kolom", "Wajib", "Format", "Contoh isi", "Keterangan"].forEach((h, i) => { head.getCell(i + 2).value = h; });
  styleHeader(head);
  r++;
  for (const c of spec.columns(ctx)) {
    const row = rules.getRow(r++);
    const extra = c.kind === "enum" ? ` Pilihan: ${optionLabels(c)}.` : c.merge === "span" ? " Merge ke bawah = sel gabungan." : "";
    const where = c.uploadOnly ? " (Kolom alternatif: tidak ada di template, tapi dikenali bila ada di file.)" : "";
    row.values = [
      undefined, c.header, c.required ? "Ya" : "",
      c.formula ? "Rumus otomatis" : KIND_LABEL[c.kind],
      exampleOf(spec, ctx, c.key),
      `${c.help}${extra}${where}`,
    ];
    row.eachCell((cell) => { cell.border = BOX; cell.alignment = { wrapText: true, vertical: "top" }; });
    row.getCell(2).font = { bold: true };
    if (c.required) row.getCell(3).font = { bold: true, color: { argb: "FFB91C1C" } };
  }
  rules.views = [{ showGridLines: false }];

  // ---- Data -------------------------------------------------------------
  const data = wb.addWorksheet(DATA_SHEET, { properties: { tabColor: { argb: "FF16A34A" } } });
  layoutSheet(data, cols);
  data.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  // ---- Contoh -------------------------------------------------------------
  const ex = wb.addWorksheet(EXAMPLE_SHEET, { properties: { tabColor: { argb: "FFF59E0B" } } });
  layoutSheet(ex, cols, "FFD97706");
  const examples = spec.examples(ctx);
  const cellOf = (row: number) => (key: string) => `${colLetter(cols.findIndex((x) => x.key === key) + 1)}${row}`;
  examples.forEach((values, i) => {
    const rowNo = i + 2;
    cols.forEach((c, ci) => {
      const cell = ex.getCell(rowNo, ci + 1);
      if (c.formula) cell.value = { formula: c.formula(cellOf(rowNo)) };
      else {
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
  ex.getColumn(noteCol).width = 46;
  const note = ex.getCell(2, noteCol);
  note.value = "Sheet ini hanya contoh dan TIDAK ikut diimpor. Isi datamu di sheet \"Data\". Sel yang digabung (merge) menunjukkan cara menulis satu nilai untuk beberapa baris.";
  note.font = { italic: true, color: { argb: "FF92400E" } };
  note.alignment = { wrapText: true, vertical: "top" };

  // ---- Referensi, then the Data validations that point at it ----------
  const { ws: ref, ranges } = buildReference(wb, cols, ctx);
  const rowsReady = Math.min(PREPARED_ROWS, spec.maxRows);
  cols.forEach((c, i) => {
    const v = validationFor(c, ranges);
    const letter = colLetter(i + 1);
    for (let row = 2; row <= rowsReady + 1; row++) {
      const cell = data.getCell(`${letter}${row}`);
      if (!c.formula) cell.dataValidation = v;
      else {
        cell.value = { formula: c.formula(cellOf(row)) };
        cell.font = { color: { argb: "FF71717A" } };
      }
    }
  });

  // Required cells light up while empty on a row that has anything in it, so
  // a missing value is visible BEFORE the upload rather than after it.
  const last = colLetter(cols.length);
  cols.forEach((c, i) => {
    if (!c.required) return;
    const letter = colLetter(i + 1);
    data.addConditionalFormatting({
      ref: `${letter}2:${letter}${rowsReady + 1}`,
      rules: [{
        type: "expression",
        priority: 1,
        formulae: [`AND(SUMPRODUCT(--(LEN($A2:$${last}2)>0))>0,LEN(${letter}2)=0)`],
        style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: ERROR_FILL } } },
      }],
    });
  });

  // The reference lists are what the dropdowns point at: editing them by
  // accident silently changes what the dropdown offers. Protected without a
  // password, so anyone who really needs to can still unprotect it.
  await ref.protect("", { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true });

  // Open on the rules; Data is the next tab.
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------------- reading ----------------

function richText(v: unknown): string | null {
  const rt = (v as { richText?: { text: string }[] } | undefined)?.richText;
  return Array.isArray(rt) ? rt.map((t) => t.text).join("") : null;
}

function toCell(v: ExcelJS.CellValue): CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    const rt = richText(v);
    if (rt !== null) return rt;
    if ("formula" in v || "sharedFormula" in v) {
      const res = (v as { result?: unknown }).result;
      if (res === undefined || res === null) return null;
      if (typeof res === "object" && !(res instanceof Date)) {
        const err = (res as { error?: string }).error;
        return err ? { error: err } : null;
      }
      return res as CellValue;
    }
    if ("hyperlink" in v) {
      const text = typeof v.text === "string" ? v.text : richText(v.text) ?? "";
      // A cell showing a label but linking elsewhere: the link is the data.
      return /^https?:\/\//i.test(text.trim()) ? text : v.hyperlink;
    }
    if ("error" in v) return { error: String((v as { error: string }).error) };
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

export interface ReadResult {
  grid: Grid;
  /** The sheet that was read. */
  sheetName: string;
  /** Every visible sheet, in order. */
  sheetNames: string[];
  meta: TemplateMeta | null;
}

async function loadWorkbook(buf: ArrayBuffer): Promise<ExcelJS.Workbook> {
  // Inspect the archive BEFORE exceljs inflates it: see zip-guard.ts.
  const check = inspectArchive(new Uint8Array(buf));
  if (!check.ok) throw new WorkbookError(ARCHIVE_MESSAGE[check.problem]);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    throw new WorkbookError("File tidak bisa dibaca sebagai .xlsx. Simpan ulang sebagai Excel Workbook (.xlsx) lalu coba lagi.");
  }
  return wb;
}

function pickSheet(wb: ExcelJS.Workbook, sheet: string): ExcelJS.Worksheet | undefined {
  const sheets = wb.worksheets.filter((s) => s.state !== "hidden" && s.state !== "veryHidden");
  const skip = new Set([EXAMPLE_SHEET, RULES_SHEET, REF_SHEET, REPORT_SHEET].map((s) => s.toLowerCase()));
  return (
    sheets.find((s) => s.name.trim().toLowerCase() === sheet.toLowerCase()) ??
    sheets.find((s) => !skip.has(s.name.trim().toLowerCase()))
  );
}

/**
 * Read the sheet to import. Prefers a sheet named "Data"; a hand-made file with
 * one sheet of any name works too. The example, rules, reference and report
 * sheets are never read as data.
 */
export async function readWorkbook(
  buf: ArrayBuffer,
  maxRows: number,
  /** Read this sheet instead (tests read the "Contoh" sheet back). */
  sheet = DATA_SHEET,
): Promise<ReadResult> {
  const wb = await loadWorkbook(buf);
  const ws = pickSheet(wb, sheet);
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
  return {
    grid: { rows, merges },
    sheetName: ws.name,
    sheetNames: wb.worksheets.filter((s) => s.state === "visible" || !s.state).map((s) => s.name),
    meta: readMeta(wb.subject),
  };
}

// ---------------- the report ----------------

/**
 * A copy of the person's own file with every problem marked where it is:
 * error cells red and warning cells amber, each with a note saying what is
 * wrong, a "Hasil Pemeriksaan" column at the end of each row, and a sheet
 * listing everything with links that jump to the cell. It is built in memory
 * and returned, like the template; nothing is kept.
 */
export async function annotateWorkbook(
  buf: ArrayBuffer,
  sheetName: string,
  headerRow: number,
  issues: RowIssue[],
): Promise<Buffer> {
  const wb = await loadWorkbook(buf);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new WorkbookError("Sheet yang dibaca tidak ditemukan lagi di file ini.");

  const byCell = new Map<string, RowIssue[]>();
  const byLine = new Map<number, RowIssue[]>();
  for (const i of issues) {
    if (i.col !== undefined) {
      const k = `${i.line}:${i.col}`;
      byCell.set(k, [...(byCell.get(k) ?? []), i]);
    }
    byLine.set(i.line, [...(byLine.get(i.line) ?? []), i]);
  }

  for (const [k, list] of byCell) {
    const [line, col] = k.split(":").map(Number);
    const cell = ws.getCell(line, col + 1);
    const isError = list.some((i) => i.level === "error");
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isError ? ERROR_FILL : WARN_FILL } };
    cell.note = list.map((i) => `${i.level === "error" ? "KESALAHAN" : "Peringatan"}: ${i.message}`).join("\n");
  }

  // One summary column after the last used one, so the reason sits on the row.
  const header = ws.getRow(headerRow + 1);
  let lastCol = 0;
  header.eachCell({ includeEmpty: false }, (_c, n) => { lastCol = Math.max(lastCol, n); });
  const summaryCol = Math.max(lastCol, 1) + 1;
  const hc = header.getCell(summaryCol);
  hc.value = "Hasil Pemeriksaan";
  hc.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } };
  hc.alignment = { vertical: "middle", wrapText: true };
  ws.getColumn(summaryCol).width = 60;
  for (const [line, list] of byLine) {
    const cell = ws.getCell(line, summaryCol);
    cell.value = list.map((i) => `${i.column !== "-" ? `[${i.column}] ` : ""}${i.message}`).join("\n");
    cell.alignment = { wrapText: true, vertical: "top" };
    cell.font = { color: { argb: list.some((i) => i.level === "error") ? "FFB91C1C" : "FF92400E" } };
  }

  // The list, first thing on opening.
  const old = wb.getWorksheet(REPORT_SHEET);
  if (old) wb.removeWorksheet(old.id);
  const rep = wb.addWorksheet(REPORT_SHEET, { properties: { tabColor: { argb: "FFB91C1C" } } });
  const errors = issues.filter((i) => i.level === "error").length;
  rep.getColumn(1).width = 8;
  rep.getColumn(2).width = 22;
  rep.getColumn(3).width = 12;
  rep.getColumn(4).width = 80;
  rep.getColumn(5).width = 10;
  rep.getCell("A1").value = `Hasil pemeriksaan: ${errors} kesalahan, ${issues.length - errors} peringatan`;
  rep.getCell("A1").font = { bold: true, size: 14 };
  rep.getCell("A2").value = errors
    ? "Perbaiki semua KESALAHAN (sel merah) di sheet data, simpan, lalu unggah lagi. Peringatan (sel kuning) boleh dibiarkan."
    : "Tidak ada kesalahan. Peringatan (sel kuning) hanya untuk dicek; file ini sudah bisa diimpor.";
  rep.getCell("A2").font = { italic: true, color: { argb: MUTED } };
  const th = rep.getRow(4);
  th.values = ["Baris", "Kolom", "Jenis", "Pesan", "Buka"];
  styleHeader(th, "FF52525B");
  const sorted = [...issues].sort((a, b) => a.line - b.line || (a.col ?? -1) - (b.col ?? -1));
  sorted.forEach((i, n) => {
    const row = rep.getRow(5 + n);
    const target = `${colLetter((i.col ?? summaryCol - 1) + 1)}${i.line}`;
    row.values = [
      i.line, i.column, i.level === "error" ? "Kesalahan" : "Peringatan", i.message,
      { text: target, hyperlink: `#'${sheetName.replace(/'/g, "''")}'!${target}` },
    ];
    row.getCell(3).font = { bold: true, color: { argb: i.level === "error" ? "FFB91C1C" : "FF92400E" } };
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
    row.getCell(5).font = { color: { argb: "FF2563EB" }, underline: true };
  });
  rep.views = [{ state: "frozen", ySplit: 4 }];
  // Put the report first and open on it.
  // exceljs orders sheets by orderNo when writing; it is not in its typings.
  (rep as unknown as { orderNo: number }).orderNo = -1;
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
