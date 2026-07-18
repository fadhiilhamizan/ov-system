import "server-only";
import { getDb, mutate } from "./store";
import { uid } from "../utils";
import { prospectStage } from "../constants";
import type {
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

// ---------------- Divisions ----------------
export function getDivisions(): Division[] {
  return [...getDb().divisions].sort((a, b) => a.order - b.order);
}
export function getDivision(key: string) {
  return getDb().divisions.find((d) => d.key === key) ?? null;
}

// ---------------- Events ----------------
export function getEvents(): OVEvent[] {
  return [...getDb().events].sort((a, b) => a.order - b.order);
}
export function getEvent(id: string) {
  return getDb().events.find((e) => e.id === id) ?? null;
}
export function getDefaultEvent(): OVEvent {
  const events = getEvents();
  const tasks = getDb().tasks;
  const withTasks = events.filter((e) => tasks.some((t) => t.event_id === e.id));
  return (
    events.find((e) => e.status === "active") ??
    withTasks[withTasks.length - 1] ??
    events[events.length - 1] ??
    events[0]
  );
}

// ---------------- Members ----------------
export function getMembers(): Member[] {
  return getDb().members;
}

// ---------------- Tasks ----------------
export interface TaskFilter {
  event_id?: string;
  division?: string;
  status?: TaskStatus;
  pic?: string;
  q?: string;
}
export function getTasks(filter: TaskFilter = {}): Task[] {
  let list = getDb().tasks;
  if (filter.event_id) list = list.filter((t) => t.event_id === filter.event_id);
  if (filter.division) list = list.filter((t) => t.division === filter.division);
  if (filter.status) list = list.filter((t) => t.status === filter.status);
  if (filter.pic) list = list.filter((t) => t.pic.toLowerCase().includes(filter.pic!.toLowerCase()));
  if (filter.q) {
    const q = filter.q.toLowerCase();
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.pic.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        t.result.toLowerCase().includes(q),
    );
  }
  return list;
}
export function getTask(id: string) {
  return getDb().tasks.find((t) => t.id === id) ?? null;
}
export function createTask(input: Partial<Task> & { event_id: string; division: Task["division"]; title: string }): Task {
  // Auto-number: next sequential "no" within this event + division.
  const siblings = getDb().tasks.filter((t) => t.event_id === input.event_id && t.division === input.division);
  const maxNo = Math.max(0, ...siblings.map((t) => parseInt(t.no, 10) || 0));
  const task: Task = {
    id: uid("t"),
    event_id: input.event_id,
    division: input.division,
    no: input.no ?? String(maxNo + 1),
    pic: input.pic ?? "",
    title: input.title,
    start_date: input.start_date ?? null,
    start_raw: input.start_raw ?? "",
    end_date: input.end_date ?? null,
    end_raw: input.end_raw ?? "",
    notes: input.notes ?? "",
    result: input.result ?? "",
    status: input.status ?? "todo",
  };
  mutate((db) => db.tasks.unshift(task));
  return task;
}
export function updateTask(id: string, patch: Partial<Task>): Task | null {
  return mutate((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, patch);
    return t;
  });
}
export function deleteTask(id: string) {
  mutate((db) => {
    db.tasks = db.tasks.filter((t) => t.id !== id);
  });
}

// ---------------- Prospects ----------------
export function getProspects(eventId?: string): Prospect[] {
  const list = getDb().prospects;
  return eventId ? list.filter((p) => !p.event_id || p.event_id === eventId) : list;
}
export function createProspect(input: Partial<Prospect>): Prospect {
  const p: Prospect = {
    id: uid("p"),
    batch: input.batch ?? "Uncategorized",
    no: input.no ?? "",
    date_text: input.date_text ?? "",
    month: input.month ?? "",
    contact: input.contact ?? "",
    org_name: input.org_name ?? "",
    campus: input.campus ?? "",
    location: input.location ?? "",
    pic: input.pic ?? "",
    contact_status: input.contact_status ?? "",
    their_response: input.their_response ?? "",
    our_response: input.our_response ?? "",
    done: input.done ?? false,
    source: input.source ?? "manual",
  };
  mutate((db) => db.prospects.unshift(p));
  return p;
}
export function updateProspect(id: string, patch: Partial<Prospect>) {
  return mutate((db) => {
    const p = db.prospects.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, patch);
    return p;
  });
}
export function deleteProspect(id: string) {
  mutate((db) => {
    db.prospects = db.prospects.filter((p) => p.id !== id);
  });
}

// ---------------- Links ----------------
export function getLinks(eventId?: string): LinkItem[] {
  const list = getDb().links;
  return eventId ? list.filter((l) => !l.event_id || l.event_id === eventId) : list;
}
export function createLink(input: Partial<LinkItem>): LinkItem {
  const l: LinkItem = {
    id: uid("l"),
    section: input.section ?? "",
    division: input.division ?? "",
    name: input.name ?? "",
    url: input.url ?? "",
    note: input.note ?? "",
    source: input.source ?? "manual",
  };
  mutate((db) => db.links.unshift(l));
  return l;
}
export function updateLink(id: string, patch: Partial<LinkItem>) {
  return mutate((db) => {
    const l = db.links.find((x) => x.id === id);
    if (!l) return null;
    Object.assign(l, patch);
    return l;
  });
}
export function deleteLink(id: string) {
  mutate((db) => {
    db.links = db.links.filter((l) => l.id !== id);
  });
}

// ---------------- Budget ----------------
export function getBudgetPlans(eventId?: string): BudgetPlan[] {
  const list = getDb().budgetPlans;
  return eventId ? list.filter((b) => b.event_id === eventId) : list;
}
export function getBudgetPlan(id: string) {
  return getDb().budgetPlans.find((b) => b.id === id) ?? null;
}
export function updateBudgetPlan(id: string, patch: Partial<BudgetPlan>) {
  return mutate((db) => {
    const b = db.budgetPlans.find((x) => x.id === id);
    if (!b) return null;
    Object.assign(b, patch);
    return b;
  });
}
export function updateBudgetItem(
  itemId: string,
  patch: { qty?: number | null; unit_price?: number | null; name?: string; category?: string; unit?: string },
) {
  return mutate((db) => {
    for (const p of db.budgetPlans) {
      const it = p.items.find((x) => x.id === itemId);
      if (!it) continue;
      Object.assign(it, patch);
      if (patch.qty !== undefined || patch.unit_price !== undefined) {
        it.total = (it.qty ?? 0) * (it.unit_price ?? 0);
      }
      return it;
    }
    return null;
  });
}
export function createBudgetItem(
  planId: string,
  input: { category: string; name: string; qty?: number | null; unit?: string; unit_price?: number | null },
) {
  return mutate((db) => {
    const p = db.budgetPlans.find((x) => x.id === planId);
    if (!p) return null;
    const item = {
      id: uid("bi"),
      category: input.category || "LAIN-LAIN",
      no: Math.max(0, ...p.items.map((i) => i.no)) + 1,
      name: input.name,
      qty: input.qty ?? null,
      unit: input.unit ?? "",
      unit_price: input.unit_price ?? null,
      total: (input.qty ?? 0) * (input.unit_price ?? 0),
    };
    p.items.push(item);
    return item;
  });
}
export function deleteBudgetItem(itemId: string) {
  mutate((db) => {
    for (const p of db.budgetPlans) {
      const before = p.items.length;
      p.items = p.items.filter((i) => i.id !== itemId);
      if (p.items.length !== before) return;
    }
  });
}
export function createBudgetPlan(input: { name: string; event_id: string }): BudgetPlan {
  const plan: BudgetPlan = { id: uid("bp"), name: input.name, event_id: input.event_id, items: [] };
  mutate((db) => db.budgetPlans.push(plan));
  return plan;
}
export function deleteBudgetPlan(id: string) {
  mutate((db) => {
    db.budgetPlans = db.budgetPlans.filter((p) => p.id !== id);
  });
}

// ---------------- Rundown ----------------
export function getRundown(eventId?: string, variant?: string): RundownItem[] {
  let list = getDb().rundown;
  if (eventId) list = list.filter((r) => r.event_id === eventId);
  if (variant) list = list.filter((r) => r.variant === variant);
  return [...list].sort((a, b) => a.no - b.no);
}

// ---------------- Jobs (Hari-H) ----------------
export function getJobs(eventId?: string): JobHariH[] {
  const list = getDb().jobHariH;
  return eventId ? list.filter((j) => j.event_id === eventId) : list;
}

// ---------------- FAQ ----------------
export function getFaqs(): Faq[] {
  return getDb().faqs;
}

// ---------------- Teams ----------------
export function getTeams(eventId?: string): Team[] {
  const list = getDb().teams;
  return eventId ? list.filter((t) => t.event_id === eventId) : list;
}

// ================= Aggregations =================
export function taskStats(eventId?: string) {
  const tasks = getTasks(eventId ? { event_id: eventId } : {});
  const total = tasks.length;
  const by: Record<TaskStatus, number> = { todo: 0, ongoing: 0, done: 0, overtime: 0 };
  for (const t of tasks) by[t.status]++;
  const progress = total ? Math.round((by.done / total) * 1000) / 10 : 0;
  return { total, by, progress, tasks };
}

export function divisionStats(eventId?: string) {
  const tasks = getTasks(eventId ? { event_id: eventId } : {});
  const divs = getDivisions();
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

export function prospectStats() {
  const prospects = getProspects();
  const stages: Record<string, number> = {};
  for (const p of prospects) {
    const s = prospectStage(p);
    stages[s] = (stages[s] ?? 0) + 1;
  }
  return { total: prospects.length, stages, prospects };
}

export function budgetTotal(eventId?: string) {
  const plans = getBudgetPlans(eventId);
  return plans.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + (i.total ?? 0), 0),
    0,
  );
}

// ================= CRUD: events / members / divisions / teams =================
export function createEvent(input: Partial<OVEvent>): OVEvent {
  const events = getDb().events;
  const ev: OVEvent = {
    id: input.id ?? uid("ov"),
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
    order: input.order ?? Math.max(0, ...events.map((e) => e.order)) + 1,
  };
  mutate((db) => db.events.push(ev));
  return ev;
}
export function updateEvent(id: string, patch: Partial<OVEvent>) {
  return mutate((db) => {
    const e = db.events.find((x) => x.id === id);
    if (!e) return null;
    Object.assign(e, patch);
    return e;
  });
}
export function deleteEvent(id: string) {
  mutate((db) => {
    db.events = db.events.filter((e) => e.id !== id);
  });
}

export function createMember(input: Partial<Member>): Member {
  const m: Member = {
    id: uid("m"),
    name: input.name ?? "",
    nickname: input.nickname ?? "",
    nrp: input.nrp ?? "",
    type: input.type ?? "fungsionaris",
    year: input.year ?? new Date().getFullYear(),
    division: input.division ?? null,
  };
  mutate((db) => db.members.push(m));
  return m;
}
export function updateMember(id: string, patch: Partial<Member>) {
  return mutate((db) => {
    const m = db.members.find((x) => x.id === id);
    if (!m) return null;
    Object.assign(m, patch);
    return m;
  });
}
export function deleteMember(id: string) {
  mutate((db) => {
    db.members = db.members.filter((m) => m.id !== id);
  });
}

export function createDivision(input: Partial<Division>): Division {
  const divs = getDb().divisions;
  const d: Division = {
    key: input.key ?? uid("DIV").toUpperCase(),
    name: input.name ?? "",
    short: input.short ?? "",
    color: input.color ?? "#6366f1",
    order: input.order ?? Math.max(0, ...divs.map((x) => x.order)) + 1,
  };
  mutate((db) => db.divisions.push(d));
  return d;
}
export function updateDivision(key: string, patch: Partial<Division>) {
  return mutate((db) => {
    const d = db.divisions.find((x) => x.key === key);
    if (!d) return null;
    Object.assign(d, patch);
    return d;
  });
}
export function deleteDivision(key: string) {
  mutate((db) => {
    db.divisions = db.divisions.filter((d) => d.key !== key);
  });
}

export function createTeam(input: Partial<Team>): Team {
  const t: Team = {
    id: uid("tm"),
    event_id: input.event_id ?? null,
    division: input.division ?? "EVENT",
    fungsionaris: input.fungsionaris ?? "",
    intern: input.intern ?? "",
  };
  mutate((db) => db.teams.push(t));
  return t;
}
export function updateTeam(id: string, patch: Partial<Team>) {
  return mutate((db) => {
    const t = db.teams.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, patch);
    return t;
  });
}
export function deleteTeam(id: string) {
  mutate((db) => {
    db.teams = db.teams.filter((t) => t.id !== id);
  });
}

// ================= CRUD: rundown / jobs =================
export function createRundown(input: Partial<RundownItem>): RundownItem {
  const items = getDb().rundown.filter((r) => r.event_id === (input.event_id ?? null) && r.variant === (input.variant ?? "A"));
  const r: RundownItem = {
    id: uid("r"),
    event_id: input.event_id ?? "",
    variant: input.variant ?? "A",
    no: input.no ?? Math.max(0, ...items.map((x) => x.no)) + 1,
    time_start: input.time_start ?? "",
    time_end: input.time_end ?? "",
    duration: input.duration ?? "",
    activity: input.activity ?? "",
    keterangan: input.keterangan ?? "",
    host: input.host ?? "",
    opr_link: input.opr_link ?? "",
    mc: input.mc ?? "",
    job_lo: input.job_lo ?? "",
    job_event: input.job_event ?? "",
    job_consump: input.job_consump ?? "",
    job_creative: input.job_creative ?? "",
    job_opr: input.job_opr ?? "",
  };
  mutate((db) => db.rundown.push(r));
  return r;
}
export function updateRundown(id: string, patch: Partial<RundownItem>) {
  return mutate((db) => {
    const r = db.rundown.find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, patch);
    return r;
  });
}
export function deleteRundown(id: string) {
  mutate((db) => {
    db.rundown = db.rundown.filter((r) => r.id !== id);
  });
}

export function createJob(input: Partial<JobHariH>): JobHariH {
  const items = getDb().jobHariH.filter((j) => j.event_id === input.event_id);
  const maxNo = Math.max(0, ...items.map((j) => parseInt(j.no, 10) || 0));
  const j: JobHariH = {
    id: uid("j"),
    event_id: input.event_id ?? "",
    no: input.no ?? String(maxNo + 1),
    pic: input.pic ?? "",
    job: input.job ?? "",
    notes: input.notes ?? "",
  };
  mutate((db) => db.jobHariH.push(j));
  return j;
}
export function updateJob(id: string, patch: Partial<JobHariH>) {
  return mutate((db) => {
    const j = db.jobHariH.find((x) => x.id === id);
    if (!j) return null;
    Object.assign(j, patch);
    return j;
  });
}
export function deleteJob(id: string) {
  mutate((db) => {
    db.jobHariH = db.jobHariH.filter((j) => j.id !== id);
  });
}
