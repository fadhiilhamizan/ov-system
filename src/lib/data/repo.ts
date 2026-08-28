import "server-only";
import { cache } from "react";
import * as local from "./local";
import { createClient } from "../supabase/server";
import { prospectStage } from "../constants";
import { effectiveStatus } from "../format";
import { divisionFields, memberInDivision } from "../members";
import { uid } from "../utils";
import type {
  BudgetItem,
  CloneModule,
  CloneSources,
  BudgetPlan,
  Division,
  Faq,
  JobHariH,
  LinkItem,
  Member,
  OVEvent,
  Prospect,
  ProspectLink,
  ProspectLinkInput,
  RoleRequest,
  RundownItem,
  Task,
  TaskLink,
  TaskLinkInput,
  TaskRef,
  TaskRefInput,
  TaskStatus,
  Team,
} from "../types";
import { CLONE_MODULES } from "../types";
import type { CloneFilters } from "../types";

// ------------------------------------------------------------------
// Backend-agnostic repository. Uses Supabase when configured, otherwise
// the local JSON store (demo mode). All functions are async.
// ------------------------------------------------------------------

// Supabase-backed when EITHER production or a demo project is configured. The
// per-request client (supabase/server.ts) then routes to demo vs production.
const USE_SUPABASE =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL;
const sb = () => createClient();

/** A task past its deadline and not yet done is automatically "overtime".
 *  Derived at read time so it's always up to date without a cron job; the
 *  stored status is only a floor (todo/ongoing get promoted, done is left). */
function withOvertime(t: Task): Task {
  const eff = effectiveStatus(t.status, t.end_date);
  return eff === t.status ? t : { ...t, status: eff as TaskStatus };
}

/**
 * Every WRITE must go through this.
 *
 * A Supabase error on a write means the row did NOT change â€” almost always an
 * RLS denial or a missing column. Swallowing it is exactly how "the button does
 * nothing" bugs are born: the optimistic UI keeps the new value, the toast says
 * saved, and the data is gone on the next load. Throw, and let the Server Action
 * turn it into a visible error.
 */
async function must<T>(op: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await op;
  if (error) throw new Error(error.message);
  return data;
}

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
// event_id (filtered in-query) so a row can never leak across OVs â€” after
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
/** Placeholder so a genuinely empty (or RLS-blocked) events table degrades to
 *  an empty-state UI instead of crashing on `event.id`. */
const EMPTY_EVENT: OVEvent = {
  id: "", code: "", title: "Belum ada Ormawa Visit", partner: "", campus: "",
  type: "internal", mode: "offline", cabinet: "", event_date: null,
  location: "", status: "planning", order: 0,
};

export const getDefaultEvent = cache(async (): Promise<OVEvent> => {
  if (!USE_SUPABASE) return local.getDefaultEvent() ?? EMPTY_EVENT;
  const events = await getEvents();
  const active = events.find((e) => e.status === "active");
  if (active) return active;
  const { data } = await (await sb()).from("tasks").select("event_id");
  const withTasks = new Set((data ?? []).map((r: { event_id: string }) => r.event_id));
  const list = events.filter((e) => withTasks.has(e.id));
  return list[list.length - 1] ?? events[events.length - 1] ?? events[0] ?? EMPTY_EVENT;
});

// ---------------- Members ----------------
export const getMembers = cache(async (eventId?: string): Promise<Member[]> => {
  if (!USE_SUPABASE) return local.getMembers(eventId);
  const { data } = await (await sb()).from("members").select("*");
  // `divisions` is a text[] and comes back null on legacy rows â€” normalise it so
  // callers never have to null-check the array (see lib/members.ts).
  const list = coalesce((data ?? []) as Member[], ["name", "nickname", "nrp"]).map((m) => ({
    ...m,
    divisions: m.divisions ?? (m.division ? [m.division] : []),
  }));
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
  const rows = coalesce((data ?? []) as Task[], [
    "no", "pic", "start_raw", "end_raw", "notes", "result", "division",
  ]);
  return rows.map(withOvertime);
});
export const getTask = cache(async (id: string): Promise<Task | null> => {
  if (!USE_SUPABASE) return local.getTask(id);
  const { data } = await (await sb()).from("tasks").select("*").eq("id", id).maybeSingle();
  return data ? withOvertime(data as Task) : null;
});
export async function createTask(
  input: Partial<Task> & { event_id: string; division: Task["division"]; title: string },
): Promise<string | null> {
  if (!USE_SUPABASE) return local.createTask(input).id;
  const client = await sb();
  // Auto-number: `no` is assigned atomically by the assign_task_no() BEFORE-INSERT
  // trigger (advisory-locked per event+division) when left null, so concurrent
  // creates can't collide. An explicit `no` (manual/clone) is preserved.
  const data = await must(client.from("tasks").insert({
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
  }).select("id").single());
  return (data as { id: string } | null)?.id ?? null;
}
export async function updateTask(id: string, patch: Partial<Task>) {
  if (!USE_SUPABASE) return local.updateTask(id, patch);
  await must((await sb()).from("tasks").update(patch).eq("id", id));
}
export async function deleteTask(id: string) {
  if (!USE_SUPABASE) return local.deleteTask(id);
  await must((await sb()).from("tasks").delete().eq("id", id));
}
export async function bulkUpdateTasks(ids: string[], patch: Partial<Task>) {
  if (!ids.length) return;
  if (!USE_SUPABASE) {
    for (const id of ids) local.updateTask(id, patch);
    return;
  }
  await must((await sb()).from("tasks").update(patch).in("id", ids));
}
export async function bulkDeleteTasks(ids: string[]) {
  if (!ids.length) return;
  if (!USE_SUPABASE) {
    for (const id of ids) local.deleteTask(id);
    return;
  }
  await must((await sb()).from("tasks").delete().in("id", ids));
}

// ---------------- Task result links ----------------
export const getTaskLinks = cache(async (taskId: string): Promise<TaskLink[]> => {
  if (!USE_SUPABASE) return local.getTaskLinks(taskId);
  const { data } = await (await sb()).from("task_links").select("*").eq("task_id", taskId).order("order");
  return coalesce((data ?? []) as TaskLink[], ["url", "label"]);
});

/** All result links for an event's tasks, keyed by task id (one round trip). */
export const getTaskLinksByEvent = cache(async (eventId: string): Promise<Record<string, TaskLink[]>> => {
  const rows = USE_SUPABASE
    ? await (async () => {
        const client = await sb();
        const { data: tasks } = await client.from("tasks").select("id").eq("event_id", eventId);
        const ids = (tasks ?? []).map((t: { id: string }) => t.id);
        if (!ids.length) return [] as TaskLink[];
        const { data } = await client.from("task_links").select("*").in("task_id", ids).order("order");
        return coalesce((data ?? []) as TaskLink[], ["url", "label"]);
      })()
    : local.getTaskLinksByEvent(eventId);
  const map: Record<string, TaskLink[]> = {};
  for (const r of rows) (map[r.task_id] ??= []).push(r);
  return map;
});

/**
 * Reconcile a task's result links with what the form submitted, keeping the
 * mirrored Super Link rows in step:
 *  - removed link  -> its Super Link row is deleted too
 *  - "publish" off -> Super Link row deleted, link kept on the task
 *  - "publish" on  -> creates the Super Link row once, then UPDATES it on later
 *    saves (via link_id), so saving twice never duplicates it
 */
export async function syncTaskLinks(task: Task, inputs: TaskLinkInput[]) {
  if (!USE_SUPABASE) return local.syncTaskLinks(task, inputs);
  const client = await sb();
  const existing = await getTaskLinks(task.id);
  const keep = new Set(inputs.map((i) => i.id).filter(Boolean));

  // 1) Deletions
  for (const ex of existing) {
    if (keep.has(ex.id)) continue;
    if (ex.link_id) await deleteLink(ex.link_id);
    await must(client.from("task_links").delete().eq("id", ex.id));
  }

  // 2) Upserts (order follows the form)
  for (const [i, input] of inputs.entries()) {
    const ex = input.id ? existing.find((e) => e.id === input.id) : undefined;
    const superRow = {
      event_id: task.event_id,
      division: task.division,
      section: "Hasil Tugas",
      name: input.label?.trim() || task.title,
      url: input.url,
      note: task.title,
      source: "task",
    };

    let linkId = ex?.link_id ?? null;
    if (input.in_super_link) {
      if (linkId) await updateLink(linkId, superRow);
      else linkId = await createLink(superRow);
    } else if (linkId) {
      await deleteLink(linkId);
      linkId = null;
    }

    const row = {
      url: input.url,
      label: input.label ?? "",
      in_super_link: input.in_super_link,
      link_id: linkId,
      order: i,
    };
    if (ex) await must(client.from("task_links").update(row).eq("id", ex.id));
    else await must(client.from("task_links").insert({ task_id: task.id, ...row }));
  }
}

/** Remove a task's Super Link rows before the task (and its task_links) go. */
export async function purgeTaskLinks(taskId: string) {
  const links = await getTaskLinks(taskId);
  for (const l of links) if (l.link_id) await deleteLink(l.link_id);
  // References go too, but nothing is deleted from Super Link for them: a
  // reference only POINTS at an entry that other tasks may also use.
  // In Supabase the FK cascade handles it; the local store has no FKs.
  if (!USE_SUPABASE) { local.deleteTaskRefsFor(taskId); return local.deleteTaskLinksFor(taskId); }
  await must((await sb()).from("task_links").delete().eq("task_id", taskId));
}

// ---------------- Task references ----------------
// Links a task USES. See the TaskRef type and migration 0037 for why this is
// not the same thing as task_links, and why one Super Link entry may be
// referenced by many tasks.
export const getTaskRefs = cache(async (taskId: string): Promise<TaskRef[]> => {
  if (!USE_SUPABASE) return local.getTaskRefs(taskId);
  const { data } = await (await sb()).from("task_refs").select("*").eq("task_id", taskId).order("order");
  return coalesce((data ?? []) as TaskRef[], ["url", "label"]);
});

/** All references for an event's tasks, keyed by task id (one round trip). */
export const getTaskRefsByEvent = cache(async (eventId: string): Promise<Record<string, TaskRef[]>> => {
  const rows = USE_SUPABASE
    ? await (async () => {
        const client = await sb();
        const { data: tasks } = await client.from("tasks").select("id").eq("event_id", eventId);
        const ids = (tasks ?? []).map((t: { id: string }) => t.id);
        if (!ids.length) return [] as TaskRef[];
        const { data } = await client.from("task_refs").select("*").in("task_id", ids).order("order");
        return coalesce((data ?? []) as TaskRef[], ["url", "label"]);
      })()
    : local.getTaskRefsByEvent(eventId);
  const byTask: Record<string, TaskRef[]> = {};
  for (const r of rows) (byTask[r.task_id] ??= []).push(r);
  return byTask;
});

/**
 * Replace a task's references with exactly what the form sent.
 *
 * Simpler than `syncTaskLinks`: nothing is published anywhere, so there is no
 * Super Link row to create or clean up. `link_id` merely records that the URL
 * came from a Super Link entry, and is left alone if that entry is later
 * deleted (the FK is ON DELETE SET NULL, so the URL text survives).
 */
export async function syncTaskRefs(taskId: string, inputs: TaskRefInput[]) {
  if (!USE_SUPABASE) return local.syncTaskRefs(taskId, inputs);
  const client = await sb();
  const existing = await getTaskRefs(taskId);
  const keep = new Set(inputs.map((i) => i.id).filter(Boolean));

  for (const ex of existing) {
    if (!keep.has(ex.id)) await must(client.from("task_refs").delete().eq("id", ex.id));
  }
  for (const [i, input] of inputs.entries()) {
    const row = {
      url: input.url,
      label: input.label ?? "",
      link_id: input.link_id ?? null,
      order: i,
    };
    if (input.id && existing.some((e) => e.id === input.id)) {
      await must(client.from("task_refs").update(row).eq("id", input.id));
    } else {
      await must(client.from("task_refs").insert({ task_id: taskId, ...row }));
    }
  }
}

// ---------------- Prospects ----------------
export const getProspects = cache(async (eventId?: string): Promise<Prospect[]> => {
  if (!USE_SUPABASE) return local.getProspects(eventId);
  const { data } = await (await sb()).from("prospects").select("*");
  const list = coalesce((data ?? []) as Prospect[], [
    "no", "date_text", "month", "contact", "org_name", "campus",
    "location", "mode", "pic", "contact_status", "their_response", "our_response", "source",
    // 0036: rows written before these columns existed come back null.
    "notes",
  ]);
  return eventId ? list.filter((p) => !p.event_id || p.event_id === eventId) : list;
});

/** Copy a primary prospect's identity onto its Ormawa Visit. */
export async function syncEventFromProspect(eventId: string, p: Prospect) {
  const patch: Partial<OVEvent> = {
    partner: p.org_name || "",
    campus: p.campus || "",
    location: p.location || "",
  };
  if (p.mode === "online" || p.mode === "offline") patch.mode = p.mode;
  await updateEvent(eventId, patch);
}

/** Make one prospect the event's primary (clearing any other), then sync the OV. */
export async function setPrimaryProspect(prospectId: string) {
  if (!USE_SUPABASE) return local.setPrimaryProspect(prospectId);
  const client = await sb();
  const { data: p } = await client.from("prospects").select("*").eq("id", prospectId).maybeSingle();
  if (!p || !p.event_id) return;
  // Clear the current primary FIRST (unique index forbids two at once).
  await must(client.from("prospects").update({ is_primary: false }).eq("event_id", p.event_id).eq("is_primary", true));
  await must(client.from("prospects").update({ is_primary: true }).eq("id", prospectId));
  await syncEventFromProspect(p.event_id, { ...(p as Prospect), is_primary: true });
}

/** Clear the primary flag on a prospect (leaves the OV data as-is). */
export async function unsetPrimaryProspect(prospectId: string) {
  if (!USE_SUPABASE) return local.unsetPrimaryProspect(prospectId);
  await must((await sb()).from("prospects").update({ is_primary: false }).eq("id", prospectId));
}
/** Returns the new row's id so the caller can attach its links (see
 *  `syncProspectLinks`). */
export async function createProspect(input: Partial<Prospect>): Promise<string | null> {
  if (!USE_SUPABASE) return local.createProspect(input).id;
  const data = await must((await sb()).from("prospects").insert(stripId(input)).select("id").single());
  return (data as { id: string } | null)?.id ?? null;
}
export async function updateProspect(id: string, patch: Partial<Prospect>) {
  if (!USE_SUPABASE) return local.updateProspect(id, patch);
  await must((await sb()).from("prospects").update(stripId(patch)).eq("id", id));
}
export async function deleteProspect(id: string) {
  if (!USE_SUPABASE) return local.deleteProspect(id);
  await purgeProspectLinks(id);
  await must((await sb()).from("prospects").delete().eq("id", id));
}
export async function bulkDeleteProspects(ids: string[]) {
  if (!ids.length) return;
  if (!USE_SUPABASE) { for (const id of ids) local.deleteProspect(id); return; }
  for (const id of ids) await purgeProspectLinks(id);
  await must((await sb()).from("prospects").delete().in("id", ids));
}

// ---------------- Prospect links ----------------
// A prospect's own links (handbook, org profile, the proposal they sent back).
// One prospect, many links since 0038 - see the ProspectLink type.
export const getProspectLinks = cache(async (prospectId: string): Promise<ProspectLink[]> => {
  if (!USE_SUPABASE) return local.getProspectLinks(prospectId);
  const { data } = await (await sb())
    .from("prospect_links").select("*").eq("prospect_id", prospectId).order("order");
  return coalesce((data ?? []) as ProspectLink[], ["url", "label"]);
});

/** Every prospect link for an edition, keyed by prospect id (one round trip). */
export const getProspectLinksByEvent = cache(
  async (eventId: string): Promise<Record<string, ProspectLink[]>> => {
    const rows = USE_SUPABASE
      ? await (async () => {
          const client = await sb();
          const { data: ps } = await client.from("prospects").select("id").eq("event_id", eventId);
          const ids = (ps ?? []).map((p: { id: string }) => p.id);
          if (!ids.length) return [] as ProspectLink[];
          const { data } = await client
            .from("prospect_links").select("*").in("prospect_id", ids).order("order");
          return coalesce((data ?? []) as ProspectLink[], ["url", "label"]);
        })()
      : local.getProspectLinksByEvent(eventId);
    const byProspect: Record<string, ProspectLink[]> = {};
    for (const r of rows) (byProspect[r.prospect_id] ??= []).push(r);
    return byProspect;
  },
);

/**
 * Reconcile a prospect's links with what the form submitted, keeping the
 * mirrored Super Link rows in step. Identical contract to `syncTaskLinks`:
 *  - removed link  -> its Super Link row is deleted too
 *  - "publish" off -> Super Link row deleted, link kept on the prospect
 *  - "publish" on  -> creates the Super Link row once, then UPDATES it on later
 *    saves (via link_id), so saving twice never duplicates it
 *
 * Call it after every prospect write.
 */
export async function syncProspectLinks(prospect: Prospect, inputs: ProspectLinkInput[]) {
  if (!USE_SUPABASE) return local.syncProspectLinks(prospect, inputs);
  const client = await sb();
  const existing = await getProspectLinks(prospect.id);
  const keep = new Set(inputs.map((i) => i.id).filter(Boolean));

  // 1) Deletions
  for (const ex of existing) {
    if (keep.has(ex.id)) continue;
    if (ex.link_id) await deleteLink(ex.link_id);
    await must(client.from("prospect_links").delete().eq("id", ex.id));
  }

  // 2) Upserts (order follows the form)
  for (const [i, input] of inputs.entries()) {
    const ex = input.id ? existing.find((e) => e.id === input.id) : undefined;
    const superRow = {
      event_id: prospect.event_id ?? null,
      // Prospects are not division-scoped, so the entry lands under
      // "Umum (tanpa divisi)" in the Super Link grouping.
      division: "",
      section: "Reach & Offer",
      name: input.label?.trim() || prospect.org_name || "Tautan prospek",
      url: input.url,
      note: prospect.org_name ?? "",
      source: "prospect",
    };

    let linkId = ex?.link_id ?? null;
    if (input.in_super_link) {
      if (linkId) await updateLink(linkId, superRow);
      else linkId = await createLink(superRow);
    } else if (linkId) {
      await deleteLink(linkId);
      linkId = null;
    }

    const row = {
      url: input.url,
      label: input.label ?? "",
      in_super_link: input.in_super_link,
      link_id: linkId,
      order: i,
    };
    if (ex) await must(client.from("prospect_links").update(row).eq("id", ex.id));
    else await must(client.from("prospect_links").insert({ prospect_id: prospect.id, ...row }));
  }
}

/** Remove a prospect's Super Link entries before the prospect itself goes.
 *  The `prospect_links` rows follow via the FK cascade in Supabase; the local
 *  store has no FKs, so it deletes them itself. */
async function purgeProspectLinks(id: string) {
  const links = await getProspectLinks(id);
  for (const l of links) if (l.link_id) await deleteLink(l.link_id);
  if (!USE_SUPABASE) local.deleteProspectLinksFor(id);
}

// ---------------- Links ----------------
export const getLinks = cache(async (eventId?: string): Promise<LinkItem[]> => {
  if (!USE_SUPABASE) return local.getLinks(eventId);
  const { data } = await (await sb()).from("links").select("*");
  const list = coalesce((data ?? []) as LinkItem[], ["section", "division", "name", "url", "note", "source"]);
  return eventId ? list.filter((l) => !l.event_id || l.event_id === eventId) : list;
});
/** Returns the new row's id so a task link can remember which Super Link row
 *  it owns (see syncTaskLinks). */
export async function createLink(input: Partial<LinkItem>): Promise<string | null> {
  if (!USE_SUPABASE) return local.createLink(input).id;
  const data = await must((await sb()).from("links").insert(stripId(input)).select("id").single());
  return (data as { id: string } | null)?.id ?? null;
}
export async function updateLink(id: string, patch: Partial<LinkItem>) {
  if (!USE_SUPABASE) return local.updateLink(id, patch);
  await must((await sb()).from("links").update(stripId(patch)).eq("id", id));
}
export async function deleteLink(id: string) {
  if (!USE_SUPABASE) return local.deleteLink(id);
  await must((await sb()).from("links").delete().eq("id", id));
}
export async function bulkDeleteLinks(ids: string[]) {
  if (!ids.length) return;
  if (!USE_SUPABASE) { for (const id of ids) local.deleteLink(id); return; }
  await must((await sb()).from("links").delete().in("id", ids));
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
          category_color: i.category_color ?? null,
        }),
      ),
  }));
  return eventId ? list.filter((b) => b.event_id === eventId) : list;
});
export async function updateBudgetItem(
  itemId: string,
  patch: {
    qty?: number | null; unit_price?: number | null; name?: string; category?: string;
    unit?: string; category_color?: string | null;
  },
) {
  if (!USE_SUPABASE) return local.updateBudgetItem(itemId, patch);
  const client = await sb();
  const { data: item } = await client.from("budget_items").select("*").eq("id", itemId).maybeSingle();
  if (!item) return;
  const qty = patch.qty ?? item.qty;
  const up = patch.unit_price ?? item.unit_price;
  const { error } = await client
    .from("budget_items")
    .update({ ...patch, total: Math.round((qty ?? 0) * (up ?? 0)) })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}
/** Recolour a whole category at once â€” the dot is a property of the category,
 *  not of one row, so every item in that plan+category moves together. */
export async function setCategoryColor(planId: string, category: string, color: string) {
  if (!USE_SUPABASE) return local.setCategoryColor(planId, category, color);
  const { error } = await (await sb())
    .from("budget_items")
    .update({ category_color: color })
    .eq("plan_id", planId)
    .eq("category", category);
  if (error) throw new Error(error.message);
}
export async function createBudgetItem(
  planId: string,
  input: {
    category: string; name: string; qty?: number | null; unit?: string;
    unit_price?: number | null; category_color?: string | null;
  },
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
  const { error } = await client.from("budget_items").insert({
    plan_id: planId,
    category: input.category || "LAIN-LAIN",
    name: input.name,
    qty: input.qty ?? null,
    unit: input.unit ?? "",
    unit_price: input.unit_price ?? null,
    total,
    category_color: input.category_color ?? null,
    order: (maxRow?.order ?? 0) + 1,
  });
  if (error) throw new Error(error.message);
}
export async function deleteBudgetItem(itemId: string) {
  if (!USE_SUPABASE) return local.deleteBudgetItem(itemId);
  await must((await sb()).from("budget_items").delete().eq("id", itemId));
}
export async function bulkDeleteBudgetItems(ids: string[]) {
  if (!ids.length) return;
  if (!USE_SUPABASE) { for (const id of ids) local.deleteBudgetItem(id); return; }
  await must((await sb()).from("budget_items").delete().in("id", ids));
}
/**
 * Rewrite `order` across a whole plan after a drag.
 *
 * The caller sends the plan's COMPLETE item sequence, not just the dragged
 * pair: category grouping in the UI is derived from this order, so a partial
 * rewrite would leave the untouched items interleaved at stale positions.
 */
export async function reorderBudgetItems(orderedIds: string[]) {
  if (!orderedIds.length) return;
  if (!USE_SUPABASE) return local.reorderBudgetItems(orderedIds);
  const client = await sb();
  await Promise.all(
    orderedIds.map((id, i) => must(client.from("budget_items").update({ order: i }).eq("id", id))),
  );
}
export async function createBudgetPlan(input: { name: string; event_id: string }) {
  if (!USE_SUPABASE) return local.createBudgetPlan(input);
  await must((await sb()).from("budget_plans").insert({ name: input.name, event_id: input.event_id }));
}
export async function deleteBudgetPlan(id: string) {
  if (!USE_SUPABASE) return local.deleteBudgetPlan(id);
  await must((await sb()).from("budget_plans").delete().eq("id", id));
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
  // division_jobs is jsonb â€” ensure it's always a plain object.
  return rows.map((r) => ({
    ...r,
    division_jobs: r.division_jobs && typeof r.division_jobs === "object" ? r.division_jobs : {},
    // `merges` is jsonb too, and every reader indexes into it without checking.
    merges: r.merges && typeof r.merges === "object" ? r.merges : {},
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
  await must(client.from("faqs").insert({
    question: input.question,
    answer: input.answer,
    order: (maxRow?.order ?? 0) + 1,
  }));
}
export async function updateFaq(id: string, patch: { question?: string; answer?: string }) {
  if (!USE_SUPABASE) return local.updateFaq(id, patch);
  await must((await sb()).from("faqs").update(patch).eq("id", id));
}
export async function deleteFaq(id: string) {
  if (!USE_SUPABASE) return local.deleteFaq(id);
  await must((await sb()).from("faqs").delete().eq("id", id));
}
/** Rewrite `order` to match the given sequence (same shape as reorderJobs). */
export async function reorderFaqs(orderedIds: string[]) {
  if (!orderedIds.length) return;
  if (!USE_SUPABASE) return local.reorderFaqs(orderedIds);
  const client = await sb();
  await Promise.all(
    orderedIds.map((id, i) => must(client.from("faqs").update({ order: i + 1 }).eq("id", id))),
  );
}

// ---------------- Teams ----------------
export const getTeams = cache(async (eventId?: string): Promise<Team[]> => {
  if (!USE_SUPABASE) return local.getTeams(eventId);
  let q = (await sb()).from("teams").select("*");
  if (eventId) q = q.eq("event_id", eventId);
  const { data } = await q;
  return coalesce((data ?? []) as Team[], ["division", "coordinator", "fungsionaris", "intern"]);
});

// ---------------- Role requests ----------------
// RLS already narrows SELECT to "mine, or everything if admin", so the plain
// list is safe to expose; `getRoleRequestsFor` is the explicit self-lookup.
export const getRoleRequests = cache(async (): Promise<RoleRequest[]> => {
  if (!USE_SUPABASE) return local.getRoleRequests();
  const { data } = await (await sb())
    .from("role_requests")
    .select("*")
    .order("created_at", { ascending: false });
  return coalesce((data ?? []) as RoleRequest[], ["name", "email", "message"]);
});

export const getRoleRequestsFor = cache(async (userId: string): Promise<RoleRequest[]> => {
  if (!USE_SUPABASE) return local.getRoleRequestsFor(userId);
  const { data } = await (await sb())
    .from("role_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return coalesce((data ?? []) as RoleRequest[], ["name", "email", "message"]);
});

export async function createRoleRequest(
  input: Omit<RoleRequest, "id" | "status" | "created_at">,
): Promise<void> {
  if (!USE_SUPABASE) {
    local.createRoleRequest(input);
    return;
  }
  const { error } = await (await sb()).from("role_requests").insert({
    user_id: input.user_id,
    name: input.name,
    email: input.email,
    requested_role: input.requested_role,
    division: input.division || null,
    event_id: input.event_id || null,
    message: input.message,
    status: "pending",
  });
  if (error) throw new Error(error.message);
}

/** Edit one's own still-pending request (fix a wrong role or a typo). The
 *  `status=pending` filter is belt-and-braces on top of RLS â€” a decided request
 *  must never be rewritten. */
export async function updateRoleRequest(
  id: string,
  patch: { requested_role?: RoleRequest["requested_role"]; message?: string },
): Promise<void> {
  if (!USE_SUPABASE) {
    local.updateRoleRequest(id, patch);
    return;
  }
  const { error } = await (await sb())
    .from("role_requests")
    .update(patch)
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

/** Approve (grant the role) or ignore a request. In Supabase this goes through
 *  the SECURITY DEFINER `decide_role_request` RPC â€” profiles.role is not
 *  directly writable by design (see migration 0020/0023). */
export async function decideRoleRequest(id: string, approve: boolean): Promise<void> {
  if (!USE_SUPABASE) {
    local.decideRoleRequest(id, approve);
    return;
  }
  const { error } = await (await sb()).rpc("decide_role_request", {
    request_id: id,
    approve,
  });
  if (error) throw new Error(error.message);
}

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
  await must(client.from("events").insert({
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
    locked: input.locked ?? false,
    attendance_hmsi: input.attendance_hmsi ?? null,
    feedback_hmsi_count: input.feedback_hmsi_count ?? null,
    feedback_hmsi_rating: input.feedback_hmsi_rating ?? null,
    feedback_partner_count: input.feedback_partner_count ?? null,
    feedback_partner_rating: input.feedback_partner_rating ?? null,
    report_url: input.report_url ?? null,
    order,
  }));
}
export async function updateEvent(id: string, patch: Partial<OVEvent>) {
  if (!USE_SUPABASE) return local.updateEvent(id, patch);
  const { id: _drop, ...rest } = patch;
  void _drop;
  await must((await sb()).from("events").update(rest).eq("id", id));
}
export async function deleteEvent(id: string) {
  if (!USE_SUPABASE) return local.deleteEvent(id);
  await must((await sb()).from("events").delete().eq("id", id));
}

/** Archive an Ormawa Visit (or take it back out of the archive). Admin-only â€”
 *  enforced by the `events_write` policy and `writable_event()` in 0028. */
export async function setEventLocked(id: string, locked: boolean) {
  if (!USE_SUPABASE) return local.setEventLocked(id, locked);
  await must((await sb()).from("events").update({ locked }).eq("id", id));
}

/**
 * Copy selected menus into `targetId`, each from its own source edition.
 *
 * Tasks & jobs arrive as a fresh skeleton (status reset, PIC and dates cleared)
 * so only reusable content carries over. Reach & Offer is copied the same way:
 * the pipeline state is reset, because "sudah dihubungi" belongs to the edition
 * that did the contacting, not to the copy.
 *
 * With `replace`, the target's existing rows for a chosen menu are deleted
 * first. That is what makes this usable on an edition that already has data -
 * without it a second copy would just pile duplicates on top.
 */
export async function cloneEventData(
  targetId: string,
  sources: CloneSources,
  opts: { replace?: boolean; filters?: CloneFilters } = {},
) {
  if (!USE_SUPABASE) return local.cloneEventData(targetId, sources, opts);
  const client = await sb();
  const filters = opts.filters ?? {};
  // A filter of undefined/empty means "no narrowing": everything is copied.
  const inSet = (value: string, allowed?: string[]) => !allowed?.length || allowed.includes(value);

  /** Wipe the target's rows for one menu before re-filling it. */
  async function clear(mod: CloneModule) {
    if (!opts.replace) return;
    switch (mod) {
      case "divisions": await must(client.from("divisions").delete().eq("event_id", targetId)); break;
      case "members": {
        // When a division filter is set, only that division's members and teams
        // are wiped; the rest of the target roster is left alone.
        const divs = filters.memberDivisions;
        if (divs?.length) {
          const existing = await getMembers(targetId);
          const ids = existing.filter((m) => divs.some((d) => memberInDivision(m, d))).map((m) => m.id);
          if (ids.length) await must(client.from("members").delete().in("id", ids));
          await must(client.from("teams").delete().eq("event_id", targetId).in("division", divs));
        } else {
          await must(client.from("members").delete().eq("event_id", targetId));
          await must(client.from("teams").delete().eq("event_id", targetId));
        }
        break;
      }
      case "prospects": await must(client.from("prospects").delete().eq("event_id", targetId)); break;
      // task_links go with their task via ON DELETE CASCADE (0025).
      case "tasks": {
        const divs = filters.taskDivisions;
        const q = client.from("tasks").delete().eq("event_id", targetId);
        await must(divs?.length ? q.in("division", divs) : q);
        break;
      }
      case "rundown": await must(client.from("rundown").delete().eq("event_id", targetId)); break;
      case "jobs": await must(client.from("job_harih").delete().eq("event_id", targetId)); break;
      case "links": await must(client.from("links").delete().eq("event_id", targetId)); break;
      case "budget": {
        // Items are deleted explicitly rather than trusting a cascade, because
        // an orphaned budget_item is invisible in the UI but still counted.
        const plans = await getBudgetPlans(targetId);
        const planIds = plans.map((p) => p.id);
        if (planIds.length) await must(client.from("budget_items").delete().in("plan_id", planIds));
        await must(client.from("budget_plans").delete().eq("event_id", targetId));
        break;
      }
    }
  }

  for (const mod of CLONE_MODULES) {
    const sourceId = sources[mod];
    if (!sourceId) continue;
    await clear(mod);

    if (mod === "divisions") {
      const src = await getDivisions(sourceId);
      const rows = src.map((d) => ({
        event_id: targetId, key: d.key, name: d.name, short: d.short, color: d.color,
        order: d.order, exclude_from_rundown: d.exclude_from_rundown ?? false,
      }));
      if (rows.length) await must(client.from("divisions").insert(rows));
    }

    if (mod === "members") {
      const divs = filters.memberDivisions;
      const src = (await getMembers(sourceId))
        .filter((m) => !divs?.length || divs.some((d) => memberInDivision(m, d)));
      const rows = src.map((m) => ({
        event_id: targetId, name: m.name, nickname: m.nickname, nrp: m.nrp,
        type: m.type, year: m.year,
        ...divisionFields(m.divisions, m.division),
      }));
      if (rows.length) await must(client.from("members").insert(rows));
      // Teams (division coordinators) travel with the roster: a copied division
      // whose coordinator was dropped would look leaderless for no reason.
      const teams = (await getTeams(sourceId))
        .filter((tm) => !divs?.length || divs.includes(tm.division));
      const teamRows = teams.map((tm) => ({
        event_id: targetId, division: tm.division, coordinator: tm.coordinator,
        fungsionaris: tm.fungsionaris, intern: tm.intern,
      }));
      if (teamRows.length) await must(client.from("teams").insert(teamRows));
    }

    if (mod === "prospects") {
      const src = await getProspects(sourceId);
      const rows = src.map((p, i) => ({
        event_id: targetId, no: String(i + 1), month: p.month,
        contact: p.contact, org_name: p.org_name, campus: p.campus,
        location: p.location, mode: p.mode || null,
        // Outreach state belongs to the edition that did the contacting, so the
        // copy starts from scratch. `is_primary` is left off entirely: exactly
        // one prospect per edition may hold it, and it is set from the UI.
        // The prospect's LINKS are not copied either: half of them are
        // published to Super Link, and a copy would republish them as
        // duplicates that nobody could tell apart.
        date_text: "", pic: "", contact_status: "", their_response: "", our_response: "",
        done: false, source: p.source,
      }));
      if (rows.length) await must(client.from("prospects").insert(rows));
    }

    if (mod === "tasks") {
      const src = (await getTasks({ event_id: sourceId }))
        .filter((t) => inSet(t.division, filters.taskDivisions));
      const noByDiv: Record<string, number> = {};
      const rows = src.map((t) => {
        noByDiv[t.division] = (noByDiv[t.division] ?? 0) + 1;
        return {
          event_id: targetId, division: t.division, no: String(noByDiv[t.division]),
          pic: "", title: t.title, start_date: null, start_raw: "", end_date: null, end_raw: "",
          notes: t.notes, result: "", status: "todo" as TaskStatus,
        };
      });
      if (rows.length) await must(client.from("tasks").insert(rows));
    }

    if (mod === "rundown") {
      const src = await getRundown(sourceId, "A");
      const rows = src.map((r) => ({
        event_id: targetId, variant: r.variant, no: r.no, time_start: r.time_start, time_end: r.time_end,
        duration: r.duration, activity: r.activity, keterangan: r.keterangan, host: r.host, opr_link: r.opr_link,
        mc: r.mc, job_lo: r.job_lo, job_event: r.job_event, job_consump: r.job_consump, job_creative: r.job_creative, job_opr: r.job_opr,
      }));
      if (rows.length) await must(client.from("rundown").insert(rows));
    }

    if (mod === "jobs") {
      const src = await getJobs(sourceId);
      const rows = src.map((j) => ({ event_id: targetId, no: j.no, pic: "", job: j.job, notes: j.notes }));
      if (rows.length) await must(client.from("job_harih").insert(rows));
    }

    if (mod === "links") {
      // Super Link entries that were PUBLISHED from a task or prospect are
      // skipped: those are owned by their source row, and a free copy would be
      // an orphan pointing at nothing in the new edition.
      const src = (await getLinks(sourceId)).filter((l) => l.source === "manual" || !l.source);
      const rows = src.map((l) => ({
        event_id: targetId, section: l.section, division: l.division,
        name: l.name, url: l.url, note: l.note, source: "manual",
      }));
      if (rows.length) await must(client.from("links").insert(rows));
    }

    if (mod === "budget") {
      const wanted = filters.budgetPlanIds;
      const plans = (await getBudgetPlans(sourceId))
        .filter((p) => !wanted?.length || wanted.includes(p.id));
      for (const plan of plans) {
        const created = await must(client
          .from("budget_plans")
          .insert({ name: plan.name, event_id: targetId })
          .select("id")
          .single());
        if (created && plan.items.length)
          await must(client.from("budget_items").insert(
            plan.items.map((i, idx) => ({
              plan_id: created.id, category: i.category, no: i.no, name: i.name,
              qty: i.qty, unit: i.unit, unit_price: i.unit_price, total: i.total,
              category_color: i.category_color ?? null, order: idx,
            })),
          ));
      }
    }
  }
}

export async function createMember(input: Partial<Member>) {
  if (!USE_SUPABASE) return local.createMember(input);
  const div = divisionFields(input.divisions, input.division);
  // Writes THROW on a Supabase error (RLS denial, missing column, â€¦): swallowing
  // it made a failed save look successful and wrote nothing â€” the actions turn
  // this into a visible toast.
  const { error } = await (await sb()).from("members").insert({
    event_id: input.event_id ?? null,
    name: input.name ?? "",
    nickname: input.nickname ?? "",
    nrp: input.nrp ?? "",
    type: input.type ?? "fungsionaris",
    year: input.year ?? new Date().getFullYear(),
    division: div.division,
    divisions: div.divisions,
  });
  if (error) throw new Error(error.message);
}
export async function updateMember(id: string, patch: Partial<Member>) {
  if (!USE_SUPABASE) return local.updateMember(id, patch);
  const { id: _drop, ...rest } = patch;
  void _drop;
  const { error } = await (await sb()).from("members").update(rest).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteMember(id: string) {
  if (!USE_SUPABASE) return local.deleteMember(id);
  const { error } = await (await sb()).from("members").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
export async function bulkDeleteMembers(ids: string[]) {
  if (!ids.length) return;
  if (!USE_SUPABASE) {
    for (const id of ids) local.deleteMember(id);
    return;
  }
  const { error } = await (await sb()).from("members").delete().in("id", ids);
  if (error) throw new Error(error.message);
}
export async function bulkUpdateMembers(ids: string[], patch: Partial<Member>) {
  if (!ids.length) return;
  if (!USE_SUPABASE) {
    for (const id of ids) local.updateMember(id, patch);
    return;
  }
  const { id: _drop, ...rest } = patch;
  void _drop;
  const { error } = await (await sb()).from("members").update(rest).in("id", ids);
  if (error) throw new Error(error.message);
}

export async function createDivision(input: Partial<Division>) {
  if (!USE_SUPABASE) return local.createDivision(input);
  const client = await sb();
  // Order is per-event so each Ormawa Visit numbers its own divisions from 1.
  let mq = client.from("divisions").select("order").order("order", { ascending: false }).limit(1);
  if (input.event_id) mq = mq.eq("event_id", input.event_id);
  const { data: maxRow } = await mq.maybeSingle();
  await must(client.from("divisions").insert({
    event_id: input.event_id ?? null,
    key: input.key ?? uid("DIV").toUpperCase(),
    name: input.name ?? "",
    short: input.short ?? "",
    color: input.color ?? "#6366f1",
    order: input.order ?? (maxRow?.order ?? 0) + 1,
    exclude_from_rundown: input.exclude_from_rundown ?? false,
  }));
}
export async function updateDivision(eventId: string, key: string, patch: Partial<Division>) {
  if (!USE_SUPABASE) return local.updateDivision(eventId, key, patch);
  const { id: _i, event_id: _e, ...rest } = patch;
  void _i; void _e;
  await must((await sb()).from("divisions").update(rest).eq("event_id", eventId).eq("key", key));
}
export async function deleteDivision(eventId: string, key: string) {
  if (!USE_SUPABASE) return local.deleteDivision(eventId, key);
  await must((await sb()).from("divisions").delete().eq("event_id", eventId).eq("key", key));
}
export async function bulkDeleteDivisions(eventId: string, keys: string[]) {
  if (!keys.length) return;
  if (!USE_SUPABASE) { for (const k of keys) local.deleteDivision(eventId, k); return; }
  await must((await sb()).from("divisions").delete().eq("event_id", eventId).in("key", keys));
}
export async function bulkUpdateDivisions(eventId: string, keys: string[], patch: Partial<Division>) {
  if (!keys.length) return;
  if (!USE_SUPABASE) { for (const k of keys) local.updateDivision(eventId, k, patch); return; }
  const { id: _i, event_id: _e, ...rest } = patch;
  void _i; void _e;
  await must((await sb()).from("divisions").update(rest).eq("event_id", eventId).in("key", keys));
}

export async function createTeam(input: Partial<Team>) {
  if (!USE_SUPABASE) return local.createTeam(input);
  const { error } = await (await sb()).from("teams").insert({
    event_id: input.event_id ?? null,
    division: input.division ?? "EVENT",
    coordinator: input.coordinator ?? "",
    fungsionaris: input.fungsionaris ?? "",
    intern: input.intern ?? "",
  });
  if (error) throw new Error(error.message);
}
export async function updateTeam(id: string, patch: Partial<Team>) {
  if (!USE_SUPABASE) return local.updateTeam(id, patch);
  const { id: _drop, ...rest } = patch;
  void _drop;
  const { error } = await (await sb()).from("teams").update(rest).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteTeam(id: string) {
  if (!USE_SUPABASE) return local.deleteTeam(id);
  await must((await sb()).from("teams").delete().eq("id", id));
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
  await must(client.from("rundown").insert({
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
    merges: input.merges ?? {},
  }));
}
export async function updateRundown(id: string, patch: Partial<RundownItem>) {
  if (!USE_SUPABASE) return local.updateRundown(id, patch);
  const { id: _d, ...rest } = patch;
  void _d;
  await must((await sb()).from("rundown").update(rest).eq("id", id));
}
/**
 * Write ONE division's cell on a rundown row, leaving the other divisions alone.
 *
 * `division_jobs` is a single jsonb column, so any write replaces the whole
 * object. The table used to build that object in the BROWSER from the row it
 * had last rendered, which meant filling in two division cells in a row faster
 * than the revalidation round trip silently reverted the first one: the second
 * payload was assembled from props that predated it, the toast still said
 * saved, and the value was gone on reload.
 *
 * Reading the current value HERE, one statement before the update, closes that
 * window: it composes with anything already committed, however stale the
 * caller's copy is. Two writes landing inside the same round trip can still
 * interleave (PostgREST cannot express a partial jsonb update, so a true fix
 * needs an RPC doing `division_jobs || jsonb_build_object(...)`), but that
 * window is one query wide rather than one React refresh wide.
 */
export async function setRundownDivisionJob(id: string, division: string, value: string) {
  if (!USE_SUPABASE) return local.setRundownDivisionJob(id, division, value);
  const client = await sb();
  const { data } = await client.from("rundown").select("division_jobs").eq("id", id).maybeSingle();
  const current =
    data?.division_jobs && typeof data.division_jobs === "object" ? data.division_jobs : {};
  await must(
    client.from("rundown").update({ division_jobs: { ...current, [division]: value } }).eq("id", id),
  );
}

export async function deleteRundown(id: string) {
  if (!USE_SUPABASE) return local.deleteRundown(id);
  await must((await sb()).from("rundown").delete().eq("id", id));
}

export async function createJob(input: Partial<JobHariH>) {
  if (!USE_SUPABASE) return local.createJob(input);
  const client = await sb();
  // `no` assigned atomically by the assign_job_no() BEFORE-INSERT trigger
  // (advisory-locked per event) when null; an explicit `no` is preserved.
  await must(client.from("job_harih").insert({
    event_id: input.event_id ?? null,
    no: input.no ?? null,
    pic: input.pic ?? "",
    job: input.job ?? "",
    notes: input.notes ?? "",
  }));
}
export async function updateJob(id: string, patch: Partial<JobHariH>) {
  if (!USE_SUPABASE) return local.updateJob(id, patch);
  const { id: _d, ...rest } = patch;
  void _d;
  await must((await sb()).from("job_harih").update(rest).eq("id", id));
}
export async function deleteJob(id: string) {
  if (!USE_SUPABASE) return local.deleteJob(id);
  await must((await sb()).from("job_harih").delete().eq("id", id));
}
/** Persist a new order for Hari-H jobs: each id gets its 1-based `no`. */
export async function reorderJobs(orderedIds: string[]) {
  if (!orderedIds.length) return;
  if (!USE_SUPABASE) return local.reorderJobs(orderedIds);
  const client = await sb();
  await Promise.all(
    orderedIds.map((id, i) => must(client.from("job_harih").update({ no: String(i + 1) }).eq("id", id))),
  );
}
