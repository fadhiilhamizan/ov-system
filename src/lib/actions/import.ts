"use server";
import { z } from "zod";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { getBudgetPlans, getDivisions, getMembers } from "@/lib/data/repo";
import { getCompareSubjects, getFgdPlans } from "@/lib/data/himpunan-repo";
import {
  insertBudgetItems, insertCompareEntries, insertFgdRows, insertJobs, insertLinks, insertMembers,
  insertProspects, insertRundownRows, insertTasks,
} from "@/lib/data/import-repo";
import { canImport } from "@/lib/import/access";
import {
  isImportModule, parseGrid, type ImportContext, type ImportModule, type ParsedRow, type RowIssue,
} from "@/lib/import/core";
import { specFor } from "@/lib/import/modules";
import { buildTemplate, readWorkbook, WorkbookError } from "@/lib/import/xlsx.server";
import { angkatanFromNrp } from "@/lib/format";
import { computeDuration } from "@/lib/rundown-time";
import type { OVEvent, TaskStatus } from "@/lib/types";
import {
  budgetItemSchema, compareUpdateSchema, createLinkSchema, createTaskSchema, fgdRowUpdateSchema,
  jobSchema, memberSchema, prospectSchema, rundownSchema,
} from "./schemas";
import { archivedGuard, errMsg } from "./lock";

// ============================================================
// XLSX import: upload -> preview -> commit.
//
// Both steps receive the FILE, not rows: the commit re-reads and re-validates
// it rather than trusting a row list the browser sends back, so the preview is
// a courtesy and the commit is the authority. Guards are the same as adding a
// row by hand in that menu (`canImport` borrows each menu's create permission),
// plus the archive lock of the active edition, which is also where every row
// is written - the edition is never taken from the file.
//
// A file with ANY error imports nothing. Importing "the good rows" sounds kind
// but breaks the rundown (a merge spanning a dropped row points at the wrong
// session) and leaves the person guessing which half of their sheet landed.
// ============================================================

const MAX_BYTES = 3 * 1024 * 1024;
const PREVIEW_ROWS = 30;
const MAX_REPORTED = 100;

export interface ImportPreview {
  ok: true;
  total: number;
  errors: RowIssue[];
  errorCount: number;
  ignoredHeaders: string[];
  columns: { key: string; header: string }[];
  sample: { line: number; cells: string[] }[];
}
type Fail = { ok: false; error: string };

type Prepared = {
  module: ImportModule;
  rows: ParsedRow[];
  errors: RowIssue[];
  ignoredHeaders: string[];
  columns: { key: string; header: string }[];
  commit: () => Promise<void>;
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
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : null);

/** Zod errors on one row, reported against the Excel line and a header. */
function zodIssues(line: number, err: z.ZodError, headerOf: (key: string) => string): RowIssue[] {
  return err.issues.map((i) => ({
    line,
    column: headerOf(String(i.path[0] ?? "-")),
    message: i.message,
  }));
}

async function prepare(fd: FormData): Promise<Prepared | Fail> {
  const user = await getCurrentUser();
  const mod = fd.get("module");
  if (!isImportModule(mod)) return { ok: false, error: "Jenis impor tidak dikenal." };
  if (!canImport(user, mod)) return { ok: false, error: "Kamu tidak punya akses menambah data di menu ini." };

  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Pilih file .xlsx terlebih dahulu." };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "File harus berformat .xlsx (Excel Workbook)." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Ukuran file maksimal 3 MB." };

  const event = await getActiveEvent();
  const blocked = await archivedGuard(user, event.id);
  if (blocked) return blocked;

  const spec = specFor(mod);
  const ctx = await importContext(event);
  let grid;
  try {
    grid = await readWorkbook(await file.arrayBuffer(), spec.maxRows);
  } catch (e) {
    return { ok: false, error: e instanceof WorkbookError ? e.message : "File tidak bisa dibaca." };
  }
  const parsed = parseGrid(spec, ctx, grid);
  if (parsed.missingColumns.length) {
    return {
      ok: false,
      error: `Kolom wajib tidak ditemukan: ${parsed.missingColumns.join(", ")}. Pastikan baris pertama sheet Data berisi judul kolom dari template.`,
    };
  }
  const cols = spec.columns(ctx);
  const headerOf = (key: string) => cols.find((c) => c.key === key)?.header ?? key;
  const columns = cols.filter((c) => !c.formula).map((c) => ({ key: c.key, header: c.header }));
  const errors = [...parsed.errors];
  // A row the parser already flagged is not re-reported by Zod: the same bad
  // cell would otherwise show up twice ("Divisi X tidak ada" + "Divisi wajib").
  const flagged = new Set(parsed.errors.map((e) => e.line));
  const report = (line: number, err: z.ZodError) => {
    if (!flagged.has(line)) errors.push(...zodIssues(line, err, headerOf));
  };
  const rows = parsed.rows;
  const target = str(fd.get("target"));

  const base = { module: mod, rows, ignoredHeaders: parsed.ignoredHeaders, columns };
  const done = (commit: () => Promise<void>, ...entities: Parameters<typeof revalidateEntities>): Prepared =>
    ({ ...base, errors, commit, entities });

  switch (mod) {
    case "tasks": {
      const data = rows.map((r) => {
        const v = createTaskSchema.safeParse({
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
        if (!v.success) report(r.line, v.error);
        return v.success ? v.data : null;
      });
      return done(() => insertTasks(data.filter((d) => d !== null).map((d) => ({
        ...d,
        pic: d.pic ?? "", notes: d.notes ?? "", evaluation: d.evaluation ?? "",
      }))), "tasks");
    }
    case "prospects": {
      const data = rows.map((r) => {
        const v = prospectSchema.safeParse({
          no: str(r.values.no), org_name: str(r.values.org_name), campus: str(r.values.campus),
          location: str(r.values.location), contact: str(r.values.contact), date_text: str(r.values.date_text),
          month: str(r.values.month), mode: str(r.values.mode), pic: str(r.values.pic),
          contact_status: str(r.values.contact_status), their_response: str(r.values.their_response),
          our_response: str(r.values.our_response), done: r.values.done === true, notes: str(r.values.notes),
        });
        if (!v.success) report(r.line, v.error);
        return v.success ? v.data : null;
      });
      return done(() => insertProspects(data.filter((d) => d !== null).map((d) => ({ ...d, event_id: event.id }))), "prospects");
    }
    case "links": {
      const data = rows.map((r) => {
        const v = createLinkSchema.safeParse({
          section: str(r.values.section), division: str(r.values.division),
          name: str(r.values.name), url: str(r.values.url), note: str(r.values.note),
        });
        if (!v.success) report(r.line, v.error);
        return v.success ? v.data : null;
      });
      return done(() => insertLinks(data.filter((d) => d !== null).map((d) => ({
        ...d, note: d.note ?? "", section: d.section ?? "", division: d.division ?? "", event_id: event.id,
      }))), "links");
    }
    case "budget": {
      const plans = await getBudgetPlans(event.id);
      const plan = plans.find((p) => p.id === target);
      if (!plan) return { ok: false, error: "Pilih rencana anggaran tujuan terlebih dahulu." };
      const data = rows.map((r) => {
        const v = budgetItemSchema.safeParse({
          category: str(r.values.category), name: str(r.values.name),
          qty: num(r.values.qty), unit: str(r.values.unit), unit_price: num(r.values.unit_price),
          category_color: r.values.category_color ? str(r.values.category_color) : null,
        });
        if (!v.success) report(r.line, v.error);
        return v.success ? v.data : null;
      });
      return done(() => insertBudgetItems(plan.id, data.filter((d) => d !== null).map((d) => ({
        category: d.category, name: d.name, qty: d.qty ?? null, unit: d.unit ?? "",
        unit_price: d.unit_price ?? null, category_color: d.category_color ?? null,
      }))), "budget");
    }
    case "rundown": {
      const data = rows.map((r) => {
        const division_jobs: Record<string, string> = {};
        const merges: Record<string, number> = {};
        for (const [key, value] of Object.entries(r.values)) {
          if (key.startsWith("job:") && value) division_jobs[key.slice(4)] = str(value);
        }
        for (const [key, span] of Object.entries(r.spans)) {
          merges[key.startsWith("job:") ? key.slice(4) : key] = span;
        }
        const time_start = str(r.values.time_start);
        const time_end = str(r.values.time_end);
        const v = rundownSchema.safeParse({
          time_start, time_end, duration: computeDuration(time_start, time_end) ?? "",
          activity: str(r.values.activity), mc: str(r.values.mc), operator: str(r.values.operator),
          keterangan: str(r.values.keterangan), division_jobs, merges,
        });
        if (!v.success) report(r.line, v.error);
        return v.success ? v.data : null;
      });
      return done(() => insertRundownRows(event.id, data.filter((d) => d !== null).map((d) => ({
        time_start: d.time_start ?? "", time_end: d.time_end ?? "", duration: d.duration ?? "",
        activity: d.activity ?? "", keterangan: d.keterangan ?? "", mc: d.mc ?? "",
        operator: d.operator ?? "", division_jobs: d.division_jobs ?? {}, merges: d.merges ?? {},
      }))), "rundown");
    }
    case "jobs": {
      const data = rows.map((r) => {
        const v = jobSchema.safeParse({ pic: str(r.values.pic), job: str(r.values.job), notes: str(r.values.notes) });
        if (!v.success) report(r.line, v.error);
        return v.success && v.data.job ? v.data : null;
      });
      return done(() => insertJobs(data.filter((d) => d !== null).map((d) => ({
        event_id: event.id, job: d.job ?? "", pic: d.pic ?? "", notes: d.notes ?? "",
      }))), "jobs");
    }
    case "members": {
      const data = rows.map((r) => {
        const nrp = str(r.values.nrp);
        const v = memberSchema.safeParse({
          name: str(r.values.name),
          nickname: str(r.values.nickname),
          nrp,
          divisions: Array.isArray(r.values.divisions) ? r.values.divisions : [],
          type: (r.values.type as "fungsionaris" | "intern" | null) ?? undefined,
          year: num(r.values.year) ?? angkatanFromNrp(nrp) ?? undefined,
        });
        if (!v.success) report(r.line, v.error);
        return v.success ? v.data : null;
      });
      return done(() => insertMembers(data.filter((d) => d !== null).map((d) => ({ ...d, event_id: event.id }))), "members");
    }
    case "fgd": {
      const plans = await getFgdPlans(event.id);
      const plan = plans.find((p) => p.id === target);
      if (!plan) return { ok: false, error: "Pilih tabel FGD tujuan terlebih dahulu." };
      const data = rows.map((r) => {
        const v = fgdRowUpdateSchema.safeParse({ ours: str(r.values.ours), theirs: str(r.values.theirs) });
        if (!v.success) report(r.line, v.error);
        return v.success ? { ours: v.data.ours ?? "", theirs: v.data.theirs ?? "" } : null;
      });
      return done(() => insertFgdRows(plan.id, data.filter((d) => d !== null)), "himpunan");
    }
    case "compare": {
      const subjects = await getCompareSubjects(event.id);
      const subject = subjects.find((s) => s.id === target);
      if (!subject) return { ok: false, error: "Pilih himpunan yang dinilai terlebih dahulu." };
      const data = rows.map((r) => {
        const v = compareUpdateSchema.safeParse({
          section: str(r.values.section), no: str(r.values.no), aspect: str(r.values.aspect),
          indicator: str(r.values.indicator), plus: str(r.values.plus), minus: str(r.values.minus),
        });
        if (!v.success) report(r.line, v.error);
        return v.success
          ? {
              section: v.data.section ?? "", no: v.data.no ?? "", aspect: v.data.aspect ?? "",
              indicator: v.data.indicator ?? "", plus: v.data.plus ?? "", minus: v.data.minus ?? "",
            }
          : null;
      });
      return done(() => insertCompareEntries(subject, data.filter((d) => d !== null)), "himpunan");
    }
  }
}

function display(v: ParsedRow["values"][string], span?: number): string {
  let s = Array.isArray(v) ? v.join(", ") : v === true ? "Ya" : v === false ? "" : v === null ? "" : String(v);
  if (span && span > 1) s = `${s} [gabung ${span} baris]`;
  return s;
}

/**
 * The menu's template, built for the ACTIVE edition (its divisions become the
 * dropdown, and the rundown's columns). A server action rather than an /api
 * route on purpose: the app has none, and proxy.ts keeps it that way so the
 * first one is not born unauthenticated. Read-only: it builds a file and
 * writes nothing.
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
    const buf = await buildTemplate(spec, await importContext(event));
    return { ok: true, fileName: `${spec.fileName}.xlsx`, base64: buf.toString("base64") };
  } catch (e) {
    return errMsg(e, "Gagal membuat template.");
  }
}

/** Read the file and report what an import WOULD do. Writes nothing. */
export async function previewImportAction(fd: FormData): Promise<ImportPreview | Fail> {
  const p = await prepare(fd);
  if (!("commit" in p)) return p;
  const sorted = [...p.errors].sort((a, b) => a.line - b.line);
  return {
    ok: true,
    total: p.rows.length,
    errors: sorted.slice(0, MAX_REPORTED),
    errorCount: sorted.length,
    ignoredHeaders: p.ignoredHeaders,
    columns: p.columns,
    sample: p.rows.slice(0, PREVIEW_ROWS).map((r) => ({
      line: r.line,
      cells: p.columns.map((c) => display(r.values[c.key] ?? null, r.spans[c.key])),
    })),
  };
}

/** Import the file. All rows or none: any error refuses the whole file. */
export async function commitImportAction(fd: FormData): Promise<{ ok: true; inserted: number } | Fail> {
  const p = await prepare(fd);
  if (!("commit" in p)) return p;
  if (!p.rows.length) return { ok: false, error: "Tidak ada baris data yang bisa diimpor." };
  if (p.errors.length) {
    return { ok: false, error: `Masih ada ${p.errors.length} kesalahan di file. Perbaiki lalu unggah ulang.` };
  }
  try {
    await p.commit();
  } catch (e) {
    return errMsg(e, "Gagal mengimpor data.");
  }
  revalidateEntities(...p.entities);
  return { ok: true, inserted: p.rows.length };
}
