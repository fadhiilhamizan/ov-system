import "server-only";
import * as local from "./local";
import { createClient } from "../supabase/server";
import { prospectStage } from "../constants";
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

const USE_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
const sb = () => createClient();

// ---------------- Divisions ----------------
export async function getDivisions(): Promise<Division[]> {
  if (!USE_SUPABASE) return local.getDivisions();
  const { data } = await (await sb()).from("divisions").select("*").order("order");
  return (data ?? []) as Division[];
}
export async function getDivision(key: string): Promise<Division | null> {
  if (!USE_SUPABASE) return local.getDivision(key);
  const { data } = await (await sb()).from("divisions").select("*").eq("key", key).maybeSingle();
  return (data as Division) ?? null;
}

// ---------------- Events ----------------
export async function getEvents(): Promise<OVEvent[]> {
  if (!USE_SUPABASE) return local.getEvents();
  const { data } = await (await sb()).from("events").select("*").order("order");
  return (data ?? []) as OVEvent[];
}
export async function getEvent(id: string): Promise<OVEvent | null> {
  if (!USE_SUPABASE) return local.getEvent(id);
  const { data } = await (await sb()).from("events").select("*").eq("id", id).maybeSingle();
  return (data as OVEvent) ?? null;
}
export async function getDefaultEvent(): Promise<OVEvent> {
  if (!USE_SUPABASE) return local.getDefaultEvent();
  const events = await getEvents();
  const active = events.find((e) => e.status === "active");
  if (active) return active;
  const { data } = await (await sb()).from("tasks").select("event_id");
  const withTasks = new Set((data ?? []).map((r: { event_id: string }) => r.event_id));
  const list = events.filter((e) => withTasks.has(e.id));
  return list[list.length - 1] ?? events[events.length - 1] ?? events[0];
}

// ---------------- Members ----------------
export async function getMembers(): Promise<Member[]> {
  if (!USE_SUPABASE) return local.getMembers();
  const { data } = await (await sb()).from("members").select("*");
  return (data ?? []) as Member[];
}

// ---------------- Tasks ----------------
export interface TaskFilter {
  event_id?: string;
  division?: string;
  status?: TaskStatus;
}
export async function getTasks(filter: TaskFilter = {}): Promise<Task[]> {
  if (!USE_SUPABASE) return local.getTasks(filter);
  let q = (await sb()).from("tasks").select("*").order("created_at", { ascending: true });
  if (filter.event_id) q = q.eq("event_id", filter.event_id);
  if (filter.division) q = q.eq("division", filter.division);
  if (filter.status) q = q.eq("status", filter.status);
  const { data } = await q;
  return (data ?? []) as Task[];
}
export async function getTask(id: string): Promise<Task | null> {
  if (!USE_SUPABASE) return local.getTask(id);
  const { data } = await (await sb()).from("tasks").select("*").eq("id", id).maybeSingle();
  return (data as Task) ?? null;
}
export async function createTask(input: Partial<Task> & { event_id: string; division: Task["division"]; title: string }) {
  if (!USE_SUPABASE) return local.createTask(input);
  await (await sb()).from("tasks").insert({
    source_id: input.source_id ?? null,
    event_id: input.event_id,
    division: input.division,
    no: input.no ?? "",
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

// ---------------- Prospects ----------------
export async function getProspects(): Promise<Prospect[]> {
  if (!USE_SUPABASE) return local.getProspects();
  const { data } = await (await sb()).from("prospects").select("*");
  return (data ?? []) as Prospect[];
}
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
export async function getLinks(): Promise<LinkItem[]> {
  if (!USE_SUPABASE) return local.getLinks();
  const { data } = await (await sb()).from("links").select("*");
  return (data ?? []) as LinkItem[];
}
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
export async function getBudgetPlans(eventId?: string): Promise<BudgetPlan[]> {
  if (!USE_SUPABASE) return local.getBudgetPlans(eventId);
  const client = await sb();
  const { data: plans } = await client.from("budget_plans").select("*");
  const { data: items } = await client.from("budget_items").select("*").order("order");
  const list = (plans ?? []).map((p: { id: string; name: string; event_id: string }) => ({
    id: p.id,
    name: p.name,
    event_id: p.event_id,
    items: (items ?? [])
      .filter((i: { plan_id: string }) => i.plan_id === p.id)
      .map(
        (i: BudgetItem & { plan_id: string }): BudgetItem => ({
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
}
export async function updateBudgetItem(
  planId: string,
  index: number,
  patch: { qty?: number | null; unit_price?: number | null; name?: string },
) {
  if (!USE_SUPABASE) return local.updateBudgetItem(planId, index, patch);
  const client = await sb();
  const { data: item } = await client
    .from("budget_items")
    .select("*")
    .eq("plan_id", planId)
    .eq("order", index)
    .maybeSingle();
  if (!item) return;
  const qty = patch.qty ?? item.qty;
  const up = patch.unit_price ?? item.unit_price;
  await client
    .from("budget_items")
    .update({ ...patch, total: (qty ?? 0) * (up ?? 0) })
    .eq("id", item.id);
}

// ---------------- Rundown ----------------
export async function getRundown(eventId?: string, variant?: string): Promise<RundownItem[]> {
  if (!USE_SUPABASE) return local.getRundown(eventId, variant);
  let q = (await sb()).from("rundown").select("*").order("no");
  if (eventId) q = q.eq("event_id", eventId);
  if (variant) q = q.eq("variant", variant);
  const { data } = await q;
  return (data ?? []) as RundownItem[];
}

// ---------------- Jobs ----------------
export async function getJobs(eventId?: string): Promise<JobHariH[]> {
  if (!USE_SUPABASE) return local.getJobs(eventId);
  let q = (await sb()).from("job_harih").select("*");
  if (eventId) q = q.eq("event_id", eventId);
  const { data } = await q;
  return (data ?? []) as JobHariH[];
}

// ---------------- FAQ ----------------
export async function getFaqs(): Promise<Faq[]> {
  if (!USE_SUPABASE) return local.getFaqs();
  const { data } = await (await sb()).from("faqs").select("*").order("order");
  return (data ?? []) as Faq[];
}

// ---------------- Teams ----------------
export async function getTeams(eventId?: string): Promise<Team[]> {
  if (!USE_SUPABASE) return local.getTeams(eventId);
  let q = (await sb()).from("teams").select("*");
  if (eventId) q = q.eq("event_id", eventId);
  const { data } = await q;
  return (data ?? []) as Team[];
}

// ================= Aggregations (backend-agnostic) =================
export async function taskStats(eventId?: string) {
  const tasks = await getTasks(eventId ? { event_id: eventId } : {});
  const total = tasks.length;
  const by: Record<TaskStatus, number> = { todo: 0, ongoing: 0, done: 0, overtime: 0 };
  for (const t of tasks) by[t.status]++;
  const progress = total ? Math.round((by.done / total) * 1000) / 10 : 0;
  return { total, by, progress, tasks };
}

export async function divisionStats(eventId?: string) {
  const [tasks, divs] = await Promise.all([
    getTasks(eventId ? { event_id: eventId } : {}),
    getDivisions(),
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

export async function prospectStats() {
  const prospects = await getProspects();
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
