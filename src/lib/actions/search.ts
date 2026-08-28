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
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const user = await getCurrentUser();
  const event = await getActiveEvent();
  const allowed = (moduleKey: string) => can.accessModule(user, moduleKey);
  const hits: SearchHit[] = [];
  const push = (h: SearchHit) => {
    if (hits.filter((x) => x.group === h.group).length < MAX_PER_GROUP) hits.push(h);
  };

  const [tasks, divisions, members, events] = await Promise.all([
    allowed("tasks") ? getTasks({ event_id: event.id }) : [],
    allowed("divisions") ? getDivisions(event.id) : [],
    allowed("members") ? getMembers(event.id) : [],
    allowed("events") ? getEvents() : [],
  ]);

  for (const t of tasks) {
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

  if (allowed("prospects")) {
    for (const p of await getProspects(event.id)) {
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
  }

  if (allowed("links")) {
    for (const l of await getLinks(event.id)) {
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
  }

  if (allowed("budget")) {
    for (const plan of await getBudgetPlans(event.id)) {
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
  }

  if (allowed("rundown")) {
    for (const r of await getRundown(event.id)) {
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
  }

  if (allowed("jobs")) {
    for (const j of await getJobs(event.id)) {
      if (`${norm(j.job)} ${norm(j.pic)} ${norm(j.notes)}`.includes(q)) {
        push({ id: `job-${j.id}`, group: "jobs", title: j.job, subtitle: j.pic || "Hari-H", href: "/jobs" });
      }
    }
  }

  if (allowed("faq")) {
    for (const f of await getFaqs()) {
      if (`${norm(f.question)} ${norm(f.answer)}`.includes(q)) {
        push({ id: `faq-${f.id}`, group: "faq", title: f.question, subtitle: "FAQ", href: "/faq" });
      }
    }
  }

  return hits;
}
