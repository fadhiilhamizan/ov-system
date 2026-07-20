import "server-only";
import { cache } from "react";
import * as local from "./local";
import { createClient } from "../supabase/server";
import { prospectStage } from "../constants";
import { uid } from "../utils";
import type {
  BudgetItem,
  BudgetPlan,
  Division,
  Faq,
  JobHariH,
  LinkItem,
  Member,
  OVEvent,
  Prospect,
  RundownItem,
  Task,
  TaskStatus,
  Team,
} from "../types";

// ------------------------------------------------------------------
// Backend-agnostic repository. Uses Supabase when configured, otherwise
// the local JSON store (demo mode). All functions are async.
// ------------------------------------------------------------------

// Supabase-backed when EITHER production or a demo project is configured. The
// per-request client (supabase/server.ts) then routes to demo vs production.
const USE_SUPABASE =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL;
const sb = () => createClient();

/** Supabase returns NULL for empty text columns; coerce to "" so the UI
 *  (which calls .trim()/.toLowerCase()/.split()) never crashes. */
function coalesce<T>(rows: T[], keys: string[]): T[] {
  return rows.map((r) => {
    const o = { ...(r as Record<string, unknown>) };
    for (const k of keys) if (o[k] == null) o[k] = "";
    return o as T;
  });
}

// NOTE: read getters are wrapped in React cache() so repeated calls within a
// single request (e.g. layout + page both need events/divisions) hit Supabase
// only once. Cache is keyed by primitive args.

// ---------------- Divisions ----------------
// Divisions are per-Ormawa-Visit. In Supabase mode this is a STRICT match on
// event_id (filtered in-query) so a row can never leak across OVs — after
// migration 0018 every division has an event_id. (The local/demo JSON store
// keeps a lenient match so its global seed still renders without a migration.)
export const getDivisions = cache(async (eventId?: string): Promise<Division[]> => {
  if (!USE_SUPABASE) return local.getDivisions(eventId);
  let q = (await sb()).from("divisions").select("*").order("order");
  if (eventId) q = q.eq("event_id", eventId);
  const { data } = await q;
  return (data ?? []) as Division[];
});
export const getDivision = cache(async (eventId: string, key: string): Promise<Division | null> => {
  if (!USE_SUPABASE) return local.getDivision(eventId, key);
  const list = await getDivisions(eventId);
  return list.find((d) => d.key === key) ?? null;
});

// ---------------- Events ----------------
export const getEvents = cache(async (): Promise<OVEvent[]> => {
  if (!USE_SUPABASE) return local.getEvents();
  const { data } = await (await sb()).from("events").select("*").order("order");
  return (data ?? []) as OVEvent[];
});
export const getEvent = cache(async (id: string): Promise<OVEvent | null> => {
  if (!USE_SUPABASE) return local.getEvent(id);
  const { data } = await (await sb()).from("events").select("*").eq("id", id).maybeSingle();
  return (data as OVEvent) ?? null;
});
export const getDefaultEvent = cache(async (): Promise<OVEvent> => {
  if (!USE_SUPABASE) return local.getDefaultEvent();
  const events = await getEvents();
  const active = events.find((e) => e.status === "active");
  if (active) return active;
  const { data } = await (await sb()).from("tasks").select("event_id");
  const withTasks = new Set((data ?? []).map((r: { event_id: string }) => r.event_id));
  const list = events.filter((e) => withTasks.has(e.id));
  return list[list.length - 1] ?? events[events.length - 1] ?? events[0];
});

// ---------------- Members ----------------
export const getMembers = cache(async (eventId?: string): Promise<Member[]> => {
  if (!USE_SUPABASE) return local.getMembers(eventId);
  const { data } = await (await sb()).from("members").select("*");
  const list = coalesce((data ?? []) as Member[], ["name", "nickname", "nrp"]);
  return eventId ? list.filter((m) => !m.event_id || m.event_id === eventId) : list;
});

// ---------------- Tasks ----------------
export interface TaskFilter {
  event_id?: string;
  division?: string;
  status?: TaskStatus;
}
export const getTasks = cache(async (filter: TaskFilter = {}): Promise<Task[]> => {
  if (!USE_SUPABASE) return local.getTasks(filter);
  let q = (await sb()).from("tasks").select("*").order("created_at", { ascending: true });
  if (filter.event_id) q = q.eq("event_id", filter.event_id);
  if (filter.division) q = q.eq("division", filter.division);
  if (filter.status) q = q.eq("status", filter.status);
  const { data } = await q;
  return coalesce((data ?? []) as Task[], [
    "no", "pic", "start_raw", "end_raw", "notes", "result", "division",
  ]);
});
export const getTask = cache(async (id: string): Promise<Task | null> => {
  if (!USE_SUPABASE) return local.getTask(id);
  const { data } = await (await sb()).from("tasks").select("*").eq("id", id).maybeSingle();
  return (data as Task) ?? null;
});
export async function createTask(input: Partial<Task> & { event_id: string; division: Task["division"]; title: string }) {
  if (!USE_SUPABASE) return local.createTask(input);
  const client = await sb();
  // Auto-number: `no` is assigned atomically by the assign_task_no() BEFORE-INSERT
  // trigger (advisory-locked per event+division) when left null, so concurrent
  // creates can't collide. An explicit `no` (manual/clone) is preserved.
  await client.from("tasks").insert({
    event_id: input.event_id,
    division: input.division,
    no: input.no ?? null,
    pic: input.pic ?? "",
    title: input.title,
    start_date: input.start_date ?? null,
    start_raw: input.start_raw ?? "",
    end_date: input.end_date ?? null,
    end_raw: input.end_raw ?? "",
    notes: input.notes ?? "",
    result: input.result ?? "",
    status: input.status ?? "todo",
  });
}
export async function updateTask(id: string, patch: Partial<Task>) {
  if (!USE_SUPABASE) return local.updateTask(id, patch);
  await (await sb()).from("tasks").update(patch).eq("id", id);
}
export async function deleteTask(id: string) {
  if (!USE_SUPABASE) return local.deleteTask(id);
  await (await sb()).from("tasks").delete().eq("id", id);
}
export async function bulkUpdateTasks(ids: string[], patch: Partial<Task>) {
  if (!ids.length) return;
  if (!USE_SUPABASE) {
    for (const id of ids) local.updateTask(id, patch);
    return;
  }
  await (await sb()).from("tasks").update(patch).in("id", ids);
}
export async function bulkDeleteTasks(ids: string[]) {
  if (!ids.length) return;
  if (!USE_SUPABASE) {
    for (const id of ids) local.deleteTask(id);
    return;
  }
  await (await sb()).from("tasks").delete().in("id", ids);
}

// ---------------- Prospects ----------------
export const getProspects = cache(async (eventId?: string): Promise<Prospect[]> => {
  if (!USE_SUPABASE) return local.getProspects(eventId);
  const { data } = await (await sb()).from("prospects").select("*");
  const list = coalesce((data ?? []) as Prospect[], [
    "batch", "no", "date_text", "month", "contact", "org_name", "campus",
    "location", "pic", "contact_status", "their_response", "our_response", "source",
  ]);
  return eventId ? list.filter((p) => !p.event_id || p.event_id === eventId) : list;
});
export async function createProspect(input: Partial<Prospect>) {
  if (!USE_SUPABASE) return local.createProspect(input);
  await (await sb()).from("prospects").insert(stripId(input));
}
export async function updateProspect(id: string, patch: Partial<Prospect>) {
  if (!USE_SUPABASE) return local.updateProspect(id, patch);
  await (await sb()).from("prospects").update(stripId(patch)).eq("id", id);
}
export async function deleteProspect(id: string) {
  if (!USE_SUPABASE) return local.deleteProspect(id);
  await (await sb()).from("prospects").delete().eq("id", id);
}

// ---------------- Links ----------------
export const getLinks = cache(async (eventId?: string): Promise<LinkItem[]> => {
  if (!USE_SUPABASE) return local.getLinks(eventId);
  const { data } = await (await sb()).from("links").select("*");
  const list = coalesce((data ?? []) as LinkItem[], ["section", "division", "name", "url", "note", "source"]);
  return eventId ? list.filter((l) => !l.event_id || l.event_id === eventId) : list;
});
export async function createLink(input: Partial<LinkItem>) {
  if (!USE_SUPABASE) return local.createLink(input);
  await (await sb()).from("links").insert(stripId(input));
}
export async function updateLink(id: string, patch: Partial<LinkItem>) {
  if (!USE_SUPABASE) return local.updateLink(id, patch);
  await (await sb()).from("links").update(stripId(patch)).eq("id", id);
}
export async function deleteLink(id: string) {
  if (!USE_SUPABASE) return local.deleteLink(id);
  await (await sb()).from("links").delete().eq("id", id);
}

// ---------------- Budget ----------------
export const getBudgetPlans = cache(async (eventId?: string): Promise<BudgetPlan[]> => {
  if (!USE_SUPABASE) return local.getBudgetPlans(eventId);
  const client = await sb();
  // Filter plans at the DB (not in JS) so a single-event lookup doesn't scan
  // every event's budget, then fetch only those plans' items.
  let pq = client.from("budget_plans").select("*");
  if (eventId) pq = pq.eq("event_id", eventId);
  const { data: plans } = await pq;
  const planIds = (plans ?? []).map((p: { id: string }) => p.id);
  const { data: items } = planIds.length
    ? await client.from("budget_items").select("*").in("plan_id", planIds).order("order")
    : { data: [] as (BudgetItem & { plan_id: string })[] };
  const list = (plans ?? []).map((p: { id: string; name: string; event_id: string }) => ({
    id: p.id,
    name: p.name,
    event_id: p.event_id,
    items: (items ?? [])
      .filter((i: { plan_id: string }) => i.plan_id === p.id)
      .map(
        (i: BudgetItem & { plan_id: string }): BudgetItem => ({
          id: i.id,
          category: i.category,
          no: i.no,
          name: i.name,
          qty: i.qty,
          unit: i.unit,
          unit_price: i.unit_price,
          total: i.total,
        }),
      ),
  }));
  return eventId ? list.filter((b) => b.event_id === eventId) : list;
});
export async function updateBudgetItem(
  itemId: string,
  patch: { qty?: number | null; unit_price?: number | null; name?: string; category?: string; unit?: string },
) {
  if (!USE_SUPABASE) return local.updateBudgetItem(itemId, patch);
  const client = await sb();
  const { data: item } = await client.from("budget_items").select("*").eq("id", itemId).maybeSingle();
  if (!item) return;
  const qty = patch.qty ?? item.qty;
  const up = patch.unit_price ?? item.unit_price;
  await client
    .from("budget_items")
    .update({ ...patch, total: Math.round((qty ?? 0) * (up ?? 0)) })
    .eq("id", itemId);
}
export async function createBudgetItem(
  planId: string,
  input: { category: string; name: string; qty?: number | null; unit?: string; unit_price?: number | null },
) {
  if (!USE_SUPABASE) return local.createBudgetItem(planId, input);
  const client = await sb();
  const { data: maxRow } = await client
    .from("budget_items")
    .select("order")
    .eq("plan_id", planId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const total = Math.round((input.qty ?? 0) * (input.unit_price ?? 0));
  await client.from("budget_items").insert({
    plan_id: planId,
    category: input.category || "LAIN-LAIN",
    name: input.name,
    qty: input.qty ?? null,
    unit: input.unit ?? "",
    unit_price: input.unit_price ?? null,
    total,
    order: (maxRow?.order ?? 0) + 1,
  });
}
export async function deleteBudgetItem(itemId: string) {
  if (!USE_SUPABASE) return local.deleteBudgetItem(itemId);
  await (await sb()).from("budget_items").delete().eq("id", itemId);
}
export async function createBudgetPlan(input: { name: string; event_id: string }) {
  if (!USE_SUPABASE) return local.createBudgetPlan(input);
  await (await sb()).from("budget_plans").insert({ name: input.name, event_id: input.event_id });
}
export async function deleteBudgetPlan(id: string) {
  if (!USE_SUPABASE) return local.deleteBudgetPlan(id);
  await (await sb()).from("budget_plans").delete().eq("id", id);
}

// ---------------- Rundown ----------------
export const getRundown = cache(async (eventId?: string, variant?: string): Promise<RundownItem[]> => {
  if (!USE_SUPABASE) return local.getRundown(eventId, variant);
  let q = (await sb()).from("rundown").select("*").order("no");
  if (eventId) q = q.eq("event_id", eventId);
  if (variant) q = q.eq("variant", variant);
  const { data } = await q;
  const rows = coalesce((data ?? []) as RundownItem[], [
    "variant", "time_start", "time_end", "duration", "activity", "keterangan", "mc", "operator",
    "host", "opr_link", "job_lo", "job_event", "job_consump", "job_creative", "job_opr",
  ]);
  // division_jobs is jsonb — ensure it's always a plain object.
  return rows.map((r) => ({
    ...r,
    division_jobs: r.division_jobs && typeof r.division_jobs === "object" ? r.division_jobs : {},
  }));
});

// ---------------- Jobs ----------------
export const getJobs = cache(async (eventId?: string): Promise<JobHariH[]> => {
  if (!USE_SUPABASE) return local.getJobs(eventId);
  let q = (await sb()).from("job_harih").select("*");
  if (eventId) q = q.eq("event_id", eventId);
  const { data } = await q;
  return coalesce((data ?? []) as JobHariH[], ["no", "pic", "job", "notes"]);
});

// ---------------- FAQ ----------------
export const getFaqs = cache(async (): Promise<Faq[]> => {
  if (!USE_SUPABASE) return local.getFaqs();
  const { data } = await (await sb()).from("faqs").select("*").order("order");
  return (data ?? []) as Faq[];
});
export async function createFaq(input: { question: string; answer: string }) {
  if (!USE_SUPABASE) return local.createFaq(input);
  const client = await sb();
  const { data: maxRow } = await client
    .from("faqs")
    .select("order")
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  await client.from("faqs").insert({
    question: input.question,
    answer: input.answer,
    order: (maxRow?.order ?? 0) + 1,
  });
}
export async function updateFaq(id: string, patch: { question?: string; answer?: string }) {
  if (!USE_SUPABASE) return local.updateFaq(id, patch);
  await (await sb()).from("faqs").update(patch).eq("id", id);
}
export async function deleteFaq(id: string) {
  if (!USE_SUPABASE) return local.deleteFaq(id);
  await (await sb()).from("faqs").delete().eq("id", id);
}

// ---------------- Teams ----------------
export const getTeams = cache(async (eventId?: string): Promise<Team[]> => {
  if (!USE_SUPABASE) return local.getTeams(eventId);
  let q = (await sb()).from("teams").select("*");
  if (eventId) q = q.eq("event_id", eventId);
  const { data } = await q;
  return coalesce((data ?? []) as Team[], ["division", "fungsionaris", "intern"]);
});

// ================= Aggregations (backend-agnostic) =================
/** Cached per-event task fetch so taskStats + divisionStats (dashboard) share one query. */
const getEventTasks = cache(async (eventId: string): Promise<Task[]> => getTasks({ event_id: eventId }));

export async function taskStats(eventId?: string) {
  const tasks = eventId ? await getEventTasks(eventId) : await getTasks({});
  const total = tasks.length;
  const by: Record<TaskStatus, number> = { todo: 0, ongoing: 0, done: 0, overtime: 0 };
  for (const t of tasks) by[t.status]++;
  const progress = total ? Math.round((by.done / total) * 1000) / 10 : 0;
  return { total, by, progress, tasks };
}

export async function divisionStats(eventId?: string) {
  const [tasks, divs] = await Promise.all([
    eventId ? getEventTasks(eventId) : getTasks({}),
    getDivisions(eventId),
  ]);
  return divs
    .map((d) => {
      const dt = tasks.filter((t) => t.division === d.key);
      const done = dt.filter((t) => t.status === "done").length;
      return {
        division: d,
        total: dt.length,
        done,
        ongoing: dt.filter((t) => t.status === "ongoing").length,
        todo: dt.filter((t) => t.status === "todo").length,
        overtime: dt.filter((t) => t.status === "overtime").length,
        progress: dt.length ? Math.round((done / dt.length) * 100) : 0,
      };
    })
    .filter((x) => x.total > 0);
}

export async function prospectStats(eventId?: string) {
  const prospects = await getProspects(eventId);
  const stages: Record<string, number> = {};
  for (const p of prospects) {
    const s = prospectStage(p);
    stages[s] = (stages[s] ?? 0) + 1;
  }
  return { total: prospects.length, stages, prospects };
}

export async function budgetTotal(eventId?: string) {
  const plans = await getBudgetPlans(eventId);
  return plans.reduce((sum, p) => sum + p.items.reduce((s, i) => s + (i.total ?? 0), 0), 0);
}

// helper: drop client-only id before insert/update
function stripId<T extends { id?: string }>(obj: T) {
  const { id, ...rest } = obj;
  void id;
  return rest;
}

// ================= CRUD: events / members / divisions / teams =================
export async function createEvent(input: Partial<OVEvent>) {
  if (!USE_SUPABASE) return local.createEvent(input);
  const client = await sb();
  const id = input.id ?? uid("ov");
  const { data: maxRow } = await client
    .from("events")
    .select("order")
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const order = input.order ?? (maxRow?.order ?? 0) + 1;
  await client.from("events").insert({
    id,
    code: input.code ?? "",
    title: input.title ?? "Ormawa Visit Baru",
    partner: input.partner ?? "",
    campus: input.campus ?? "",
    type: input.type ?? "external",
    mode: input.mode ?? "offline",
    cabinet: input.cabinet ?? "",
    event_date: input.event_date ?? null,
    plan_start: input.plan_start ?? null,
    plan_end: input.plan_end ?? null,
    location: input.location ?? "",
    status: input.status ?? "planning",
    order,
  });
}
export async function updateEvent(id: string, patch: Partial<OVEvent>) {
  if (!USE_SUPABASE) return local.updateEvent(id, patch);
  const { id: _drop, ...rest } = patch;
  void _drop;
  await (await sb()).from("events").update(rest).eq("id", id);
}
export async function deleteEvent(id: string) {
  if (!USE_SUPABASE) return local.deleteEvent(id);
  await (await sb()).from("events").delete().eq("id", id);
}

export interface CloneOptions {
  divisions?: boolean;
  members?: boolean;
  tasks?: boolean;
  rundown?: boolean;
  jobs?: boolean;
  budget?: boolean;
}

/**
 * Copy data from one Ormawa Visit to another, as a starting template for a new
 * edition. Tasks & jobs are copied as a fresh skeleton (status reset, PIC and
 * dates cleared) so only reusable content (division, job description, notes,
 * rundown structure, budget estimate) carries over.
 */
export async function cloneEventData(sourceId: string, targetId: string, opts: CloneOptions) {
  if (!USE_SUPABASE) return local.cloneEventData(sourceId, targetId, opts);
  const client = await sb();

  // Divisions first (tasks/rundown/teams resolve their division by key within
  // the new event, so the keys must exist there before the rest is copied).
  if (opts.divisions) {
    const src = await getDivisions(sourceId);
    const rows = src.map((d) => ({
      event_id: targetId, key: d.key, name: d.name, short: d.short, color: d.color,
      order: d.order, exclude_from_rundown: d.exclude_from_rundown ?? false,
    }));
    if (rows.length) await client.from("divisions").insert(rows);
  }

  if (opts.members) {
    const src = await getMembers(sourceId);
    const rows = src.map((m) => ({
      event_id: targetId, name: m.name, nickname: m.nickname, nrp: m.nrp,
      type: m.type, year: m.year, division: m.division ?? null,
    }));
    if (rows.length) await client.from("members").insert(rows);
  }

  if (opts.tasks) {
    const src = await getTasks({ event_id: sourceId });
    const noByDiv: Record<string, number> = {};
    const rows = src.map((t) => {
      noByDiv[t.division] = (noByDiv[t.division] ?? 0) + 1;
      return {
        event_id: targetId, division: t.division, no: String(noByDiv[t.division]),
        pic: "", title: t.title, start_date: null, start_raw: "", end_date: null, end_raw: "",
        notes: t.notes, result: "", status: "todo" as TaskStatus,
      };
    });
    if (rows.length) await client.from("tasks").insert(rows);
  }

  if (opts.rundown) {
    const src = await getRundown(sourceId);
    const rows = src.map((r) => ({
      event_id: targetId, variant: r.variant, no: r.no, time_start: r.time_start, time_end: r.time_end,
      duration: r.duration, activity: r.activity, keterangan: r.keterangan, host: r.host, opr_link: r.opr_link,
      mc: r.mc, job_lo: r.job_lo, job_event: r.job_event, job_consump: r.job_consump, job_creative: r.job_creative, job_opr: r.job_opr,
    }));
    if (rows.length) await client.from("rundown").insert(rows);
  }

  if (opts.jobs) {
    const src = await getJobs(sourceId);
    const rows = src.map((j) => ({ event_id: targetId, no: j.no, pic: "", job: j.job, notes: j.notes }));
    if (rows.length) await client.from("job_harih").insert(rows);
  }

  if (opts.budget) {
    const plans = await getBudgetPlans(sourceId);
    for (const plan of plans) {
      const { data: created } = await client
        .from("budget_plans")
        .insert({ name: plan.name, event_id: targetId })
        .select("id")
        .single();
      if (created && plan.items.length)
        await client.from("budget_items").insert(
          plan.items.map((i, idx) => ({
            plan_id: created.id, category: i.category, no: i.no, name: i.name,
            qty: i.qty, unit: i.unit, unit_price: i.unit_price, total: i.total, order: idx,
          })),
        );
    }
  }
}

export async function createMember(input: Partial<Member>) {
  if (!USE_SUPABASE) return local.createMember(input);
  await (await sb()).from("members").insert({
    event_id: input.event_id ?? null,
    name: input.name ?? "",
    nickname: input.nickname ?? "",
    nrp: input.nrp ?? "",
    type: input.type ?? "fungsionaris",
    year: input.year ?? new Date().getFullYear(),
    division: input.division ?? null,
  });
}
export async function updateMember(id: string, patch: Partial<Member>) {
  if (!USE_SUPABASE) return local.updateMember(id, patch);
  const { id: _drop, ...rest } = patch;
  void _drop;
  await (await sb()).from("members").update(rest).eq("id", id);
}
export async function deleteMember(id: string) {
  if (!USE_SUPABASE) return local.deleteMember(id);
  await (await sb()).from("members").delete().eq("id", id);
}
export async function bulkDeleteMembers(ids: string[]) {
  if (!ids.length) return;
  if (!USE_SUPABASE) {
    for (const id of ids) local.deleteMember(id);
    return;
  }
  await (await sb()).from("members").delete().in("id", ids);
}
export async function bulkUpdateMembers(ids: string[], patch: Partial<Member>) {
  if (!ids.length) return;
  if (!USE_SUPABASE) {
    for (const id of ids) local.updateMember(id, patch);
    return;
  }
  const { id: _drop, ...rest } = patch;
  void _drop;
  await (await sb()).from("members").update(rest).in("id", ids);
}

export async function createDivision(input: Partial<Division>) {
  if (!USE_SUPABASE) return local.createDivision(input);
  const client = await sb();
  // Order is per-event so each Ormawa Visit numbers its own divisions from 1.
  let mq = client.from("divisions").select("order").order("order", { ascending: false }).limit(1);
  if (input.event_id) mq = mq.eq("event_id", input.event_id);
  const { data: maxRow } = await mq.maybeSingle();
  await client.from("divisions").insert({
    event_id: input.event_id ?? null,
    key: input.key ?? uid("DIV").toUpperCase(),
    name: input.name ?? "",
    short: input.short ?? "",
    color: input.color ?? "#6366f1",
    order: input.order ?? (maxRow?.order ?? 0) + 1,
    exclude_from_rundown: input.exclude_from_rundown ?? false,
  });
}
export async function updateDivision(eventId: string, key: string, patch: Partial<Division>) {
  if (!USE_SUPABASE) return local.updateDivision(eventId, key, patch);
  const { id: _i, event_id: _e, ...rest } = patch;
  void _i; void _e;
  await (await sb()).from("divisions").update(rest).eq("event_id", eventId).eq("key", key);
}
export async function deleteDivision(eventId: string, key: string) {
  if (!USE_SUPABASE) return local.deleteDivision(eventId, key);
  await (await sb()).from("divisions").delete().eq("event_id", eventId).eq("key", key);
}

export async function createTeam(input: Partial<Team>) {
  if (!USE_SUPABASE) return local.createTeam(input);
  await (await sb()).from("teams").insert({
    event_id: input.event_id ?? null,
    division: input.division ?? "EVENT",
    fungsionaris: input.fungsionaris ?? "",
    intern: input.intern ?? "",
  });
}
export async function updateTeam(id: string, patch: Partial<Team>) {
  if (!USE_SUPABASE) return local.updateTeam(id, patch);
  const { id: _drop, ...rest } = patch;
  void _drop;
  await (await sb()).from("teams").update(rest).eq("id", id);
}
export async function deleteTeam(id: string) {
  if (!USE_SUPABASE) return local.deleteTeam(id);
  await (await sb()).from("teams").delete().eq("id", id);
}

// ================= CRUD: rundown / jobs =================
export async function createRundown(input: Partial<RundownItem>) {
  if (!USE_SUPABASE) return local.createRundown(input);
  const client = await sb();
  const { data: maxRow } = await client
    .from("rundown")
    .select("no")
    .eq("event_id", input.event_id ?? "")
    .eq("variant", input.variant ?? "A")
    .order("no", { ascending: false })
    .limit(1)
    .maybeSingle();
  await client.from("rundown").insert({
    event_id: input.event_id ?? null,
    variant: input.variant ?? "A",
    no: input.no ?? (maxRow?.no ?? 0) + 1,
    time_start: input.time_start ?? "",
    time_end: input.time_end ?? "",
    duration: input.duration ?? "",
    activity: input.activity ?? "",
    keterangan: input.keterangan ?? "",
    mc: input.mc ?? "",
    operator: input.operator ?? "",
    division_jobs: input.division_jobs ?? {},
  });
}
export async function updateRundown(id: string, patch: Partial<RundownItem>) {
  if (!USE_SUPABASE) return local.updateRundown(id, patch);
  const { id: _d, ...rest } = patch;
  void _d;
  await (await sb()).from("rundown").update(rest).eq("id", id);
}
export async function deleteRundown(id: string) {
  if (!USE_SUPABASE) return local.deleteRundown(id);
  await (await sb()).from("rundown").delete().eq("id", id);
}

export async function createJob(input: Partial<JobHariH>) {
  if (!USE_SUPABASE) return local.createJob(input);
  const client = await sb();
  // `no` assigned atomically by the assign_job_no() BEFORE-INSERT trigger
  // (advisory-locked per event) when null; an explicit `no` is preserved.
  await client.from("job_harih").insert({
    event_id: input.event_id ?? null,
    no: input.no ?? null,
    pic: input.pic ?? "",
    job: input.job ?? "",
    notes: input.notes ?? "",
  });
}
export async function updateJob(id: string, patch: Partial<JobHariH>) {
  if (!USE_SUPABASE) return local.updateJob(id, patch);
  const { id: _d, ...rest } = patch;
  void _d;
  await (await sb()).from("job_harih").update(rest).eq("id", id);
}
export async function deleteJob(id: string) {
  if (!USE_SUPABASE) return local.deleteJob(id);
  await (await sb()).from("job_harih").delete().eq("id", id);
}
