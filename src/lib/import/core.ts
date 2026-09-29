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
// matching, merged cells, dates typed three different ways, "Rp 1.500.000",
// a phone number Excel stripped the leading zero from - is unit tested without
// a workbook. `xlsx.server.ts` turns a workbook into a Grid and a spec into a
// template; nothing else touches the file format.
//
// Merged cells have two meanings, chosen per column:
//   - "span" (rundown MC / operator / division columns): the merge IS the data.
//     It becomes the row's `merges` entry, exactly what the table's own
//     "Gabung dengan baris di bawah" button stores.
//   - everything else: a merge is how people avoid typing the same value
//     twice, so its value is FILLED into every row it covers.
//
// Problems come in two strengths. An ERROR blocks the whole file (the value
// cannot be stored as written). A WARNING is shown and imported anyway (a PIC
// who is not on the roster, a row that repeats another one) because the person
// may well mean it. `notes` are file-level remarks ("dates were read day-first").
// ============================================================

export const IMPORT_MODULES = [
  "tasks", "prospects", "links", "budget", "rundown", "jobs", "members", "fgd", "compare",
] as const;
export type ImportModule = (typeof IMPORT_MODULES)[number];

export const isImportModule = (v: unknown): v is ImportModule =>
  typeof v === "string" && (IMPORT_MODULES as readonly string[]).includes(v);

/** Bumped when a template's layout changes in a way the reader must know about. */
export const TEMPLATE_VERSION = 2;

/** An Excel error value (#N/A, #REF!, ...) in a cell. */
export interface CellError {
  error: string;
}

/** A cell as read from the workbook, before any column rules apply. */
export type CellValue = string | number | boolean | Date | CellError | null;

/** A merged range, 0-based and inclusive, in sheet coordinates. */
export interface MergeRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** One worksheet as plain data. `rows[r][c]`, 0-based. */
export interface Grid {
  rows: CellValue[][];
  merges: MergeRange[];
}

/** What a template and a parse may depend on: the active edition's lists. */
export interface ImportContext {
  eventTitle: string;
  divisions: { key: string; name: string; short: string; exclude_from_rundown?: boolean }[];
  /** Member display names, for the PIC dropdowns and the roster check. */
  members: string[];
  /** Other ways a member is written in a PIC cell: nickname, first name.
   *  A PIC of "Maya" for "Maya Kusuma" is normal and must not be a warning. */
  memberAliases?: string[];
}

export type ColumnKind =
  | "text" | "longtext" | "number" | "date" | "time" | "timerange" | "enum" | "bool" | "year"
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
  /** Accepted on upload but not written into the template (e.g. a single
   *  "Waktu 08.00 - 08.30" column from an older rundown sheet). */
  uploadOnly?: boolean;
  /** Names separated by commas that should be people on the roster: an
   *  unknown one is a WARNING, never an error (a guest speaker is fine). */
  people?: boolean;
  /** A phone number: a leading 0 that Excel stripped is put back. */
  phone?: boolean;
}

export type RowValue = string | number | boolean | string[] | null;
export type RowValues = Record<string, RowValue>;

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
  /** Headers the app fills in by itself (No, Durasi): recognised and skipped
   *  quietly instead of being reported as unknown. */
  autoColumns?: string[];
  /**
   * What makes two rows "the same thing" in this menu, for the duplicate
   * warnings (inside the file, and against rows already in the database).
   * Null = the row has nothing to compare on.
   */
  identity?: (v: RowValues) => string | null;
  /** Whether rows that already exist may be skipped on import. False for the
   *  rundown: dropping a row from a merged run would shift every span below. */
  canSkipExisting?: boolean;
}

export interface ParsedRow {
  /** Spreadsheet row number as Excel shows it (1-based), for error messages. */
  line: number;
  values: RowValues;
  /** Rowspans for "span" columns, keyed by column key. */
  spans: Record<string, number>;
}

export type IssueLevel = "error" | "warning";

export interface RowIssue {
  line: number;
  /** Header of the column, as the person sees it ("-" for a row-level issue). */
  column: string;
  message: string;
  level: IssueLevel;
  /** Spec column key, when the issue belongs to one column. */
  key?: string;
  /** 0-based sheet column, for highlighting the cell in the report. */
  col?: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowIssue[];
  warnings: RowIssue[];
  /** File-level remarks shown above the preview. */
  notes: string[];
  /** Headers in the file that match no column (ignored, reported). */
  ignoredHeaders: string[];
  /** Required columns whose header is missing entirely. */
  missingColumns: string[];
  /** 0-based index of the header row, -1 when none was found. */
  headerRow: number;
  /** Spec column key -> 0-based sheet column. */
  columnAt: Record<string, number>;
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

/** Text comparison for duplicates: case and runs of whitespace don't matter. */
export function normText(v: RowValue | undefined): string {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join(",") : String(v);
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export const isCellError = (v: CellValue): v is CellError =>
  typeof v === "object" && v !== null && !(v instanceof Date) && "error" in v;

/**
 * The text a cell shows. Non-breaking and zero-width spaces are folded away:
 * both arrive constantly from text pasted out of WhatsApp, PDFs and web pages,
 * and are invisible, so "Event " failing to match "Event" is unfixable
 * for the person staring at it.
 */
function cellText(v: CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return ymdUTC(v);
  if (isCellError(v)) return v.error;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v)
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/[​-‍﻿]/g, "")
    .trim();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Spreadsheet dates are wall-clock values stored as UTC; read them as such. */
function ymdUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** A date cell landing in a TEXT column, written the way the app writes dates. */
function shortDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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

/** "03/04/2026": both halves could be the month, so it was read day-first. */
function isAmbiguousDate(v: CellValue): boolean {
  if (typeof v !== "string") return false;
  const m = cellText(v).match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  return !!m && +m[1] <= 12 && +m[2] <= 12 && +m[1] !== +m[2];
}

/** A clock time typed or formatted any of the usual ways, as "HH.MM". */
export function parseClock(v: CellValue): string | null {
  let minutes: number | null = null;
  if (v instanceof Date) minutes = v.getUTCHours() * 60 + v.getUTCMinutes();
  else if (typeof v === "number" && v >= 0 && v < 1) minutes = Math.round(v * 1440) % 1440;
  else if (typeof v === "number" && v >= 1 && v < 24) {
    // "08.30" typed into a column Google Sheets treats as a number arrives as
    // 8.3: the decimals are the minutes, not a fraction of an hour.
    const h = Math.floor(v);
    const min = Math.round((v - h) * 100);
    if (min <= 59) minutes = h * 60 + min;
  } else {
    const s = cellText(v).replace(/\s+/g, "").replace(/(wib|wita|wit)$/i, "");
    const m = s.match(/^(\d{1,2})(?:[.:h]?(\d{2}))?$/);
    if (m) {
      const h = +m[1], min = m[2] ? +m[2] : 0;
      if (h <= 23 && min <= 59) minutes = h * 60 + min;
    }
  }
  if (minutes === null) return null;
  return `${pad(Math.floor(minutes / 60))}.${pad(minutes % 60)}`;
}

/** "08.00 - 08.30" (or "08:00–08:30", "08.00 s/d 08.30") as a start/end pair. */
export function parseClockRange(v: CellValue): { start: string; end: string } | null {
  const s = cellText(v);
  // Hyphen, en dash, em dash (written as escapes: the source has a no-em-dash rule).
  const parts = s.split(/\s*(?:-|\u2013|\u2014|s\/d|sd|sampai|to)\s*/i).filter(Boolean);
  if (parts.length !== 2) return null;
  const start = parseClock(parts[0]);
  const end = parseClock(parts[1]);
  return start && end ? { start, end } : null;
}

/**
 * A number typed the way people type money: 1500000, 1.500.000, Rp 1.500.000,
 * 1,5 (a decimal comma), 1.5 (a decimal point), 1.500.000,- (the Rupiah dash).
 */
export function parseNumber(v: CellValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = cellText(v).replace(/rp\.?|idr|\s/gi, "").replace(/,-$|\.-$/, "");
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return /^-?\d+(\.\d+)?$/.test(s) && Number.isFinite(n) ? n : null;
}

const TRUE_WORDS = ["ya", "y", "yes", "true", "benar", "1", "v", "x", "✓", "✔", "sudah", "selesai", "done"];
const FALSE_WORDS = ["tidak", "t", "no", "n", "false", "salah", "0", "belum", "-", "✗", "✘"];

function parseBool(v: CellValue): boolean | null {
  if (typeof v === "boolean") return v;
  const s = cellText(v).toLowerCase();
  if (!s) return false;
  if (TRUE_WORDS.includes(s)) return true;
  if (FALSE_WORDS.includes(s)) return false;
  return null;
}

/**
 * Edit distance where swapping two neighbouring letters counts as ONE edit
 * ("Doen" -> "Done"), the most common typo there is. Capped: anything above
 * `max` is reported as max + 1.
 */
export function distance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], before[j - 2] + 1);
      }
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    before = prev;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * The candidate someone probably meant: a close spelling ("Evnt" -> "Event"),
 * or one that starts with what they typed ("Crea" -> "Creative"). Returns the
 * candidate as written, or null when nothing is close enough to be helpful.
 */
export function suggest(raw: string, candidates: string[]): string | null {
  const n = normHeader(raw);
  if (!n) return null;
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const cn = normHeader(c);
    if (!cn) continue;
    if (n.length >= 3 && (cn.startsWith(n) || n.startsWith(cn))) return c;
    const limit = cn.length <= 4 ? 1 : cn.length <= 8 ? 2 : 3;
    const d = distance(n, cn, limit);
    if (d <= limit && d < bestD) { best = c; bestD = d; }
  }
  return best;
}

const didYouMean = (s: string | null) => (s ? ` Maksudmu "${s}"?` : "");

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

function divisionHint(ctx: ImportContext, raw: string): string {
  const pool = ctx.divisions.flatMap((d) => [d.name, d.short]);
  const hit = suggest(raw, pool);
  const name = hit ? ctx.divisions.find((d) => d.name === hit || d.short === hit)?.name ?? hit : null;
  return didYouMean(name);
}

/** "a, b; c" or one per line. */
export function splitList(s: string): string[] {
  return s.split(/[,;\n/]+/).map((x) => x.trim()).filter(Boolean);
}

/** Names in a PIC cell: commas, semicolons, " dan ", " & " or new lines. */
export function splitPeople(s: string): string[] {
  return s.split(/\s*(?:[,;\n]|\s&\s|\sdan\s)\s*/i).map((x) => x.trim()).filter(Boolean);
}

function looksLikeUrl(s: string): string | null {
  const t = s.trim();
  if (/^https?:\/\/\S+$/i.test(t)) return t;
  // "drive.google.com/…" typed without the scheme.
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t)) return `https://${t}`;
  return null;
}

/** Human list of what an enum accepts, for error messages and the rules sheet. */
export function optionLabels(c: ColumnSpec): string {
  return (c.options ?? []).map((o) => o.label).join(" / ");
}

type Flag = "ambiguous-date" | "phone-fixed" | "date-as-text";
type Normalised =
  | { ok: true; value: RowValue; flag?: Flag }
  | { ok: false; message: string };

/** Apply one column's rules to one cell. Blank cells are `null` (checked for
 *  `required` by the caller). */
export function normaliseCell(col: ColumnSpec, raw: CellValue, ctx: ImportContext): Normalised {
  if (isCellError(raw)) {
    return { ok: false, message: `Sel berisi error Excel ${raw.error}. Perbaiki rumusnya atau ketik nilainya langsung.` };
  }
  const text = cellText(raw);
  const blank = text === "";
  if (blank && col.kind !== "bool") return { ok: true, value: null };
  const tooLong = (s: string) => col.max && s.length > col.max
    ? { ok: false as const, message: `Maksimal ${col.max} karakter (terisi ${s.length}).` }
    : null;

  switch (col.kind) {
    case "text":
    case "longtext": {
      if (raw instanceof Date) return { ok: true, value: shortDate(raw), flag: "date-as-text" };
      let s = col.kind === "text" ? text.replace(/\s*\n\s*/g, " ") : text;
      let flag: Flag | undefined;
      // Excel and Sheets store 081234567890 as the NUMBER 81234567890 unless
      // the column is text, silently dropping the 0 of every Indonesian mobile
      // number. Put it back: no phone number here starts with 8.
      if (col.phone && /^8\d{8,12}$/.test(s)) { s = `0${s}`; flag = "phone-fixed"; }
      if (col.phone && /^628\d{8,12}$/.test(s)) s = `+${s}`;
      return tooLong(s) ?? { ok: true, value: s, flag };
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
      if (!d) return { ok: false, message: `"${text}" bukan tanggal. Pakai format 2026-10-01 atau 01/10/2026.` };
      return { ok: true, value: d, flag: isAmbiguousDate(raw) ? "ambiguous-date" : undefined };
    }
    case "time": {
      const t = parseClock(raw);
      return t ? { ok: true, value: t } : { ok: false, message: `"${text}" bukan jam. Pakai format 08.00.` };
    }
    case "timerange": {
      const r = parseClockRange(raw);
      return r
        ? { ok: true, value: `${r.start}-${r.end}` }
        : { ok: false, message: `"${text}" bukan rentang jam. Pakai format 08.00 - 08.30.` };
    }
    case "enum": {
      const v = matchOption(col.options ?? [], text);
      if (v !== null) return { ok: true, value: v };
      const hint = suggest(text, (col.options ?? []).flatMap((o) => [o.label, ...(o.aliases ?? [])]));
      const label = hint ? col.options?.find((o) => o.label === hint || o.aliases?.includes(hint))?.label ?? hint : null;
      return { ok: false, message: `"${text}" tidak dikenal.${didYouMean(label)} Pilihan: ${optionLabels(col)}.` };
    }
    case "bool": {
      const b = parseBool(raw);
      return b !== null ? { ok: true, value: b } : { ok: false, message: `"${text}" harus Ya atau Tidak.` };
    }
    case "url": {
      const u = looksLikeUrl(text);
      if (!u) return { ok: false, message: `"${text}" bukan tautan yang valid. Salin alamat lengkapnya, diawali https://.` };
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
      return k
        ? { ok: true, value: k }
        : { ok: false, message: `Divisi "${text}" tidak ada di Ormawa Visit ini.${divisionHint(ctx, text)} Lihat sheet Referensi.` };
    }
    case "divisions": {
      const keys: string[] = [];
      for (const part of splitList(text)) {
        const k = matchDivision(ctx, part);
        if (!k) return { ok: false, message: `Divisi "${part}" tidak ada di Ormawa Visit ini.${divisionHint(ctx, part)} Lihat sheet Referensi.` };
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

/** How many of a spec's headers appear in the top rows of a grid. */
export function headerScore(spec: ModuleSpec, ctx: ImportContext, grid: Grid): number {
  const cols = spec.columns(ctx);
  let best = 0;
  for (let r = 0; r < Math.min(HEADER_SCAN, grid.rows.length); r++) {
    const hits = new Set<string>();
    for (const v of grid.rows[r] ?? []) {
      const c = cols.find((x) => headerMatches(x, cellText(v)));
      if (c) hits.add(c.key);
    }
    best = Math.max(best, hits.size);
  }
  return best;
}

/**
 * Parse a filled-in sheet against a module spec.
 *
 * Never throws on bad data: every problem becomes a RowIssue with the Excel row
 * number and the column header, so the dialog can show all of them at once
 * instead of one per upload.
 */
export function parseGrid(spec: ModuleSpec, ctx: ImportContext, grid: Grid): ParseResult {
  const cols = spec.columns(ctx);
  const result: ParseResult = {
    rows: [], errors: [], warnings: [], notes: [], ignoredHeaders: [], missingColumns: [],
    headerRow: -1, columnAt: {},
  };

  // 1. Find the header row: the one of the top rows naming the most columns.
  let best = 0;
  for (let r = 0; r < Math.min(HEADER_SCAN, grid.rows.length); r++) {
    const hits = (grid.rows[r] ?? []).filter((v) => cols.some((c) => headerMatches(c, cellText(v)))).length;
    if (hits > best) { best = hits; result.headerRow = r; }
  }
  const headerRow = result.headerRow;
  if (headerRow < 0) {
    result.missingColumns = cols.filter((c) => c.required).map((c) => c.header);
    if (!result.missingColumns.length) result.missingColumns = cols.filter((c) => !c.uploadOnly).map((c) => c.header);
    return result;
  }

  // 2. Map sheet columns to spec columns.
  const colAt = new Map<number, ColumnSpec>();
  const auto = new Set((spec.autoColumns ?? []).map(normHeader));
  const autoSeen: string[] = [];
  const repeated: string[] = [];
  const known = cols.filter((c) => !c.formula).map((c) => c.header);
  (grid.rows[headerRow] ?? []).forEach((v, c) => {
    const text = cellText(v);
    if (!text) return;
    const col = cols.find((x) => headerMatches(x, text));
    if (col && [...colAt.values()].includes(col)) { repeated.push(text); return; }
    if (col) { colAt.set(c, col); result.columnAt[col.key] = c; return; }
    if (auto.has(normHeader(text))) { autoSeen.push(text); return; }
    const hint = suggest(text, known);
    result.ignoredHeaders.push(hint ? `${text} (maksudmu "${hint}"?)` : text);
  });
  const present = new Set([...colAt.values()].map((c) => c.key));
  // A rundown sheet with one "Waktu 08.00-08.30" column has no separate
  // start/end columns, and that is fine.
  result.missingColumns = cols
    .filter((c) => c.required && !present.has(c.key))
    .map((c) => c.header);
  if (result.missingColumns.length) return result;
  if (autoSeen.length) {
    result.notes.push(`Kolom ${autoSeen.join(", ")} diabaikan karena diisi otomatis oleh aplikasi.`);
  }
  if (repeated.length) {
    result.notes.push(`Kolom ${[...new Set(repeated)].join(", ")} muncul lebih dari sekali; hanya kolom pertama yang dibaca.`);
  }

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
  const flags = { ambiguous: "", phone: 0, dateText: 0 };
  for (let r = headerRow + 1; r < rows.length; r++) {
    const raw = rows[r] ?? [];
    const line = r + 1;
    // A row inside a merged run is never skipped, even when the merge is all
    // it has: dropping it would make the span above point one row too far.
    const inRun = [...colAt.keys()].some((c) => covered.has(`${r}:${c}`));
    const blank = !inRun && [...colAt.entries()].every(
      ([c, col]) => col.formula || cellText(raw[c] ?? null) === "",
    );
    if (blank) continue;
    if (result.rows.length >= spec.maxRows) {
      result.errors.push({
        line, column: "-", level: "error",
        message: `Maksimal ${spec.maxRows} baris per impor. Pecah file menjadi beberapa bagian.`,
      });
      break;
    }
    const row: ParsedRow = { line, values: {}, spans: {} };
    for (const col of cols) row.values[col.key] = col.kind === "bool" ? false : null;
    for (const [c, col] of colAt) {
      if (covered.has(`${r}:${c}`) || col.formula) continue;
      const n = normaliseCell(col, raw[c] ?? null, ctx);
      if (!n.ok) {
        result.errors.push({ line, column: col.header, message: n.message, level: "error", key: col.key, col: c });
        continue;
      }
      row.values[col.key] = n.value;
      if (n.flag === "ambiguous-date" && !flags.ambiguous) flags.ambiguous = cellText(raw[c] ?? null);
      if (n.flag === "phone-fixed") flags.phone++;
      if (n.flag === "date-as-text") flags.dateText++;
      const span = spans.get(`${r}:${c}`);
      if (span) row.spans[col.key] = span;

      // Roster check: a warning, because a guest speaker is a fine PIC.
      if (col.people && typeof n.value === "string" && ctx.members.length) {
        const known = [...ctx.members, ...(ctx.memberAliases ?? [])];
        const roster = new Set(known.map(normHeader));
        for (const name of splitPeople(n.value)) {
          if (roster.has(normHeader(name))) continue;
          result.warnings.push({
            line, column: col.header, level: "warning", key: col.key, col: c,
            message: `"${name}" tidak ada di daftar anggota Ormawa Visit ini.${didYouMean(suggest(name, known))} Tetap diimpor apa adanya.`,
          });
        }
      }
    }
    for (const col of cols) {
      const v = row.values[col.key];
      if (col.required && (v === null || v === "" || (Array.isArray(v) && !v.length))) {
        // Covered by a merge above counts as filled for span columns.
        const c = result.columnAt[col.key];
        if (c !== undefined && covered.has(`${r}:${c}`)) continue;
        if (!result.errors.some((e) => e.line === line && e.key === col.key)) {
          result.errors.push({ line, column: col.header, message: "Wajib diisi.", level: "error", key: col.key, col: c });
        }
      }
    }
    result.rows.push(row);
  }

  if (flags.ambiguous) {
    result.notes.push(`Tanggal seperti "${flags.ambiguous}" dibaca sebagai hari/bulan/tahun (format Indonesia).`);
  }
  if (flags.phone) {
    result.notes.push(`${flags.phone} nomor kontak diberi angka 0 di depan lagi (Excel/Sheets menghapusnya karena kolomnya berformat angka).`);
  }
  if (flags.dateText) {
    result.notes.push(`${flags.dateText} sel tanggal di kolom teks ditulis ulang seperti "1 Okt 2026".`);
  }
  checkRepeats(spec, ctx, result);
  return result;
}

/**
 * Two kinds of accidental repeat, both warnings: a row identical to another
 * row of the same file, and a worked example copied from the "Contoh" sheet.
 */
function checkRepeats(spec: ModuleSpec, ctx: ImportContext, result: ParseResult) {
  if (spec.identity) {
    const first = new Map<string, number>();
    for (const row of result.rows) {
      const id = spec.identity(row.values);
      if (!id) continue;
      const seen = first.get(id);
      if (seen) {
        result.warnings.push({
          line: row.line, column: "-", level: "warning",
          message: `Sama dengan baris ${seen} di file ini.`,
        });
      } else first.set(id, row.line);
    }
  }

  const cols = spec.columns(ctx);
  // Span columns are left out: in the example sheet a merged cell keeps its
  // value only on the top row, so the rows it covers would never match.
  const signature = (values: RowValues) =>
    cols.filter((c) => !c.formula && c.merge !== "span").map((c) => normText(values[c.key])).join("\u0001");
  const examples = new Set(
    spec.examples(ctx).map((ex) => {
      const values: RowValues = {};
      for (const c of cols) {
        const n = normaliseCell(c, (ex[c.key] ?? null) as CellValue, ctx);
        values[c.key] = n.ok ? n.value : null;
      }
      return signature(values);
    }),
  );
  for (const row of result.rows) {
    if (examples.has(signature(row.values))) {
      result.warnings.push({
        line: row.line, column: "-", level: "warning",
        message: "Baris ini sama persis dengan contoh di template. Hapus kalau ikut tersalin tanpa sengaja.",
      });
    }
  }
}

/**
 * Lines whose identity already exists in the database, for the "sudah ada"
 * warning and the optional skip. `existing` are identities computed by the
 * same spec function from the stored rows, so both sides compare alike.
 */
export function existingLines(spec: ModuleSpec, rows: ParsedRow[], existing: Set<string>): Set<number> {
  const out = new Set<number>();
  if (!spec.identity || !existing.size) return out;
  for (const row of rows) {
    const id = spec.identity(row.values);
    if (id && existing.has(id)) out.add(row.line);
  }
  return out;
}
