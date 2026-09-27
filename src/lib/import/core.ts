// ============================================================
// XLSX import: the pure half.
//
// Every table menu can be filled from a spreadsheet. The flow is the same for
// all of them: download the menu's template, fill the "Data" sheet in Excel or
// Google Sheets, upload it, look at the preview, confirm. What differs per menu
// is only a ModuleSpec (modules.ts): which columns exist, what each accepts, a
// worked example and the rules printed in the file.
//
// This file has no exceljs and no React in it, so the whole parse - header
// matching, merged cells, dates typed three different ways, "Rp 1.500.000" -
// is unit tested without a workbook. `xlsx.server.ts` turns a workbook into a
// Grid and a spec into a template; nothing else touches the file format.
//
// Merged cells have two meanings, chosen per column:
//   - "span" (rundown MC / operator / division columns): the merge IS the data.
//     It becomes the row's `merges` entry, exactly what the table's own
//     "Gabung dengan baris di bawah" button stores.
//   - everything else: a merge is how people avoid typing the same value
//     twice, so its value is FILLED into every row it covers.
// ============================================================

export const IMPORT_MODULES = [
  "tasks", "prospects", "links", "budget", "rundown", "jobs", "members", "fgd", "compare",
] as const;
export type ImportModule = (typeof IMPORT_MODULES)[number];

export const isImportModule = (v: unknown): v is ImportModule =>
  typeof v === "string" && (IMPORT_MODULES as readonly string[]).includes(v);

/** A cell as read from the workbook, before any column rules apply. */
export type CellValue = string | number | boolean | Date | null;

/** A merged range, 0-based and inclusive, in sheet coordinates. */
export interface MergeRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** One worksheet as plain data. `rows[r][c]`, 0-based; merged slaves are null. */
export interface Grid {
  rows: CellValue[][];
  merges: MergeRange[];
}

/** What a template and a parse may depend on: the active edition's lists. */
export interface ImportContext {
  eventTitle: string;
  divisions: { key: string; name: string; short: string; exclude_from_rundown?: boolean }[];
  /** Member display names, for the PIC dropdowns. */
  members: string[];
}

export type ColumnKind =
  | "text" | "longtext" | "number" | "date" | "time" | "enum" | "bool" | "year"
  | "url" | "color" | "division" | "divisions";

export interface EnumOption {
  value: string;
  label: string;
  aliases?: string[];
}

export interface ColumnSpec {
  /** Field name in the parsed row. Division columns of the rundown use
   *  `job:<divisionKey>`. */
  key: string;
  /** Header written in the template (Indonesian). */
  header: string;
  /** Other headers accepted on upload (English, older wording). */
  aliases?: string[];
  required?: boolean;
  kind: ColumnKind;
  options?: EnumOption[];
  max?: number;
  /** Column width in the template, in characters. */
  width?: number;
  /** One line explaining the column; the header note and the rules sheet. */
  help: string;
  /** Merged cells in this column become a rowspan instead of being filled. */
  merge?: "span";
  /** A convenience formula written into the template (e.g. a budget total).
   *  Receives the cell address of another column on the same row. Such a
   *  column is display-only: its value is never imported. */
  formula?: (cellOf: (key: string) => string) => string;
}

export interface ModuleSpec {
  module: ImportModule;
  /** Menu name, as in the sidebar. */
  title: string;
  /** Download file name, without extension. */
  fileName: string;
  columns: (ctx: ImportContext) => ColumnSpec[];
  /** Worked example rows for the "Contoh" sheet, keyed by column key. */
  examples: (ctx: ImportContext) => Record<string, string | number>[];
  /** Merges to draw on the example sheet (row indexes into `examples`). */
  exampleMerges?: (ctx: ImportContext) => { key: string; row: number; span: number }[];
  /** Menu-specific rules, printed on the "Petunjuk" sheet and in the dialog. */
  rules: string[];
  /** The import needs a target inside the menu (a budget plan, an FGD table). */
  target?: { label: string; help: string };
  maxRows: number;
}

export interface ParsedRow {
  /** Spreadsheet row number as Excel shows it (1-based), for error messages. */
  line: number;
  values: Record<string, string | number | boolean | string[] | null>;
  /** Rowspans for "span" columns, keyed by column key. */
  spans: Record<string, number>;
}

export interface RowIssue {
  line: number;
  column: string;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowIssue[];
  /** Headers in the file that match no column (ignored, reported). */
  ignoredHeaders: string[];
  /** Required columns whose header is missing entirely. */
  missingColumns: string[];
}

/** Rows scanned for the header before giving up. */
const HEADER_SCAN = 10;

// ---------------- helpers ----------------

/** Header comparison: case, spacing, the required-marker and punctuation don't matter. */
export function normHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function cellText(v: CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return ymdUTC(v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v).replace(/\r\n/g, "\n").trim();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Spreadsheet dates are wall-clock values stored as UTC; read them as such. */
function ymdUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2, peb: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agus: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, nopember: 11, november: 11,
  des: 12, dec: 12, desember: 12, december: 12,
};

function validYmd(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > days) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Excel's day 0 is 1899-12-30 (the 1900 leap-year bug included). */
function fromSerial(n: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000));
}

/** A date typed or formatted any of the usual ways, as YYYY-MM-DD. */
export function parseDate(v: CellValue): string | null {
  if (v instanceof Date) return ymdUTC(v);
  if (typeof v === "number") return v > 0 && v < 200000 ? ymdUTC(fromSerial(v)) : null;
  const s = cellText(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  // Day first: this is an Indonesian committee (01/10/2026 = 1 Oktober).
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return validYmd(y, +m[2], +m[1]);
  }
  m = s.match(/^(?:[a-z]+,?\s+)?(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/i);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    return month ? validYmd(+m[3], month, +m[1]) : null;
  }
  return null;
}

/** A clock time typed or formatted any of the usual ways, as "HH.MM". */
export function parseClock(v: CellValue): string | null {
  let minutes: number | null = null;
  if (v instanceof Date) minutes = v.getUTCHours() * 60 + v.getUTCMinutes();
  else if (typeof v === "number" && v >= 0 && v < 1) minutes = Math.round(v * 1440) % 1440;
  else {
    const s = cellText(v).replace(/\s+/g, "");
    const m = s.match(/^(\d{1,2})(?:[.:h]?(\d{2}))?$/);
    if (m) {
      const h = +m[1], min = m[2] ? +m[2] : 0;
      if (h <= 23 && min <= 59) minutes = h * 60 + min;
    }
  }
  if (minutes === null) return null;
  return `${pad(Math.floor(minutes / 60))}.${pad(minutes % 60)}`;
}

/**
 * A number typed the way people type money: 1500000, 1.500.000, Rp 1.500.000,
 * 1,5 (a decimal comma), 1.5 (a decimal point).
 */
export function parseNumber(v: CellValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = cellText(v).replace(/rp\.?|idr|\s/gi, "");
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return /^-?\d+(\.\d+)?$/.test(s) && Number.isFinite(n) ? n : null;
}

const TRUE_WORDS = ["ya", "y", "yes", "true", "benar", "1", "v", "x", "✓", "sudah", "selesai"];
const FALSE_WORDS = ["tidak", "t", "no", "n", "false", "salah", "0", "belum", "-"];

function parseBool(v: CellValue): boolean | null {
  if (typeof v === "boolean") return v;
  const s = cellText(v).toLowerCase();
  if (!s) return false;
  if (TRUE_WORDS.includes(s)) return true;
  if (FALSE_WORDS.includes(s)) return false;
  return null;
}

function matchOption(options: EnumOption[], raw: string): string | null {
  const n = normHeader(raw);
  for (const o of options) {
    if ([o.value, o.label, ...(o.aliases ?? [])].some((x) => normHeader(x) === n)) return o.value;
  }
  return null;
}

/** Division by key, name or short code. */
export function matchDivision(ctx: ImportContext, raw: string): string | null {
  const n = normHeader(raw);
  if (!n) return null;
  const d = ctx.divisions.find(
    (x) => normHeader(x.key) === n || normHeader(x.name) === n || normHeader(x.short) === n,
  );
  return d?.key ?? null;
}

/** "a, b; c" or one per line. */
export function splitList(s: string): string[] {
  return s.split(/[,;\n/]+/).map((x) => x.trim()).filter(Boolean);
}

function looksLikeUrl(s: string): string | null {
  const t = s.trim();
  if (/^https?:\/\/\S+$/i.test(t)) return t;
  // "drive.google.com/…" typed without the scheme.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t)) return `https://${t}`;
  return null;
}

/** Human list of what an enum accepts, for error messages and the rules sheet. */
export function optionLabels(c: ColumnSpec): string {
  return (c.options ?? []).map((o) => o.label).join(" / ");
}

type Normalised = { ok: true; value: string | number | boolean | string[] | null } | { ok: false; message: string };

/** Apply one column's rules to one cell. Blank cells are `null` (checked for
 *  `required` by the caller). */
export function normaliseCell(col: ColumnSpec, raw: CellValue, ctx: ImportContext): Normalised {
  const text = cellText(raw);
  const blank = text === "";
  if (blank && col.kind !== "bool") return { ok: true, value: null };
  const tooLong = (s: string) => col.max && s.length > col.max
    ? { ok: false as const, message: `Maksimal ${col.max} karakter (terisi ${s.length}).` }
    : null;

  switch (col.kind) {
    case "text":
    case "longtext": {
      const s = col.kind === "text" ? text.replace(/\s*\n\s*/g, " ") : text;
      return tooLong(s) ?? { ok: true, value: s };
    }
    case "number": {
      const n = parseNumber(raw);
      if (n === null || n < 0) return { ok: false, message: `"${text}" bukan angka 0 atau lebih.` };
      return { ok: true, value: n };
    }
    case "year": {
      const n = parseNumber(raw);
      if (n === null || !Number.isInteger(n) || n < 2000 || n > 2100) {
        return { ok: false, message: `"${text}" bukan tahun (mis. 2025).` };
      }
      return { ok: true, value: n };
    }
    case "date": {
      const d = parseDate(raw);
      return d ? { ok: true, value: d } : { ok: false, message: `"${text}" bukan tanggal. Pakai format 2026-10-01 atau 01/10/2026.` };
    }
    case "time": {
      const t = parseClock(raw);
      return t ? { ok: true, value: t } : { ok: false, message: `"${text}" bukan jam. Pakai format 08.00.` };
    }
    case "enum": {
      const v = matchOption(col.options ?? [], text);
      return v !== null ? { ok: true, value: v } : { ok: false, message: `"${text}" tidak dikenal. Pilihan: ${optionLabels(col)}.` };
    }
    case "bool": {
      const b = parseBool(raw);
      return b !== null ? { ok: true, value: b } : { ok: false, message: `"${text}" harus Ya atau Tidak.` };
    }
    case "url": {
      const u = looksLikeUrl(text);
      if (!u) return { ok: false, message: `"${text}" bukan tautan http(s) yang valid.` };
      return tooLong(u) ?? { ok: true, value: u };
    }
    case "color": {
      const c = text.startsWith("#") ? text : `#${text}`;
      return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)
        ? { ok: true, value: c.toLowerCase() }
        : { ok: false, message: `"${text}" bukan kode warna hex (mis. #3b82f6).` };
    }
    case "division": {
      const k = matchDivision(ctx, text);
      return k ? { ok: true, value: k } : { ok: false, message: `Divisi "${text}" tidak ada di Ormawa Visit ini. Lihat sheet Referensi.` };
    }
    case "divisions": {
      const keys: string[] = [];
      for (const part of splitList(text)) {
        const k = matchDivision(ctx, part);
        if (!k) return { ok: false, message: `Divisi "${part}" tidak ada di Ormawa Visit ini. Lihat sheet Referensi.` };
        if (!keys.includes(k)) keys.push(k);
      }
      return { ok: true, value: keys };
    }
  }
}

/** Does a header cell name this column? */
function headerMatches(col: ColumnSpec, raw: string): boolean {
  const n = normHeader(raw);
  return !!n && [col.header, ...(col.aliases ?? [])].some((h) => normHeader(h) === n);
}

/**
 * Read a filled-in sheet against a module spec.
 *
 * Never throws on bad data: every problem becomes a RowIssue with the Excel row
 * number and the column header, so the dialog can show all of them at once
 * instead of one per upload.
 */
export function parseGrid(spec: ModuleSpec, ctx: ImportContext, grid: Grid): ParseResult {
  const cols = spec.columns(ctx);
  const result: ParseResult = { rows: [], errors: [], ignoredHeaders: [], missingColumns: [] };

  // 1. Find the header row: the first of the top rows naming most columns.
  let headerRow = -1;
  let best = 0;
  for (let r = 0; r < Math.min(HEADER_SCAN, grid.rows.length); r++) {
    const hits = (grid.rows[r] ?? []).filter((v) => cols.some((c) => headerMatches(c, cellText(v)))).length;
    if (hits > best) { best = hits; headerRow = r; }
  }
  if (headerRow < 0) {
    result.missingColumns = cols.filter((c) => c.required).map((c) => c.header);
    if (!result.missingColumns.length) result.missingColumns = cols.map((c) => c.header);
    return result;
  }

  // 2. Map sheet columns to spec columns.
  const colAt = new Map<number, ColumnSpec>();
  (grid.rows[headerRow] ?? []).forEach((v, c) => {
    const text = cellText(v);
    if (!text) return;
    const col = cols.find((x) => headerMatches(x, text) && ![...colAt.values()].includes(x));
    if (col) colAt.set(c, col);
    else result.ignoredHeaders.push(text);
  });
  const present = new Set([...colAt.values()].map((c) => c.key));
  result.missingColumns = cols.filter((c) => c.required && !present.has(c.key)).map((c) => c.header);
  if (result.missingColumns.length) return result;

  // 3. Resolve merges below the header: fill, or record a span.
  const rows = grid.rows.map((r) => [...r]);
  const spans = new Map<string, number>(); // `${row}:${col}` -> span
  const covered = new Set<string>();
  for (const m of grid.merges) {
    if (m.bottom <= headerRow) continue;
    const top = Math.max(m.top, headerRow + 1);
    const value = grid.rows[m.top]?.[m.left] ?? null;
    for (let c = m.left; c <= m.right; c++) {
      const col = colAt.get(c);
      if (col?.merge === "span" && m.bottom > top) {
        if (!rows[top]) rows[top] = [];
        rows[top][c] = value;
        spans.set(`${top}:${c}`, m.bottom - top + 1);
        for (let r = top + 1; r <= m.bottom; r++) covered.add(`${r}:${c}`);
      } else {
        for (let r = top; r <= m.bottom; r++) {
          if (!rows[r]) rows[r] = [];
          rows[r][c] = value;
        }
      }
    }
  }

  // 4. Rows.
  for (let r = headerRow + 1; r < rows.length; r++) {
    const raw = rows[r] ?? [];
    const line = r + 1;
    // A row inside a merged run is never skipped, even when the merge is all
    // it has: dropping it would make the span above point one row too far.
    const inRun = [...colAt.keys()].some((c) => covered.has(`${r}:${c}`));
    const blank = !inRun && [...colAt.keys()].every((c) => cellText(raw[c] ?? null) === "");
    if (blank) continue;
    if (result.rows.length >= spec.maxRows) {
      result.errors.push({ line, column: "-", message: `Maksimal ${spec.maxRows} baris per impor. Sisanya tidak dibaca.` });
      break;
    }
    const row: ParsedRow = { line, values: {}, spans: {} };
    for (const col of cols) row.values[col.key] = col.kind === "bool" ? false : null;
    for (const [c, col] of colAt) {
      if (covered.has(`${r}:${c}`)) continue;
      const n = normaliseCell(col, raw[c] ?? null, ctx);
      if (!n.ok) { result.errors.push({ line, column: col.header, message: n.message }); continue; }
      row.values[col.key] = n.value;
      const span = spans.get(`${r}:${c}`);
      if (span) row.spans[col.key] = span;
    }
    for (const col of cols) {
      const v = row.values[col.key];
      if (col.required && (v === null || v === "" || (Array.isArray(v) && !v.length))) {
        // Covered by a merge above counts as filled for span columns.
        const c = [...colAt.entries()].find(([, x]) => x === col)?.[0];
        if (c !== undefined && covered.has(`${r}:${c}`)) continue;
        if (!result.errors.some((e) => e.line === line && e.column === col.header)) {
          result.errors.push({ line, column: col.header, message: "Wajib diisi." });
        }
      }
    }
    result.rows.push(row);
  }
  return result;
}
