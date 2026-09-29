import "server-only";
import { createClient } from "../supabase/server";
import { readRows } from "./read";
import { divisionFields } from "../members";
import type {
  BudgetItem, CompareSubject, JobHariH, LinkItem, Member, Prospect, RundownItem, Task,
} from "../types";

// ============================================================
// Bulk inserts for the XLSX import (actions/import.ts).
//
// Each function is ONE insert statement for the whole file, so an import is
// atomic: Postgres either takes every row or none of them. Looping the
// single-row create functions instead would have been 300 round trips for a
// rundown and, worse, could stop halfway and leave half a file imported with
// no way to tell which half.
//
// Numbering follows the single-row paths exactly:
//   - tasks.no / job_harih.no: left null, the BEFORE INSERT triggers number
//     them. A row-level trigger sees the rows inserted before it in the same
//     statement, so a multi-row insert numbers 1, 2, 3 correctly.
//   - rundown.no / fgd_rows.order / compare_entries.order: max + 1 read once,
//     then counted up in file order.
//   - budget_items.order: sequence default.
// Rows are already validated by the action (Zod) before they reach here.
// ============================================================

const sb = () => createClient();

async function must(op: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await op;
  if (error) throw new Error(error.message);
}

/**
 * The comparable columns of what a menu already holds, for the "sudah ada"
 * check (spec.identity is applied to these by the action). Only the columns
 * the identity needs are selected, and only for the one edition or target,
 * so a preview costs one narrow read.
 */
export async function existingRows(
  module: string,
  eventId: string,
  target: string,
): Promise<Record<string, unknown>[]> {
  const client = await sb();
  const read = (label: string, q: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>) =>
    readRows<Record<string, unknown>[]>(label, q as never, []);
  switch (module) {
    case "tasks":
      return read("import tasks", client.from("tasks").select("division, title").eq("event_id", eventId));
    case "prospects":
      return read("import prospects", client.from("prospects").select("org_name, contact").eq("event_id", eventId));
    case "links":
      return read("import links", client.from("links").select("url").eq("event_id", eventId));
    case "budget":
      return target ? read("import budget", client.from("budget_items").select("category, name").eq("plan_id", target)) : [];
    case "rundown":
      return read("import rundown", client.from("rundown").select("time_start, activity").eq("event_id", eventId));
    case "jobs":
      return read("import jobs", client.from("job_harih").select("pic, job").eq("event_id", eventId));
    case "members":
      return read("import members", client.from("members").select("name").eq("event_id", eventId));
    case "fgd":
      return target ? read("import fgd", client.from("fgd_rows").select("ours, theirs").eq("plan_id", target)) : [];
    case "compare":
      return target ? read("import compare", client.from("compare_entries").select("section, aspect").eq("subject_id", target)) : [];
    default:
      return [];
  }
}

export type TaskRow =Pick<Task, "event_id" | "division" | "title"> &
  Partial<Pick<Task, "pic" | "start_date" | "end_date" | "notes" | "evaluation" | "status">>;

export async function insertTasks(rows: TaskRow[]) {
  if (!rows.length) return;
  await must((await sb()).from("tasks").insert(rows.map((r) => ({
    event_id: r.event_id,
    division: r.division,
    no: null,
    pic: r.pic ?? "",
    title: r.title,
    start_date: r.start_date ?? null,
    start_raw: "",
    end_date: r.end_date ?? null,
    end_raw: "",
    notes: r.notes ?? "",
    evaluation: r.evaluation ?? "",
    result: "",
    status: r.status ?? "todo",
  }))));
}

export async function insertProspects(rows: (Partial<Prospect> & { event_id: string })[]) {
  if (!rows.length) return;
  await must((await sb()).from("prospects").insert(rows));
}

export async function insertLinks(rows: (Partial<LinkItem> & { event_id: string; name: string; url: string })[]) {
  if (!rows.length) return;
  await must((await sb()).from("links").insert(rows.map((r) => ({ ...r, source: "manual" }))));
}

export async function insertBudgetItems(
  planId: string,
  rows: Pick<BudgetItem, "category" | "name" | "qty" | "unit" | "unit_price" | "category_color">[],
) {
  if (!rows.length) return;
  const client = await sb();
  await must(client.from("budget_items").insert(rows.map((r) => ({
    plan_id: planId,
    category: r.category || "LAIN-LAIN",
    name: r.name,
    qty: r.qty ?? null,
    unit: r.unit ?? "",
    unit_price: r.unit_price ?? null,
    total: Math.round((r.qty ?? 0) * (r.unit_price ?? 0)),
    category_color: r.category_color ?? null,
  }))));
  // The dot colour belongs to the CATEGORY (see setCategoryColor): apply the
  // file's colour to the rows that were already in that category too.
  const colours = new Map<string, string>();
  for (const r of rows) if (r.category_color) colours.set(r.category || "LAIN-LAIN", r.category_color);
  for (const [category, color] of colours) {
    await must(
      client.from("budget_items").update({ category_color: color }).eq("plan_id", planId).eq("category", category),
    );
  }
}

export async function insertRundownRows(
  eventId: string,
  rows: Omit<RundownItem, "id" | "event_id" | "variant" | "no">[],
) {
  if (!rows.length) return;
  const client = await sb();
  const last = await readRows<{ no: number } | null>(
    "rundown last no",
    client.from("rundown").select("no").eq("event_id", eventId).eq("variant", "A")
      .order("no", { ascending: false }).limit(1).maybeSingle(),
    null,
  );
  const base = (last?.no ?? 0) + 1;
  await must(client.from("rundown").insert(rows.map((r, i) => ({
    event_id: eventId,
    variant: "A",
    no: base + i,
    time_start: r.time_start,
    time_end: r.time_end,
    duration: r.duration,
    activity: r.activity,
    keterangan: r.keterangan,
    mc: r.mc,
    operator: r.operator,
    division_jobs: r.division_jobs,
    merges: r.merges ?? {},
  }))));
}

export async function insertJobs(rows: (Pick<JobHariH, "event_id" | "job"> & Partial<JobHariH>)[]) {
  if (!rows.length) return;
  await must((await sb()).from("job_harih").insert(rows.map((r) => ({
    event_id: r.event_id,
    no: null,
    pic: r.pic ?? "",
    job: r.job,
    notes: r.notes ?? "",
  }))));
}

export async function insertMembers(rows: (Partial<Member> & { event_id: string; name: string; divisions: string[] })[]) {
  if (!rows.length) return;
  await must((await sb()).from("members").insert(rows.map((r) => {
    const div = divisionFields(r.divisions, r.division);
    return {
      event_id: r.event_id,
      name: r.name,
      nickname: r.nickname ?? "",
      nrp: r.nrp ?? "",
      type: r.type ?? "fungsionaris",
      year: r.year ?? new Date().getFullYear(),
      division: div.division,
      divisions: div.divisions,
    };
  })));
}

export async function insertFgdRows(planId: string, rows: { ours: string; theirs: string }[]) {
  if (!rows.length) return;
  const client = await sb();
  const existing = await readRows<{ order: number }[]>(
    "fgd row order", client.from("fgd_rows").select("order").eq("plan_id", planId), [],
  );
  const base = Math.max(0, ...existing.map((r) => r.order + 1));
  await must(client.from("fgd_rows").insert(rows.map((r, i) => ({
    plan_id: planId, ours: r.ours, theirs: r.theirs, order: base + i,
  }))));
}

export async function insertCompareEntries(
  subject: CompareSubject,
  rows: { section: string; no: string; aspect: string; indicator: string; plus: string; minus: string }[],
) {
  if (!rows.length) return;
  const client = await sb();
  const existing = await readRows<{ order: number }[]>(
    "compare entry order", client.from("compare_entries").select("order").eq("subject_id", subject.id), [],
  );
  const base = Math.max(0, ...existing.map((r) => r.order + 1));
  await must(client.from("compare_entries").insert(rows.map((r, i) => ({
    ...r,
    event_id: subject.event_id,
    subject_id: subject.id,
    prospect_id: subject.prospect_id,
    org_name: subject.org_name,
    order: base + i,
  }))));
}
