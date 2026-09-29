"use server";
import { z } from "zod";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { getBudgetPlans, getDivisions, getMembers } from "@/lib/data/repo";
import { getCompareSubjects, getFgdPlans } from "@/lib/data/himpunan-repo";
import {
  existingRows, insertBudgetItems, insertCompareEntries, insertFgdRows, insertJobs, insertLinks,
  insertMembers, insertProspects, insertRundownRows, insertTasks,
} from "@/lib/data/import-repo";
import { canImport } from "@/lib/import/access";
import {
  IMPORT_MODULES, existingLines, headerScore, isImportModule, parseGrid,
  type ImportContext, type ModuleSpec, type ParsedRow, type RowIssue, type RowValues,
} from "@/lib/import/core";
import { specFor } from "@/lib/import/modules";
import { annotateWorkbook, buildTemplate, readWorkbook, WorkbookError } from "@/lib/import/xlsx.server";
import { angkatanFromNrp } from "@/lib/format";
import { computeDuration } from "@/lib/rundown-time";
import type { OVEvent, TaskStatus } from "@/lib/types";
import {
  budgetItemSchema, compareUpdateSchema, createLinkSchema, createTaskSchema, fgdRowUpdateSchema,
  jobSchema, memberSchema, prospectSchema, rundownSchema,
} from "./schemas";
import { archivedGuard, errMsg } from "./lock";

// ============================================================
// XLSX import: upload -> preview -> (report) -> commit.
//
// WHERE THE FILE GOES: nowhere. It travels in the Server Action request body,
// is read into memory (an ArrayBuffer) for the length of that one request,
// parsed, and dropped when the function returns. It is never written to
// Supabase Storage, to a table, or to disk, and there is no upload session to
// clean up. The database only ever sees (1) a few narrow reads per preview -
// the edition's divisions and roster names, the target list, and the columns
// the duplicate check compares - and (2) on commit, ONE multi-row insert.
//
// Every step receives the FILE, not rows: the commit re-reads and re-validates
// it rather than trusting a row list the browser sends back, so the preview is
// a courtesy and the commit is the authority. The browser keeps the File in
// memory between the steps; re-sending up to 3 MB is cheaper and simpler than
// keeping anything on the server between requests.
//
// Guards are the same as adding a row by hand in that menu (`canImport`
// borrows each menu's create permission), plus the archive lock of the active
// edition, which is also where every row is written - the edition is never
// taken from the file.
//
// A file with ANY error imports nothing. Importing "the good rows" sounds kind
// but breaks the rundown (a merge spanning a dropped row points at the wrong
// session) and leaves the person guessing which half of their sheet landed.
// Warnings (a PIC not on the roster, a row that already exists) never block.
// ============================================================

const MAX_BYTES = 3 * 1024 * 1024;

export interface PreviewIssue {
  /** Index into `columns`, or -1 for the whole row. */
  c: number;
  level: "error" | "warning";
  message: string;
}
export interface PreviewRow {
  line: number;
  cells: string[];
  /** The same row already exists in the menu. */
  existing: boolean;
  issues: PreviewIssue[];
}
export interface ImportPreview {
  ok: true;
  total: number;
  errorCount: number;
  warningCount: number;
  existingCount: number;
  canSkipExisting: boolean;
  notes: string[];
  ignoredHeaders: string[];
  /** Problems not tied to a parsed row (e.g. "too many rows"). */
  fileIssues: string[];
  columns: { key: string; header: string }[];
  rows: PreviewRow[];
  sheetName: string;
}
type Fail = { ok: false; error: string };

type Item = { line: number; data: unknown };
type Prepared = {
  spec: ModuleSpec;
  rows: ParsedRow[];
  errors: RowIssue[];
  warnings: RowIssue[];
  notes: string[];
  ignoredHeaders: string[];
  columns: { key: string; header: string }[];
  existing: Set<number>;
  headerRow: number;
  sheetName: string;
  buf: ArrayBuffer;
  fileName: string;
  /** A parsed value as the person would write it (division NAME, enum label). */
  label: (key: string, v: ParsedRow["values"][string]) => string;
  /** Insert every item whose line is not in `skip`. Returns how many. */
  commit: (skip: Set<number>) => Promise<number>;
  entities: Parameters<typeof revalidateEntities>;
};

async function importContext(event: OVEvent): Promise<ImportContext> {
  const [divisions, members] = await Promise.all([getDivisions(event.id), getMembers(event.id)]);
  return {
    eventTitle: event.title,
    divisions: divisions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ key: d.key, name: d.name, short: d.short, exclude_from_rundown: d.exclude_from_rundown })),
    members: members.map((m) => m.name).filter(Boolean),
    // How people actually write a PIC: "Maya" for Maya Kusuma, or a nickname.
    memberAliases: [...new Set(members.flatMap((m) => [m.nickname, m.name?.split(/\s+/)[0]]).filter((x): x is string => !!x))],
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : null);

async function prepare(fd: FormData): Promise<Prepared | Fail> {
  const user = await getCurrentUser();
  const mod = fd.get("module");
  if (!isImportModule(mod)) return { ok: false, error: "Jenis impor tidak dikenal." };
  if (!canImport(user, mod)) return { ok: false, error: "Kamu tidak punya akses menambah data di menu ini." };

  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Pilih file .xlsx terlebih dahulu." };
  if (/\.(xls|csv|ods|numbers)$/i.test(file.name)) {
    return { ok: false, error: "Format ini belum didukung. Simpan ulang sebagai Excel Workbook (.xlsx)." };
  }
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "File harus berformat .xlsx (Excel Workbook)." };
  if (file.size === 0) return { ok: false, error: "File kosong." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Ukuran file maksimal 3 MB. Pecah datanya menjadi beberapa file." };

  const event = await getActiveEvent();
  const blocked = await archivedGuard(user, event.id);
  if (blocked) return blocked;

  const spec = specFor(mod);
  const target = str(fd.get("target"));
  const buf = await file.arrayBuffer();
  const ctx = await importContext(event);
  let read;
  try {
    read = await readWorkbook(buf, spec.maxRows);
  } catch (e) {
    return { ok: false, error: e instanceof WorkbookError ? e.message : "File tidak bisa dibaca." };
  }

  // A template of ANOTHER menu is the classic mistake; say which one it is.
  if (read.meta && read.meta.module !== mod) {
    const other = specFor(read.meta.module);
    return {
      ok: false,
      error: `File ini adalah template ${other.title}, bukan ${spec.title}. Impor lewat menu ${other.title}, atau unduh template ${spec.title}.`,
    };
  }

  const parsed = parseGrid(spec, ctx, read.grid);
  if (parsed.missingColumns.length) {
    const guess = IMPORT_MODULES.filter((m) => m !== mod)
      .map((m) => ({ m, score: headerScore(specFor(m), ctx, read.grid) }))
      .sort((a, b) => b.score - a.score)[0];
    const hint = guess && guess.score >= 2 ? ` File ini sepertinya untuk menu ${specFor(guess.m).title}.` : "";
    return {
      ok: false,
      error: `Kolom wajib tidak ditemukan: ${parsed.missingColumns.join(", ")}. Pastikan baris pertama sheet ${read.sheetName} berisi judul kolom dari template.${hint}`,
    };
  }

  const notes = [...parsed.notes];
  if (read.meta?.eventId && read.meta.eventId !== event.id) {
    notes.unshift(
      `Template ini diunduh untuk Ormawa Visit lain. Data tetap masuk ke "${event.title}" (yang sedang aktif); periksa kolom divisi bila ada.`,
    );
  }
  if (!parsed.rows.length && read.sheetNames.some((n) => n.toLowerCase() === "contoh")) {
    notes.unshift("Sheet Data masih kosong. Sheet Contoh tidak ikut diimpor: isi datamu di sheet Data.");
  }

  const cols = spec.columns(ctx);
  const headerOf = (key: string) => cols.find((c) => c.key === key)?.header ?? key;
  // A column the template doesn't have (the rundown's "Waktu" range) only
  // shows up in the preview when the file actually used it.
  const columns = cols
    .filter((c) => !c.formula && (!c.uploadOnly || parsed.columnAt[c.key] !== undefined))
    .map((c) => ({ key: c.key, header: c.header }));
  const errors = [...parsed.errors];
  const rows = parsed.rows;

  // A row the parser already flagged is not re-reported by Zod: the same bad
  // cell would otherwise show up twice ("Divisi X tidak ada" + "Divisi wajib").
  const flagged = new Set(parsed.errors.map((e) => e.line));
  const check = <S extends z.ZodTypeAny>(schema: S, line: number, input: unknown): z.infer<S> | null => {
    const v = schema.safeParse(input);
    if (v.success) return v.data;
    if (!flagged.has(line)) {
      for (const i of v.error.issues) {
        const key = String(i.path[0] ?? "");
        errors.push({
          line, level: "error", column: key ? headerOf(key) : "-", message: i.message,
          key: key || undefined, col: key ? parsed.columnAt[key] : undefined,
        });
      }
    }
    return null;
  };

  // Rows that already exist in the menu: one narrow read, compared by the
  // spec's identity so a re-upload of the same file is caught.
  let existing = new Set<number>();
  if (spec.identity) {
    const stored = await existingRows(mod, event.id, target);
    const ids = new Set(stored.map((r) => spec.identity!(r as RowValues)).filter((x): x is string => !!x));
    existing = existingLines(spec, rows, ids);
  }
  const warnings = [...parsed.warnings];
  for (const line of existing) {
    warnings.push({
      line, column: "-", level: "warning",
      message: spec.canSkipExisting === false
        ? `Data yang sama sudah ada di ${spec.title}. Kalau diimpor, akan tercatat dua kali.`
        : `Data yang sama sudah ada di ${spec.title}. Centang "Lewati yang sudah ada" untuk tidak mengimpornya lagi.`,
    });
  }

  const divisionName = new Map(ctx.divisions.map((d) => [d.key, d.name]));
  const label = (key: string, v: ParsedRow["values"][string]): string => {
    const col = cols.find((c) => c.key === key);
    if (v === null || v === undefined || v === false) return "";
    if (v === true) return "Ya";
    if (col?.kind === "division" && typeof v === "string") return divisionName.get(v) ?? v;
    if (Array.isArray(v)) return v.map((k) => (col?.kind === "divisions" ? divisionName.get(k) ?? k : k)).join(", ");
    if (col?.kind === "enum") return col.options?.find((o) => o.value === v)?.label ?? String(v);
    return String(v);
  };

  const base = {
    spec, rows, errors, warnings, notes, existing, columns, label,
    ignoredHeaders: parsed.ignoredHeaders, headerRow: parsed.headerRow,
    sheetName: read.sheetName, buf, fileName: file.name,
  };
  /** Build the item list once; commit inserts all but the skipped lines. */
  const make = (
    items: Item[],
    insert: (data: never[]) => Promise<void>,
    ...entities: Parameters<typeof revalidateEntities>
  ): Prepared => ({
    ...base,
    entities,
    commit: async (skip) => {
      const keep = items.filter((i) => !skip.has(i.line) && i.data !== null);
      if (keep.length) await insert(keep.map((i) => i.data) as never[]);
      return keep.length;
    },
  });
  const each = (fn: (r: ParsedRow) => unknown): Item[] => rows.map((r) => ({ line: r.line, data: fn(r) }));

  switch (mod) {
    case "tasks":
      return make(each((r) => {
        const d = check(createTaskSchema, r.line, {
          event_id: event.id,
          division: str(r.values.division),
          title: str(r.values.title),
          pic: str(r.values.pic),
          start_date: r.values.start_date ?? null,
          end_date: r.values.end_date ?? null,
          notes: str(r.values.notes),
          evaluation: str(r.values.evaluation),
          status: (r.values.status as TaskStatus | null) ?? undefined,
        });
        return d && { ...d, pic: d.pic ?? "", notes: d.notes ?? "", evaluation: d.evaluation ?? "" };
      }), insertTasks as never, "tasks");

    case "prospects":
      return make(each((r) => {
        const d = check(prospectSchema, r.line, {
          no: str(r.values.no), org_name: str(r.values.org_name), campus: str(r.values.campus),
          location: str(r.values.location), contact: str(r.values.contact), date_text: str(r.values.date_text),
          month: str(r.values.month), mode: str(r.values.mode), pic: str(r.values.pic),
          contact_status: str(r.values.contact_status), their_response: str(r.values.their_response),
          our_response: str(r.values.our_response), done: r.values.done === true, notes: str(r.values.notes),
        });
        return d && { ...d, event_id: event.id };
      }), insertProspects as never, "prospects");

    case "links":
      return make(each((r) => {
        const d = check(createLinkSchema, r.line, {
          section: str(r.values.section), division: str(r.values.division),
          name: str(r.values.name), url: str(r.values.url), note: str(r.values.note),
        });
        return d && {
          ...d, note: d.note ?? "", section: d.section ?? "", division: d.division ?? "", event_id: event.id,
        };
      }), insertLinks as never, "links");

    case "budget": {
      const plans = await getBudgetPlans(event.id);
      const plan = plans.find((p) => p.id === target);
      if (!plan) return { ok: false, error: "Pilih rencana anggaran tujuan terlebih dahulu." };
      return make(each((r) => {
        const d = check(budgetItemSchema, r.line, {
          category: str(r.values.category), name: str(r.values.name),
          qty: num(r.values.qty), unit: str(r.values.unit), unit_price: num(r.values.unit_price),
          category_color: r.values.category_color ? str(r.values.category_color) : null,
        });
        return d && {
          category: d.category, name: d.name, qty: d.qty ?? null, unit: d.unit ?? "",
          unit_price: d.unit_price ?? null, category_color: d.category_color ?? null,
        };
      }), ((data: never[]) => insertBudgetItems(plan.id, data)) as never, "budget");
    }

    case "rundown":
      return make(each((r) => {
        const division_jobs: Record<string, string> = {};
        const merges: Record<string, number> = {};
        for (const [key, value] of Object.entries(r.values)) {
          if (key.startsWith("job:") && value) division_jobs[key.slice(4)] = str(value);
        }
        for (const [key, span] of Object.entries(r.spans)) {
          merges[key.startsWith("job:") ? key.slice(4) : key] = span;
        }
        // An older sheet may carry one "Waktu 08.00 - 08.30" column instead.
        const [rangeStart = "", rangeEnd = ""] = str(r.values.time_range).split("-");
        const time_start = str(r.values.time_start) || rangeStart;
        const time_end = str(r.values.time_end) || rangeEnd;
        const d = check(rundownSchema, r.line, {
          time_start, time_end, duration: computeDuration(time_start, time_end) ?? "",
          activity: str(r.values.activity), mc: str(r.values.mc), operator: str(r.values.operator),
          keterangan: str(r.values.keterangan), division_jobs, merges,
        });
        return d && {
          time_start: d.time_start ?? "", time_end: d.time_end ?? "", duration: d.duration ?? "",
          activity: d.activity ?? "", keterangan: d.keterangan ?? "", mc: d.mc ?? "",
          operator: d.operator ?? "", division_jobs: d.division_jobs ?? {}, merges: d.merges ?? {},
        };
      }), ((data: never[]) => insertRundownRows(event.id, data)) as never, "rundown");

    case "jobs":
      return make(each((r) => {
        const d = check(jobSchema, r.line, { pic: str(r.values.pic), job: str(r.values.job), notes: str(r.values.notes) });
        return d && d.job ? { event_id: event.id, job: d.job, pic: d.pic ?? "", notes: d.notes ?? "" } : null;
      }), insertJobs as never, "jobs");

    case "members":
      return make(each((r) => {
        const nrp = str(r.values.nrp);
        const d = check(memberSchema, r.line, {
          name: str(r.values.name),
          nickname: str(r.values.nickname),
          nrp,
          divisions: Array.isArray(r.values.divisions) ? r.values.divisions : [],
          type: (r.values.type as "fungsionaris" | "intern" | null) ?? undefined,
          year: num(r.values.year) ?? angkatanFromNrp(nrp) ?? undefined,
        });
        return d && { ...d, event_id: event.id };
      }), insertMembers as never, "members");

    case "fgd": {
      const plans = await getFgdPlans(event.id);
      const plan = plans.find((p) => p.id === target);
      if (!plan) return { ok: false, error: "Pilih tabel FGD tujuan terlebih dahulu." };
      return make(each((r) => {
        const d = check(fgdRowUpdateSchema, r.line, { ours: str(r.values.ours), theirs: str(r.values.theirs) });
        return d && { ours: d.ours ?? "", theirs: d.theirs ?? "" };
      }), ((data: never[]) => insertFgdRows(plan.id, data)) as never, "himpunan");
    }

    case "compare": {
      const subjects = await getCompareSubjects(event.id);
      const subject = subjects.find((s) => s.id === target);
      if (!subject) return { ok: false, error: "Pilih himpunan yang dinilai terlebih dahulu." };
      return make(each((r) => {
        const d = check(compareUpdateSchema, r.line, {
          section: str(r.values.section), no: str(r.values.no), aspect: str(r.values.aspect),
          indicator: str(r.values.indicator), plus: str(r.values.plus), minus: str(r.values.minus),
        });
        return d && {
          section: d.section ?? "", no: d.no ?? "", aspect: d.aspect ?? "",
          indicator: d.indicator ?? "", plus: d.plus ?? "", minus: d.minus ?? "",
        };
      }), ((data: never[]) => insertCompareEntries(subject, data)) as never, "himpunan");
    }
  }
}

/** Run prepare(), turning an unexpected throw into a readable failure. */
async function safePrepare(fd: FormData): Promise<Prepared | Fail> {
  try {
    return await prepare(fd);
  } catch (e) {
    return errMsg(e, "Gagal membaca file.");
  }
}


/**
 * The menu's template, built for the ACTIVE edition (its divisions become the
 * dropdown, and the rundown's columns). A server action rather than an /api
 * route on purpose: the app has none, and proxy.ts keeps it that way so the
 * first one is not born unauthenticated. Read-only: it builds a file in memory
 * and writes nothing.
 */
export async function downloadImportTemplateAction(
  mod: string,
): Promise<{ ok: true; fileName: string; base64: string } | Fail> {
  const user = await getCurrentUser();
  if (!isImportModule(mod)) return { ok: false, error: "Jenis impor tidak dikenal." };
  if (!canImport(user, mod)) return { ok: false, error: "Kamu tidak punya akses menambah data di menu ini." };
  const event = await getActiveEvent();
  const spec = specFor(mod);
  try {
    const buf = await buildTemplate(spec, await importContext(event), event.id);
    const slug = (event.code || event.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    return { ok: true, fileName: `${spec.fileName}${slug ? `-${slug}` : ""}.xlsx`, base64: buf.toString("base64") };
  } catch (e) {
    return errMsg(e, "Gagal membuat template.");
  }
}

/** Read the file and report what an import WOULD do. Writes nothing. */
export async function previewImportAction(fd: FormData): Promise<ImportPreview | Fail> {
  const p = await safePrepare(fd);
  if (!("commit" in p)) return p;
  const colIndex = new Map(p.columns.map((c, i) => [c.key, i]));
  const byLine = new Map<number, PreviewIssue[]>();
  const fileIssues: string[] = [];
  const lines = new Set(p.rows.map((r) => r.line));
  for (const i of [...p.errors, ...p.warnings]) {
    if (!lines.has(i.line)) { fileIssues.push(`Baris ${i.line}: ${i.message}`); continue; }
    const entry: PreviewIssue = { c: i.key !== undefined ? colIndex.get(i.key) ?? -1 : -1, level: i.level, message: i.message };
    byLine.set(i.line, [...(byLine.get(i.line) ?? []), entry]);
  }
  return {
    ok: true,
    total: p.rows.length,
    errorCount: p.errors.length,
    warningCount: p.warnings.length,
    existingCount: p.existing.size,
    canSkipExisting: p.spec.canSkipExisting !== false,
    notes: p.notes,
    ignoredHeaders: p.ignoredHeaders,
    fileIssues,
    columns: p.columns,
    sheetName: p.sheetName,
    rows: p.rows.map((r) => ({
      line: r.line,
      cells: p.columns.map((c) => {
        const s = p.label(c.key, r.values[c.key] ?? null);
        const span = r.spans[c.key];
        return span && span > 1 ? `${s} [gabung ${span} baris]` : s;
      }),
      existing: p.existing.has(r.line),
      issues: byLine.get(r.line) ?? [],
    })),
  };
}

/**
 * The person's own file handed back with every problem marked in place (see
 * annotateWorkbook). Built in memory from the upload and returned; nothing is
 * stored, and nothing is written to the database.
 */
export async function importReportAction(
  fd: FormData,
): Promise<{ ok: true; fileName: string; base64: string } | Fail> {
  const p = await safePrepare(fd);
  if (!("commit" in p)) return p;
  const issues = [...p.errors, ...p.warnings];
  if (!issues.length) return { ok: false, error: "Tidak ada kesalahan atau peringatan di file ini." };
  try {
    const out = await annotateWorkbook(p.buf, p.sheetName, p.headerRow, issues);
    const base = p.fileName.replace(/\.xlsx$/i, "");
    return { ok: true, fileName: `${base}-hasil-pemeriksaan.xlsx`, base64: out.toString("base64") };
  } catch (e) {
    return { ok: false, error: e instanceof WorkbookError ? e.message : "Gagal membuat laporan pemeriksaan." };
  }
}

/**
 * Import the file. All rows or none: any error refuses the whole file. With
 * `skipExisting`, rows that already exist in the menu are left out (never for
 * the rundown, where a dropped row would shift the merged cells below it).
 */
export async function commitImportAction(
  fd: FormData,
): Promise<{ ok: true; inserted: number; skipped: number } | Fail> {
  const p = await safePrepare(fd);
  if (!("commit" in p)) return p;
  if (!p.rows.length) return { ok: false, error: "Tidak ada baris data yang bisa diimpor." };
  if (p.errors.length) {
    return { ok: false, error: `Masih ada ${p.errors.length} kesalahan di file. Perbaiki lalu unggah ulang.` };
  }
  const skip = fd.get("skipExisting") === "1" && p.spec.canSkipExisting !== false ? p.existing : new Set<number>();
  if (skip.size === p.rows.length) {
    return { ok: false, error: "Semua baris di file ini sudah ada. Tidak ada yang perlu diimpor." };
  }
  let inserted = 0;
  try {
    inserted = await p.commit(skip);
  } catch (e) {
    return errMsg(e, "Gagal mengimpor data.");
  }
  revalidateEntities(...p.entities);
  return { ok: true, inserted, skipped: skip.size };
}
