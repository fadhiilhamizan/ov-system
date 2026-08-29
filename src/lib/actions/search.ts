"use server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getActiveEvent } from "@/lib/session";
import {
  getTasks, getMembers, getDivisions, getProspects, getLinks,
  getBudgetPlans, getRundown, getJobs, getEvents, getFaqs,
} from "@/lib/data/repo";
import { STATUS_META } from "@/lib/constants";
import { memberDivisions } from "@/lib/members";
import { searchQuerySchema, parse } from "./schemas";

/** One row in the palette. `href` is where Enter takes you. */
export interface SearchHit {
  id: string;
  /** Module key - also the group heading and the icon the client picks. */
  group: string;
  title: string;
  subtitle: string;
  href: string;
}

const MAX_PER_GROUP = 5;

function norm(s: unknown): string {
  return typeof s === "string" ? s.toLowerCase() : "";
}

/**
 * Global search across every module the caller is allowed to open.
 *
 * Runs on the server and filters in JS over the already-cached per-request
 * getters rather than issuing per-module `ilike` queries: the whole dataset for
 * one Ormawa Visit is small (hundreds of rows), and this way the results honour
 * exactly the same reads - and therefore the same RLS - as the pages do.
 *
 * Access is checked per module with `can.accessModule`, so a Tamu never gets
 * budget or Super Link hits back even as raw JSON.
 */
export async function searchAction(query: string): Promise<SearchHit[]> {
  // The palette calls this on a 220ms debounce while somebody types, so it is
  // the highest-frequency action in the app. Validate like any other: it is
  // client input, and an unbounded string has no business reaching the loops
  // below.
  const v = parse(searchQuerySchema, query);
  if (!v.ok) return [];
  const q = v.data.toLowerCase();
  if (q.length < 2) return [];

  const user = await getCurrentUser();
  const event = await getActiveEvent();
  const allowed = (moduleKey: string) => can.accessModule(user, moduleKey);

  const hits: SearchHit[] = [];
  // Counted, not re-scanned. `push` used to filter the whole `hits` array on
  // every call to find out how full a group was.
  const perGroup = new Map<string, number>();
  const full = (group: string) => (perGroup.get(group) ?? 0) >= MAX_PER_GROUP;
  const push = (h: SearchHit) => {
    if (full(h.group)) return;
    perGroup.set(h.group, (perGroup.get(h.group) ?? 0) + 1);
    hits.push(h);
  };

  // ONE wave, not two. Everything below is independent, but the six modules
  // after this batch used to be awaited one after another inside their own
  // `if (allowed(...))` blocks, so a search cost four parallel round trips plus
  // six sequential ones. On a debounced keystroke that is the whole latency.
  const [
    tasks, divisions, members, events,
    prospects, links, plans, rundown, jobs, faqs,
  ] = await Promise.all([
    allowed("tasks") ? getTasks({ event_id: event.id }) : [],
    allowed("divisions") ? getDivisions(event.id) : [],
    allowed("members") ? getMembers(event.id) : [],
    allowed("events") ? getEvents() : [],
    allowed("prospects") ? getProspects(event.id) : [],
    allowed("links") ? getLinks(event.id) : [],
    allowed("budget") ? getBudgetPlans(event.id) : [],
    allowed("rundown") ? getRundown(event.id) : [],
    allowed("jobs") ? getJobs(event.id) : [],
    allowed("faq") ? getFaqs() : [],
  ]);

  for (const t of tasks) {
    if (full("tasks")) break;
    if (`${norm(t.title)} ${norm(t.pic)} ${norm(t.notes)} ${norm(t.result)} ${norm(t.no)}`.includes(q)) {
      push({
        id: `task-${t.id}`,
        group: "tasks",
        title: t.title,
        subtitle: [t.division, t.pic, STATUS_META[t.status]?.label].filter(Boolean).join(" · "),
        href: "/tasks",
      });
    }
  }

  for (const d of divisions) {
    if (full("divisions")) break;
    if (`${norm(d.name)} ${norm(d.key)} ${norm(d.short)}`.includes(q)) {
      push({
        id: `div-${d.key}`,
        group: "divisions",
        title: d.name,
        subtitle: `Divisi · ${d.short}`,
        href: `/divisions/${d.key}`,
      });
    }
  }

  for (const m of members) {
    if (full("members")) break;
    if (`${norm(m.name)} ${norm(m.nickname)} ${norm(m.nrp)}`.includes(q)) {
      push({
        id: `member-${m.id}`,
        group: "members",
        title: m.name,
        subtitle: [m.nrp, memberDivisions(m).join(", "), m.type].filter(Boolean).join(" · "),
        href: "/members",
      });
    }
  }

  for (const e of events) {
    if (full("events")) break;
    if (`${norm(e.title)} ${norm(e.code)} ${norm(e.partner)} ${norm(e.campus)} ${norm(e.cabinet)}`.includes(q)) {
      push({
        id: `event-${e.id}`,
        group: "events",
        title: e.title,
        subtitle: [e.code, e.partner, e.locked ? "Arsip" : null].filter(Boolean).join(" · "),
        href: "/events",
      });
    }
  }

  for (const p of prospects) {
    if (full("prospects")) break;
    if (`${norm(p.org_name)} ${norm(p.campus)} ${norm(p.pic)} ${norm(p.contact)}`.includes(q)) {
      push({
        id: `prospect-${p.id}`,
        group: "prospects",
        title: p.org_name || "(tanpa nama)",
        subtitle: [p.campus, p.pic].filter(Boolean).join(" · "),
        href: "/prospects",
      });
    }
  }

  for (const l of links) {
    if (full("links")) break;
    if (`${norm(l.name)} ${norm(l.section)} ${norm(l.note)} ${norm(l.division)}`.includes(q)) {
      push({
        id: `link-${l.id}`,
        group: "links",
        title: l.name,
        subtitle: [l.section, l.division].filter(Boolean).join(" · "),
        href: "/links",
      });
    }
  }

  for (const plan of plans) {
    if (full("budget")) break;
    if (norm(plan.name).includes(q)) {
      push({ id: `plan-${plan.id}`, group: "budget", title: plan.name, subtitle: "Rencana anggaran", href: "/budget" });
    }
    for (const item of plan.items) {
      if (`${norm(item.name)} ${norm(item.category)}`.includes(q)) {
        push({
          id: `item-${item.id}`,
          group: "budget",
          title: item.name,
          subtitle: `${item.category} · ${plan.name}`,
          href: "/budget",
        });
      }
    }
  }

  for (const r of rundown) {
    if (full("rundown")) break;
    if (`${norm(r.activity)} ${norm(r.keterangan)} ${norm(r.mc)} ${norm(r.operator)}`.includes(q)) {
      push({
        id: `rundown-${r.id}`,
        group: "rundown",
        title: r.activity || "(kegiatan kosong)",
        subtitle: [r.time_start && r.time_end ? `${r.time_start}–${r.time_end}` : null, r.mc].filter(Boolean).join(" · "),
        href: "/rundown",
      });
    }
  }

  for (const j of jobs) {
    if (full("jobs")) break;
    if (`${norm(j.job)} ${norm(j.pic)} ${norm(j.notes)}`.includes(q)) {
      push({ id: `job-${j.id}`, group: "jobs", title: j.job, subtitle: j.pic || "Hari-H", href: "/jobs" });
    }
  }

  for (const f of faqs) {
    if (full("faq")) break;
    if (`${norm(f.question)} ${norm(f.answer)}`.includes(q)) {
      push({ id: `faq-${f.id}`, group: "faq", title: f.question, subtitle: "FAQ", href: "/faq" });
    }
  }

  return hits;
}
