import "server-only";
import { cache } from "react";
import { readRows } from "./read";
import { createClient } from "../supabase/server";
import { prospectStage } from "../constants";
import { effectiveStatus } from "../format";
import {
  divisionFields, memberDivisions, memberInDivision, removeFromRoster, renameInRoster,
} from "../members";
import { planTotal, primaryBudgetPlan } from "../budget";
import { uid } from "../utils";
import { normalizeRole } from "../auth";
import type {
  BudgetItem,
  CloneModule,
  CloneSources,
  Account,
  Broadcast,
  BroadcastRecipient,
  BroadcastWithStats,
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
  InboxMessage,
  RundownItem,
  Task,
  TaskLink,
  TaskLinkInput,
  TaskComment,
  TaskRef,
  TaskRefInput,
  TaskStatus,
  Team,
} from "../types";
import { CLONE_MODULES } from "../types";
import type { CloneFilters } from "../types";

// ------------------------------------------------------------------
// The repository. Everything here goes to Supabase.
//
// It used to be backend-agnostic: almost every function carried a guard that
// diverted to a parallel JSON implementation (data/local.ts, 959 lines, 82
// functions) whenever the environment was completely empty. That mode was
// removed in v1.42.0 - see AGENTS.md for why, and data/single-backend.test.ts
// for the guard that keeps it removed. Demo mode is a SEPARATE Supabase project
// and is unaffected; the per-request client (supabase/server.ts) routes to it.
// ------------------------------------------------------------------

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
 * A Supabase error on a write means the row did NOT change - almost always an
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

/**
 * Every READ goes through `readRows` (data/read.ts).
 *
 * The same reasoning as `must()`, one step earlier. A getter that destructures
 * `data` alone hands back an empty list for a lost connection, a revoked grant
 * or an expired token, and nothing downstream can tell that apart from an
 * edition that genuinely has nothing in it: the roster page said the roster was
 * empty, and Violet grounded an answer on it. `readRows` degrades ONLY for a
 * table this database has not migrated yet (the demo project is pinned below
 * 0040 on purpose) and throws for everything else, which the segment error
 * boundary turns into "this page failed to load, try again".
 */

/** Supabase returns NULL for empty text columns; coerce to "" so the UI
 *  (which calls .trim()/.toLowerCase()/.split()) never crashes. */
function coalesce<T>(rows: T[], keys: string[]): T[] {
  return rows.map((r) => {
    const o = { ...(r as Record<string, unknown>) };
    for (const k of keys) if (o[k] == null) o[k] = "";
    return o as T;
  });
}

/** Drop the embedded parent PostgREST returns alongside an `!inner` filter.
 *  The join is only there to narrow the query; the extra key would otherwise
 *  travel to the client on every row and change the shape callers expect. */
function dropEmbed<T>(rows: T[], key: string): T[] {
  return rows.map((r) => {
    const o = { ...(r as Record<string, unknown>) };
    delete o[key];
    return o as T;
  });
}

// NOTE: read getters are wrapped in React cache() so repeated calls within a
// single request (e.g. layout + page both need events/divisions) hit Supabase
// only once. Cache is keyed by primitive args.

// ---------------- Divisions ----------------
// Divisions are per-Ormawa-Visit. In Supabase mode this is a STRICT match on
// event_id (filtered in-query) so a row can never leak across OVs - after
// migration 0018 every division has an event_id. (The local/demo JSON store
// keeps a lenient match so its global seed still renders without a migration.)
export const getDivisions = cache(async (eventId?: string): Promise<Division[]> => {
  let q = (await sb()).from("divisions").select("*").order("order");
  if (eventId) q = q.eq("event_id", eventId);
  return readRows<Division[]>("divisions", q, []);
});
export const getDivision = cache(async (eventId: string, key: string): Promise<Division | null> => {
  const list = await getDivisions(eventId);
  return list.find((d) => d.key === key) ?? null;
});

// ---------------- Events ----------------
export const getEvents = cache(async (): Promise<OVEvent[]> => {
  return readRows<OVEvent[]>("events", (await sb()).from("events").select("*").order("order"), []);
});
export const getEvent = cache(async (id: string): Promise<OVEvent | null> => {
  return readRows<OVEvent | null>(
    "event",
    (await sb()).from("events").select("*").eq("id", id).maybeSingle(),
    null,
  );
});
/** Placeholder so a genuinely empty (or RLS-blocked) events table degrades to
 *  an empty-state UI instead of crashing on `event.id`. */
const EMPTY_EVENT: OVEvent = {
  id: "", code: "", title: "Belum ada Ormawa Visit", partner: "", campus: "",
  type: "internal", mode: "offline", cabinet: "", event_date: null,
  location: "", status: "planning", order: 0,
};

export const getDefaultEvent = cache(async (): Promise<OVEvent> => {
  const events = await getEvents();
  const active = events.find((e) => e.status === "active");
  if (active) return active;

  // Newest edition that actually has work in it. Asked one edition at a time,
  // newest first, stopping at the first hit: in practice that is a single query
  // returning a single row.
  //
  // It used to `select event_id` from the WHOLE tasks table and build a Set out
  // of it - every task row in the database, across every edition, shipped to
  // the server to answer a question about five ids. The worst case here (no
  // edition has any task) is one small query per edition, which only happens on
  // a fresh install where there are almost none.
  const client = await sb();
  for (let i = events.length - 1; i >= 0; i--) {
    const probe = await readRows<{ id: string }[]>(
      "active-event probe",
      client.from("tasks").select("id").eq("event_id", events[i].id).limit(1),
      [],
    );
    if (probe.length) return events[i];
  }
  return events[events.length - 1] ?? events[0] ?? EMPTY_EVENT;
});

// ---------------- Members ----------------
export const getMembers = cache(async (eventId?: string): Promise<Member[]> => {
  const data = await readRows<Member[]>("members", (await sb()).from("members").select("*"), []);
  // `divisions` is a text[] and comes back null on legacy rows - normalise it so
  // callers never have to null-check the array (see lib/members.ts).
  const list = coalesce(data, ["name", "nickname", "nrp"]).map((m) => ({
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
  let q = (await sb()).from("tasks").select("*").order("created_at", { ascending: true });
  if (filter.event_id) q = q.eq("event_id", filter.event_id);
  if (filter.division) q = q.eq("division", filter.division);
  if (filter.status) q = q.eq("status", filter.status);
  const rows = coalesce(await readRows<Task[]>("tasks", q, []), [
    "no", "pic", "start_raw", "end_raw", "notes", "result", "division",
  ]);
  return rows.map(withOvertime);
});
/**
 * Several tasks by id, in ONE query.
 *
 * The bulk actions used to do `Promise.all(ids.map(getTask))`, which is one
 * round trip per selected row: ticking a hundred tasks and pressing Delete
 * opened a hundred connections to read what a single `in` clause answers. The
 * write beneath it was already batched, which is what made the read easy to
 * miss.
 *
 * Unknown ids are simply absent from the result, exactly as the per-id version
 * returned null for them, so callers keep filtering the same way.
 */
export const getTasksByIds = cache(async (ids: readonly string[]): Promise<Task[]> => {
  if (!ids.length) return [];
  const rows = coalesce(
    await readRows<Task[]>("tasks by id", (await sb()).from("tasks").select("*").in("id", [...ids]), []),
    [
    "no", "pic", "start_raw", "end_raw", "notes", "result", "division",
  ]);
  return rows.map(withOvertime);
});

export const getTask = cache(async (id: string): Promise<Task | null> => {
  const data = await readRows<Task | null>(
    "task",
    (await sb()).from("tasks").select("*").eq("id", id).maybeSingle(),
    null,
  );
  return data ? withOvertime(data) : null;
});
export async function createTask(
  input: Partial<Task> & { event_id: string; division: Task["division"]; title: string },
): Promise<string | null> {
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
  await must((await sb()).from("tasks").update(patch).eq("id", id));
}
export async function deleteTask(id: string) {
  await must((await sb()).from("tasks").delete().eq("id", id));
}
export async function bulkUpdateTasks(ids: string[], patch: Partial<Task>) {
  if (!ids.length) return;
  await must((await sb()).from("tasks").update(patch).in("id", ids));
}
export async function bulkDeleteTasks(ids: string[]) {
  if (!ids.length) return;
  await must((await sb()).from("tasks").delete().in("id", ids));
}

// ---------------- Task result links ----------------
export const getTaskLinks = cache(async (taskId: string): Promise<TaskLink[]> => {
  const data = await readRows<TaskLink[]>(
    "task links",
    (await sb()).from("task_links").select("*").eq("task_id", taskId).order("order"),
    [],
  );
  return coalesce(data, ["url", "label"]);
});

/** All result links for an event's tasks, keyed by task id (one round trip). */
export const getTaskLinksByEvent = cache(async (eventId: string): Promise<Record<string, TaskLink[]>> => {
  // ONE query. This used to fetch the edition's ids first and then feed them
  // back as an `in` list, so every task page paid two round trips per child
  // table and sent every id over the wire twice. `!inner` makes the embedded
  // parent a join rather than a left join, so the filter actually narrows.
  const data = await readRows<TaskLink[]>(
    "task links by edition",
    (await sb())
      .from("task_links")
      .select("*, tasks!inner(event_id)")
      .eq("tasks.event_id", eventId)
      .order("order"),
    [],
  );
  const rows = coalesce(dropEmbed(data, "tasks"), ["url", "label"]);
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
  const client = await sb();
  const existing = await getTaskLinks(task.id);
  const keep = new Set(inputs.map((i) => i.id).filter(Boolean));

  // 1) Deletions. Independent of each other, so they go together: this was one
  // round trip per removed link, and with the Super Link row that is two.
  await Promise.all(
    existing
      .filter((ex) => !keep.has(ex.id))
      .map(async (ex) => {
        // Within ONE link the order still matters - the Super Link row is the
        // child's `link_id` target, so it goes first.
        if (ex.link_id) await deleteLink(ex.link_id);
        await must(client.from("task_links").delete().eq("id", ex.id));
      }),
  );

  // 2) Upserts. Also independent per link (each writes its own row, and `order`
  // is its position in the submitted array, not a running counter), so the
  // whole form saves in a couple of waves instead of three round trips per
  // link. `taskLinksSchema` caps this at 20, so the fan-out is bounded.
  await Promise.all(inputs.map(async (input, i) => {
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
  }));
}

/** Remove a task's Super Link rows before the task (and its task_links) go. */
export async function purgeTaskLinks(taskId: string) {
  const links = await getTaskLinks(taskId);
  for (const l of links) if (l.link_id) await deleteLink(l.link_id);
  // References go too, but nothing is deleted from Super Link for them: a
  // reference only POINTS at an entry that other tasks may also use.
  // In Supabase the FK cascade handles it; the local store has no FKs.
  await must((await sb()).from("task_links").delete().eq("task_id", taskId));
}

// ---------------- Task references ----------------
// Links a task USES. See the TaskRef type and migration 0037 for why this is
// not the same thing as task_links, and why one Super Link entry may be
// referenced by many tasks.
type RefRow = TaskRef & { links?: { url: string | null; name: string | null } | null };

/**
 * A reference picked from Super Link FOLLOWS that entry: its URL is read from
 * the entry itself, and an empty label falls back to the entry's name. The row
 * only stores a copy for the day the entry is deleted (the FK then nulls
 * `link_id` and the copy is all that is left). Before this, fixing a broken
 * URL in Super Link left every task that referenced it pointing at the broken
 * one, with nothing on screen to say so.
 */
function followLinkedRef({ links: live, ...ref }: RefRow): TaskRef {
  if (!live) return ref;
  return {
    ...ref,
    url: live.url || ref.url,
    label: ref.label || live.name || "",
  };
}

export const getTaskRefs = cache(async (taskId: string): Promise<TaskRef[]> => {
  const data = await readRows<RefRow[]>(
    "task refs",
    (await sb()).from("task_refs").select("*, links(url, name)").eq("task_id", taskId).order("order"),
    [],
  );
  return coalesce(data.map(followLinkedRef), ["url", "label"]);
});

/** All references for an event's tasks, keyed by task id (one round trip). */
export const getTaskRefsByEvent = cache(async (eventId: string): Promise<Record<string, TaskRef[]>> => {
  // ONE query. This used to fetch the edition's ids first and then feed them
  // back as an `in` list, so every task page paid two round trips per child
  // table and sent every id over the wire twice. `!inner` makes the embedded
  // parent a join rather than a left join, so the filter actually narrows.
  const data = await readRows<RefRow[]>(
    "task refs by edition",
    (await sb())
      .from("task_refs")
      .select("*, tasks!inner(event_id), links(url, name)")
      .eq("tasks.event_id", eventId)
      .order("order"),
    [],
  );
  const rows = coalesce(dropEmbed(data, "tasks").map(followLinkedRef), ["url", "label"]);
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

// ---------------- Task comments ----------------
// The per-task conversation shown in Work Breakdown (migration 0049). A row
// with `parent_id === null` is a thread root ("komentar inisiasi"); everything
// else is a reply to one. Ordered oldest-first so a thread reads like a chat.

export const getTaskComments = cache(async (taskId: string): Promise<TaskComment[]> => {
  const data = await readRows<TaskComment[]>(
    "task comments",
    (await sb()).from("task_comments").select("*").eq("task_id", taskId).order("created_at"),
    [],
  );
  return coalesce(data, ["body", "author_id", "author_name", "author_role", "resolved_by"]);
});

/** One row by id, or null. The actions need the parent task's edition (for the
 *  archive guard) and the author (for "may I delete this?"). */
export const getTaskComment = cache(async (id: string): Promise<TaskComment | null> => {
  const row = await readRows<TaskComment | null>(
    "task comment",
    (await sb()).from("task_comments").select("*").eq("id", id).maybeSingle(),
    null,
  );
  return row ? coalesce([row], ["body", "author_id", "author_name", "author_role", "resolved_by"])[0] : null;
});

/**
 * Every comment on an edition's tasks, keyed by task id (one round trip).
 *
 * Same `!inner` join as `getTaskRefsByEvent`: the embedded parent is a filter,
 * not data, so it is dropped before the rows travel to the client.
 */
export const getTaskCommentsByEvent = cache(
  async (eventId: string): Promise<Record<string, TaskComment[]>> => {
    const data = await readRows<TaskComment[]>(
      "task comments by edition",
      (await sb())
        .from("task_comments")
        .select("*, tasks!inner(event_id)")
        .eq("tasks.event_id", eventId)
        .order("created_at"),
      [],
    );
    const rows = coalesce(dropEmbed(data, "tasks"), [
      "body", "author_id", "author_name", "author_role", "resolved_by",
    ]);
    const byTask: Record<string, TaskComment[]> = {};
    for (const r of rows) (byTask[r.task_id] ??= []).push(r);
    return byTask;
  },
);

export interface TaskCommentRow {
  task_id: string;
  parent_id: string | null;
  body: string;
  author_id: string;
  author_name: string;
  author_role: string;
}

export async function createTaskComment(row: TaskCommentRow): Promise<string | null> {
  const data = await must(
    (await sb()).from("task_comments").insert(row).select("id").single(),
  );
  return (data as { id?: string } | null)?.id ?? null;
}

/** Tick / untick a thread as finished. Only a ROOT is ever passed here - the
 *  action refuses a reply, and a DB CHECK backs that up. */
export async function setTaskCommentResolved(id: string, resolved: boolean, by: string) {
  await must(
    (await sb())
      .from("task_comments")
      .update({
        resolved,
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: resolved ? by : "",
      })
      .eq("id", id),
  );
}

/** Delete one comment. A root takes its replies with it (ON DELETE CASCADE). */
export async function deleteTaskComment(id: string) {
  await must((await sb()).from("task_comments").delete().eq("id", id));
}

// ---------------- Inbox / broadcasts ----------------
// A broadcast is content (parent) plus one recipient row per account. See
// migration 0050 for why the recipient list is frozen at send time rather than
// re-derived from `audience` on every read.

/**
 * Every account that can receive a broadcast.
 *
 * Anonymous Tamu sessions are dropped: `handle_new_user` gives every auth user
 * a profile, including the throwaway identities behind the guest button, and a
 * message addressed to a session that no one will ever sign into again is
 * noise in the admin's picker and a wrong number in "sent to N accounts".
 * An account is real here if it has an email, which is exactly what an
 * anonymous sign-in lacks.
 */
export const getAccounts = cache(async (): Promise<Account[]> => {
  const data = await readRows<Account[]>(
    "accounts",
    (await sb()).from("profiles").select("id, name, email, role").order("name"),
    [],
  );
  return coalesce(data, ["name", "email"])
    .filter((a) => a.email.trim())
    // `profiles.role` menyimpan 'viewer', sedangkan seluruh aplikasi memakai
    // 'guest'. Tanpa pemetaan ini ROLE_META[a.role] undefined dan penyaringan
    // per peran tidak pernah cocok - gagalnya diam, bukan error.
    .map((a) => ({ ...a, role: normalizeRole(a.role) }))
    // Tamu tidak punya akses menu Kotak Masuk (lihat MODULE_ACCESS_LEVEL), jadi
    // mengirimi mereka siaran berarti menulis pesan ke kotak yang tidak bisa
    // dibuka siapa pun. Termasuk akun terdaftar yang perannya belum disetujui.
    .filter((a) => a.role !== "guest");
});

/** One account's inbox, newest first, with its own read state joined on. */
export const getInbox = cache(async (userId: string): Promise<InboxMessage[]> => {
  const rows = await readRows<(BroadcastRecipient & { broadcasts: Broadcast | null })[]>(
    "inbox",
    (await sb())
      .from("broadcast_recipients")
      .select("*, broadcasts!inner(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    [],
  );
  return rows
    .filter((r) => r.broadcasts)
    .map((r) => ({
      ...(r.broadcasts as Broadcast),
      roles: (r.broadcasts as Broadcast).roles ?? [],
      read_at: r.read_at,
    }));
});

/**
 * How many messages this account has not opened yet.
 *
 * A COUNT, not `getInbox().length`: this runs in the app shell on every single
 * navigation to draw the number on the menu, and shipping every message body
 * across the wire to length-check an array is the kind of cost that only shows
 * up once the inbox is big.
 */
export const getUnreadCount = cache(async (userId: string): Promise<number> => {
  const { count, error } = await (await sb())
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  // A table this database has not migrated yet is the one case that degrades
  // rather than throws, same rule as readRows - the badge is not worth taking
  // the whole shell down for.
  if (error) return 0;
  return count ?? 0;
});

/** Everything the admin sent, with how far each one got. */
export const getBroadcasts = cache(async (): Promise<BroadcastWithStats[]> => {
  const list = await readRows<Broadcast[]>(
    "broadcasts",
    (await sb()).from("broadcasts").select("*").order("created_at", { ascending: false }),
    [],
  );
  if (!list.length) return [];
  const recipients = await readRows<BroadcastRecipient[]>(
    "broadcast recipients",
    (await sb()).from("broadcast_recipients").select("broadcast_id, read_at"),
    [],
  );
  return coalesce(list, ["title", "body", "created_by", "created_by_name"]).map((b) => {
    const mine = recipients.filter((r) => r.broadcast_id === b.id);
    return {
      ...b,
      roles: b.roles ?? [],
      recipient_count: mine.length,
      read_count: mine.filter((r) => r.read_at).length,
    };
  });
});

export const getBroadcast = cache(async (id: string): Promise<Broadcast | null> => {
  const row = await readRows<Broadcast | null>(
    "broadcast",
    (await sb()).from("broadcasts").select("*").eq("id", id).maybeSingle(),
    null,
  );
  return row ? { ...row, roles: row.roles ?? [] } : null;
});

/** The account ids a broadcast was sent to, for re-opening the edit form. */
export const getBroadcastRecipientIds = cache(async (id: string): Promise<string[]> => {
  const rows = await readRows<{ user_id: string }[]>(
    "broadcast recipient ids",
    (await sb()).from("broadcast_recipients").select("user_id").eq("broadcast_id", id),
    [],
  );
  return rows.map((r) => r.user_id);
});

export interface BroadcastRow {
  title: string;
  body: string;
  audience: Broadcast["audience"];
  roles: string[];
  created_by: string;
  created_by_name: string;
}

export async function createBroadcast(row: BroadcastRow): Promise<string | null> {
  const data = await must(
    (await sb()).from("broadcasts").insert(row).select("id").single(),
  );
  return (data as { id?: string } | null)?.id ?? null;
}

export async function updateBroadcast(
  id: string,
  patch: Partial<BroadcastRow>,
): Promise<void> {
  await must(
    (await sb())
      .from("broadcasts")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id),
  );
}

export async function deleteBroadcast(id: string): Promise<void> {
  // Recipients go with it through ON DELETE CASCADE (0050).
  await must((await sb()).from("broadcasts").delete().eq("id", id));
}

/**
 * Make the recipient list exactly `userIds`.
 *
 * Re-targeting an edited broadcast must not resend it to people who already
 * had it: their row (and its read state) is left alone, only the difference is
 * written. Dropping everybody and re-inserting would mark every message unread
 * again, which reads to the recipient as a second message that never came.
 */
export async function syncBroadcastRecipients(broadcastId: string, userIds: string[]) {
  const client = await sb();
  const existing = await readRows<{ id: string; user_id: string }[]>(
    "broadcast recipients",
    client.from("broadcast_recipients").select("id, user_id").eq("broadcast_id", broadcastId),
    [],
  );
  const want = new Set(userIds);
  const have = new Set(existing.map((r) => r.user_id));

  const drop = existing.filter((r) => !want.has(r.user_id)).map((r) => r.id);
  if (drop.length) {
    await must(client.from("broadcast_recipients").delete().in("id", drop));
  }
  const add = userIds.filter((id) => !have.has(id));
  if (add.length) {
    await must(client.from("broadcast_recipients").insert(
      add.map((user_id) => ({ broadcast_id: broadcastId, user_id })),
    ));
  }
}

/** Mark one message read, or unread again. Scoped to the caller's own row. */
export async function setInboxRead(broadcastId: string, userId: string, read: boolean) {
  await must(
    (await sb())
      .from("broadcast_recipients")
      .update({ read_at: read ? new Date().toISOString() : null })
      .eq("broadcast_id", broadcastId)
      .eq("user_id", userId),
  );
}

/** Mark everything in this account's inbox as read. */
export async function markInboxAllRead(userId: string) {
  await must(
    (await sb())
      .from("broadcast_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null),
  );
}

// ---------------- Prospects ----------------
export const getProspects = cache(async (eventId?: string): Promise<Prospect[]> => {
  const data = await readRows<Prospect[]>("prospects", (await sb()).from("prospects").select("*"), []);
  const list = coalesce(data, [
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
  await must((await sb()).from("prospects").update({ is_primary: false }).eq("id", prospectId));
}
/** Returns the new row's id so the caller can attach its links (see
 *  `syncProspectLinks`). */
export async function createProspect(input: Partial<Prospect>): Promise<string | null> {
  const data = await must((await sb()).from("prospects").insert(stripId(input)).select("id").single());
  return (data as { id: string } | null)?.id ?? null;
}
export async function updateProspect(id: string, patch: Partial<Prospect>) {
  await must((await sb()).from("prospects").update(stripId(patch)).eq("id", id));
}
export async function deleteProspect(id: string) {
  await purgeProspectLinks(id);
  await must((await sb()).from("prospects").delete().eq("id", id));
}
export async function bulkDeleteProspects(ids: string[]) {
  if (!ids.length) return;
  for (const id of ids) await purgeProspectLinks(id);
  await must((await sb()).from("prospects").delete().in("id", ids));
}

// ---------------- Prospect links ----------------
// A prospect's own links (handbook, org profile, the proposal they sent back).
// One prospect, many links since 0038 - see the ProspectLink type.
export const getProspectLinks = cache(async (prospectId: string): Promise<ProspectLink[]> => {
  const data = await readRows<ProspectLink[]>(
    "prospect links",
    (await sb()).from("prospect_links").select("*").eq("prospect_id", prospectId).order("order"),
    [],
  );
  return coalesce(data, ["url", "label"]);
});

/** Every prospect link for an edition, keyed by prospect id (one round trip). */
export const getProspectLinksByEvent = cache(
  async (eventId: string): Promise<Record<string, ProspectLink[]>> => {
    // ONE query. This used to fetch the edition's ids first and then feed them
    // back as an `in` list, so every prospect page paid two round trips per child
    // table and sent every id over the wire twice. `!inner` makes the embedded
    // parent a join rather than a left join, so the filter actually narrows.
    const data = await readRows<ProspectLink[]>(
      "prospect links by edition",
      (await sb())
        .from("prospect_links")
        .select("*, prospects!inner(event_id)")
        .eq("prospects.event_id", eventId)
        .order("order"),
      [],
    );
    const rows = coalesce(dropEmbed(data, "prospects"), ["url", "label"]);
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
  const client = await sb();
  const existing = await getProspectLinks(prospect.id);
  const keep = new Set(inputs.map((i) => i.id).filter(Boolean));

  // 1) Deletions, together. Same reasoning as syncTaskLinks.
  await Promise.all(
    existing
      .filter((ex) => !keep.has(ex.id))
      .map(async (ex) => {
        if (ex.link_id) await deleteLink(ex.link_id);
        await must(client.from("prospect_links").delete().eq("id", ex.id));
      }),
  );

  // 2) Upserts, together. Capped at 20 by prospectLinksSchema.
  await Promise.all(inputs.map(async (input, i) => {
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
  }));
}

/** Remove a prospect's Super Link entries before the prospect itself goes.
 *  The `prospect_links` rows follow via the FK cascade in Supabase; the local
 *  store has no FKs, so it deletes them itself. */
async function purgeProspectLinks(id: string) {
  const links = await getProspectLinks(id);
  for (const l of links) if (l.link_id) await deleteLink(l.link_id);
}

// ---------------- Links ----------------
export const getLinks = cache(async (eventId?: string): Promise<LinkItem[]> => {
  const data = await readRows<LinkItem[]>("links", (await sb()).from("links").select("*"), []);
  const list = coalesce(data, ["section", "division", "name", "url", "note", "source"]);
  return eventId ? list.filter((l) => !l.event_id || l.event_id === eventId) : list;
});
/** Returns the new row's id so a task link can remember which Super Link row
 *  it owns (see syncTaskLinks). */
export async function createLink(input: Partial<LinkItem>): Promise<string | null> {
  const data = await must((await sb()).from("links").insert(stripId(input)).select("id").single());
  return (data as { id: string } | null)?.id ?? null;
}
export async function updateLink(id: string, patch: Partial<LinkItem>) {
  await must((await sb()).from("links").update(stripId(patch)).eq("id", id));
}
export async function deleteLink(id: string) {
  await must((await sb()).from("links").delete().eq("id", id));
}
export async function bulkDeleteLinks(ids: string[]) {
  if (!ids.length) return;
  await must((await sb()).from("links").delete().in("id", ids));
}

/** One Super Link entry by id, or null. */
export const getLink = cache(async (id: string): Promise<LinkItem | null> => {
  const data = await readRows<LinkItem | null>(
    "link", (await sb()).from("links").select("*").eq("id", id).maybeSingle(), null);
  return data ? coalesce([data], ["section", "division", "name", "url", "note", "source"])[0] : null;
});

/** The child tables that can OWN a Super Link entry (see AGENTS.md). */
const LINK_OWNERS = ["task_links", "prospect_links"] as const;

/**
 * An owned entry was edited from the Super Link page: carry the URL and name
 * back to the task result / prospect link that owns it.
 *
 * Without this the edit lasted only until the owner was next saved, which
 * rebuilds the entry from the owner's own copy and quietly puts the old URL
 * back. The owner's `label` becomes the entry's name, which is exactly what the
 * next sync would publish again, so the two stay in step from either side.
 */
export async function pushLinkToOwners(linkId: string, patch: { url?: string; name?: string }) {
  const row: Record<string, string> = {};
  if (patch.url !== undefined) row.url = patch.url;
  if (patch.name !== undefined) row.label = patch.name;
  if (!Object.keys(row).length) return;
  const client = await sb();
  for (const table of LINK_OWNERS) {
    await must(client.from(table).update(row).eq("link_id", linkId));
  }
}

/**
 * Owned entries are about to be deleted straight from the Super Link page:
 * untick "publish" on their owners first.
 *
 * The foreign key already nulls `link_id`, but it leaves `in_super_link` true,
 * so the task dialog went on saying "shown in Super Link" about an entry that
 * no longer existed, and the next save of that task silently published it
 * again. Deleting it from Super Link is a decision to unpublish; this records
 * it where the owner will see it.
 */
export async function releaseLinkOwners(linkIds: string[]) {
  if (!linkIds.length) return;
  const client = await sb();
  for (const table of LINK_OWNERS) {
    await must(client.from(table).update({ in_super_link: false }).in("link_id", linkIds));
  }
}

/**
 * Re-derive the published Super Link entries of some tasks from the tasks'
 * CURRENT division, title and edition.
 *
 * `syncTaskLinks` does this whenever the task dialog saves, but a task can
 * change without the dialog: the bulk editor re-files many tasks into another
 * division at once, and a published result stayed filed under the old
 * division in Super Link. Only the fields the task owns are rewritten; the
 * entry's name follows the task title only when the link has no label of its
 * own (the same rule `syncTaskLinks` uses).
 */
export async function refreshTaskSuperLinks(taskIds: string[]) {
  if (!taskIds.length) return;
  const client = await sb();
  const owned = await readRows<(TaskLink & { tasks: Pick<Task, "event_id" | "division" | "title"> })[]>(
    "published task links",
    client
      .from("task_links")
      .select("*, tasks!inner(event_id, division, title)")
      .in("task_id", taskIds)
      .eq("in_super_link", true)
      .not("link_id", "is", null),
    [],
  );
  for (const tl of owned) {
    const t = tl.tasks;
    await must(client.from("links").update({
      event_id: t.event_id,
      division: t.division,
      note: t.title,
      name: (tl.label ?? "").trim() || t.title,
    }).eq("id", tl.link_id!));
  }
}

// ---------------- Budget ----------------
export const getBudgetPlans = cache(async (eventId?: string): Promise<BudgetPlan[]> => {
  const client = await sb();
  // Filter plans at the DB (not in JS) so a single-event lookup doesn't scan
  // every event's budget, then fetch only those plans' items.
  let pq = client.from("budget_plans").select("*");
  if (eventId) pq = pq.eq("event_id", eventId);
  // `select("*")`, so a database that has not run 0048 yet simply returns rows
  // without `is_primary` rather than erroring on an unknown column - which is
  // why this can go through readRows without blanking the page on the demo
  // project. The flag is read defensively below for the same reason.
  const plans = await readRows<{ id: string; name: string; event_id: string; is_primary?: boolean }[]>(
    "budget plans", pq, [],
  );
  const planIds = plans.map((p) => p.id);
  const items = planIds.length
    ? await readRows<(BudgetItem & { plan_id: string })[]>(
        "budget items",
        client.from("budget_items").select("*").in("plan_id", planIds).order("order"),
        [],
      )
    : [];
  const list = plans.map((p) => ({
    id: p.id,
    name: p.name,
    event_id: p.event_id,
    is_primary: !!p.is_primary,
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
  // No second filter: the plans query above is already `.eq("event_id", …)`
  // when an edition is given, so this re-checked what it had just narrowed.
  return list;
});
export async function updateBudgetItem(
  itemId: string,
  patch: {
    qty?: number | null; unit_price?: number | null; name?: string; category?: string;
    unit?: string; category_color?: string | null;
  },
) {
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
/** Recolour a whole category at once - the dot is a property of the category,
 *  not of one row, so every item in that plan+category moves together. */
export async function setCategoryColor(planId: string, category: string, color: string) {
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
  const client = await sb();
  // "order" comes from a sequence default (migration 0044) rather than a
  // max()+1 read: two people adding at the same moment used to read the same
  // number and write it twice. Gaps do not matter, the column is only sorted on.
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
  });
  if (error) throw new Error(error.message);
}
export async function deleteBudgetItem(itemId: string) {
  await must((await sb()).from("budget_items").delete().eq("id", itemId));
}
export async function bulkDeleteBudgetItems(ids: string[]) {
  if (!ids.length) return;
  await must((await sb()).from("budget_items").delete().in("id", ids));
}
/**
 * Rewrite `order` across a whole plan after a drag.
 *
 * The caller sends the plan's COMPLETE item sequence, not just the dragged
 * pair: category grouping in the UI is derived from this order, so a partial
 * rewrite would leave the untouched items interleaved at stale positions.
 */
/**
 * Rewrite an ordering column for a whole list, in ONE statement.
 *
 * Dragging one row submits the complete new sequence, and this used to be sent
 * as one UPDATE per row: an eighty-item RAB meant eighty parallel HTTP requests
 * for a single drag, any of which could fail on its own and leave the list
 * half-renumbered. `reorder_rows()` (migration 0044) does it with a single
 * `update ... from unnest(ids) with ordinality`, so it is also atomic.
 *
 * `kind` names a BEHAVIOUR, not a table: the function has a branch per list and
 * no caller-supplied identifier ever reaches SQL. Each branch owns its own
 * numbering (budget items are 0-based, FAQs 1-based, Hari-H writes text into
 * `no`), which is why the offsets are not a parameter.
 */
export type ReorderKind = "budget_items" | "faqs" | "job_harih" | "fgd_rows";

export async function reorderVia(kind: ReorderKind, orderedIds: string[]) {
  const { error } = await (await sb()).rpc("reorder_rows", { kind, ids: orderedIds });
  if (error) throw new Error(error.message);
}

export async function reorderBudgetItems(orderedIds: string[]) {
  if (!orderedIds.length) return;
  await reorderVia("budget_items", orderedIds);
}

/**
 * Move one item into another category, and renumber the whole plan with it.
 *
 * Both halves in ONE transaction (`move_budget_item`, migration 0047). The
 * category headings in the RAB table are DERIVED from item order, so a failure
 * between the two writes would leave the item wearing the new category name
 * while still sitting among the old one's rows, and the table would print that
 * category twice. The dot colour is settled in the same statement for the same
 * reason: it belongs to the category, not to the row that just arrived.
 */
export async function moveBudgetItem(itemId: string, category: string, orderedIds: string[]) {
  const { error } = await (await sb()).rpc("move_budget_item", {
    p_item_id: itemId,
    p_category: category,
    p_ids: orderedIds,
  });
  if (error) throw new Error(error.message);
}
export async function createBudgetPlan(input: { name: string; event_id: string }) {
  const client = await sb();
  // The FIRST plan of an edition is its main one: with one plan there is no
  // choice to make, and making somebody press a button to say so would be a
  // ritual. Later plans arrive unmarked, so adding "RAB Maksimal" beside the
  // one already in use never silently moves what Dashboard reports.
  const existing = await readRows<{ id: string }[]>(
    "budget plan count",
    client.from("budget_plans").select("id").eq("event_id", input.event_id).limit(1),
    [],
  );
  await must(client.from("budget_plans").insert({
    name: input.name,
    event_id: input.event_id,
    is_primary: existing.length === 0,
  }));
}

/**
 * Make one plan its edition's main one, clearing whichever held it before.
 *
 * Two statements rather than an RPC, and the order matters: the partial unique
 * index (0048) forbids two primaries at once, so the old one is released first.
 * Same shape as `setPrimaryProspect`. A failure between the two leaves the
 * edition with NO marked plan, which is a state the app already handles -
 * `primaryBudgetPlan` falls back to the largest plan - rather than a corrupt
 * one, which is why this does not need the transactional treatment
 * `move_budget_item` got.
 */
export async function setPrimaryBudgetPlan(planId: string) {
  const client = await sb();
  const plan = await must(
    client.from("budget_plans").select("id, event_id").eq("id", planId).maybeSingle(),
  ) as { id: string; event_id: string | null } | null;
  if (!plan) throw new Error("Rencana anggaran tidak ditemukan.");
  if (plan.event_id) {
    await must(client.from("budget_plans").update({ is_primary: false })
      .eq("event_id", plan.event_id).eq("is_primary", true));
  }
  await must(client.from("budget_plans").update({ is_primary: true }).eq("id", planId));
}
export async function deleteBudgetPlan(id: string) {
  await must((await sb()).from("budget_plans").delete().eq("id", id));
}

// ---------------- Rundown ----------------
export const getRundown = cache(async (eventId?: string, variant?: string): Promise<RundownItem[]> => {
  let q = (await sb()).from("rundown").select("*").order("no");
  if (eventId) q = q.eq("event_id", eventId);
  if (variant) q = q.eq("variant", variant);
  const rows = coalesce(await readRows<RundownItem[]>("rundown", q, []), [
    "variant", "time_start", "time_end", "duration", "activity", "keterangan", "mc", "operator",
    "host", "opr_link", "job_lo", "job_event", "job_consump", "job_creative", "job_opr",
  ]);
  // division_jobs is jsonb - ensure it's always a plain object.
  return rows.map((r) => ({
    ...r,
    division_jobs: r.division_jobs && typeof r.division_jobs === "object" ? r.division_jobs : {},
    // `merges` is jsonb too, and every reader indexes into it without checking.
    merges: r.merges && typeof r.merges === "object" ? r.merges : {},
  }));
});

// ---------------- Jobs ----------------
export const getJobs = cache(async (eventId?: string): Promise<JobHariH[]> => {
  let q = (await sb()).from("job_harih").select("*");
  if (eventId) q = q.eq("event_id", eventId);
  return coalesce(await readRows<JobHariH[]>("jobs", q, []), ["no", "pic", "job", "notes"]);
});

// ---------------- FAQ ----------------
export const getFaqs = cache(async (): Promise<Faq[]> => {
  return readRows<Faq[]>("faqs", (await sb()).from("faqs").select("*").order("order"), []);
});
export async function createFaq(input: { question: string; answer: string }) {
  // No max("order") lookup: the column defaults to a sequence (migration 0044).
  // Two people adding a FAQ at the same moment used to read the same max and
  // write the same number; the sequence hands out distinct increasing values
  // atomically. Gaps are fine - the column is only ever sorted on.
  await must((await sb()).from("faqs").insert({
    question: input.question,
    answer: input.answer,
  }));
}
export async function updateFaq(id: string, patch: { question?: string; answer?: string }) {
  await must((await sb()).from("faqs").update(patch).eq("id", id));
}
export async function deleteFaq(id: string) {
  await must((await sb()).from("faqs").delete().eq("id", id));
}
/** Rewrite `order` to match the given sequence (same shape as reorderJobs). */
export async function reorderFaqs(orderedIds: string[]) {
  if (!orderedIds.length) return;
  await reorderVia("faqs", orderedIds);
}

// ---------------- Teams ----------------
export const getTeams = cache(async (eventId?: string): Promise<Team[]> => {
  let q = (await sb()).from("teams").select("*");
  if (eventId) q = q.eq("event_id", eventId);
  return coalesce(await readRows<Team[]>("teams", q, []),
    ["division", "coordinator", "fungsionaris", "intern"]);
});

// ---------------- Role requests ----------------
// RLS already narrows SELECT to "mine, or everything if admin", so the plain
// list is safe to expose; `getRoleRequestsFor` is the explicit self-lookup.
export const getRoleRequests = cache(async (): Promise<RoleRequest[]> => {
  const data = await readRows<RoleRequest[]>(
    "role requests",
    (await sb()).from("role_requests").select("*").order("created_at", { ascending: false }),
    [],
  );
  return coalesce(data, ["name", "email", "message"]);
});

export const getRoleRequestsFor = cache(async (userId: string): Promise<RoleRequest[]> => {
  const data = await readRows<RoleRequest[]>(
    "my role requests",
    (await sb())
      .from("role_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    [],
  );
  return coalesce(data, ["name", "email", "message"]);
});

export async function createRoleRequest(
  input: Omit<RoleRequest, "id" | "status" | "created_at">,
): Promise<void> {
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
 *  `status=pending` filter is belt-and-braces on top of RLS - a decided request
 *  must never be rewritten. */
export async function updateRoleRequest(
  id: string,
  patch: { requested_role?: RoleRequest["requested_role"]; message?: string },
): Promise<void> {
  const { error } = await (await sb())
    .from("role_requests")
    .update(patch)
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

/** Approve (grant the role) or ignore a request. In Supabase this goes through
 *  the SECURITY DEFINER `decide_role_request` RPC - profiles.role is not
 *  directly writable by design (see migration 0020/0023). */
export async function decideRoleRequest(id: string, approve: boolean): Promise<void> {
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

/**
 * What this edition plans to spend: its MAIN plan's total, not every plan added
 * together.
 *
 * Summing them was wrong in a way that got worse the more carefully the budget
 * was prepared: "RAB Minimal" and "RAB Maksimal" are two scenarios for the same
 * money, so an edition with both reported roughly double what it would ever
 * spend, and drafting a third scenario made the Dashboard figure grow again.
 * `primaryBudgetPlan` decides which plan that is.
 */
export async function budgetTotal(eventId?: string) {
  const plan = primaryBudgetPlan(await getBudgetPlans(eventId));
  return plan ? planTotal(plan) : 0;
}

// helper: drop client-only id before insert/update
function stripId<T extends { id?: string }>(obj: T) {
  const { id, ...rest } = obj;
  void id;
  return rest;
}

// ================= CRUD: events / members / divisions / teams =================
export async function createEvent(input: Partial<OVEvent>) {
  const client = await sb();
  const id = input.id ?? uid("ov");
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
    // Only when the caller states one - cloning an edition copies the source
    // order deliberately. Otherwise the sequence default assigns it.
    ...(input.order != null ? { order: input.order } : {}),
  }));
}
export async function updateEvent(id: string, patch: Partial<OVEvent>) {
  const { id: _drop, ...rest } = patch;
  void _drop;
  await must((await sb()).from("events").update(rest).eq("id", id));
}
/**
 * Delete an edition AND everything that belongs to it.
 *
 * Most edition tables cascade in the database, but members, links, prospects
 * and budget_plans were ON DELETE SET NULL until 0051 - and every reader treats
 * a null `event_id` as "belongs to every edition". Deleting one Ormawa Visit
 * used to pour its whole roster, prospect list and Super Link into all the
 * others. These four are deleted here explicitly, before the event, so the
 * outcome does not depend on whether this database has run 0051 (the demo
 * project never will). Prospect links, budget items and published task/prospect
 * Super Link rows go with their parents.
 */
export async function deleteEvent(id: string) {
  const client = await sb();
  for (const table of ["prospects", "links", "members", "budget_plans"] as const) {
    await must(client.from(table).delete().eq("event_id", id));
  }
  await must(client.from("events").delete().eq("id", id));
}

/** Archive an Ormawa Visit (or take it back out of the archive). Admin-only -
 *  enforced by the `events_write` policy and `writable_event()` in 0028. */
export async function setEventLocked(id: string, locked: boolean) {
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
      // Comments (0049) are NOT copied, on purpose and by omission: a copied
      // task is a fresh plan with its progress reset, and a revision request
      // from last edition's execution would arrive already answered - or
      // worse, raise a notification on a task nobody has started.
      if (rows.length) await must(client.from("tasks").insert(rows));
    }

    if (mod === "rundown") {
      const src = await getRundown(sourceId);
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
  const div = divisionFields(input.divisions, input.division);
  // Writes THROW on a Supabase error (RLS denial, missing column, ...): swallowing
  // it made a failed save look successful and wrote nothing - the actions turn
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
  const { id: _drop, ...rest } = patch;
  void _drop;
  const { error } = await (await sb()).from("members").update(rest).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteMember(id: string) {
  const { error } = await (await sb()).from("members").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
export async function bulkDeleteMembers(ids: string[]) {
  if (!ids.length) return;
  const { error } = await (await sb()).from("members").delete().in("id", ids);
  if (error) throw new Error(error.message);
}
export async function bulkUpdateMembers(ids: string[], patch: Partial<Member>) {
  if (!ids.length) return;
  const { id: _drop, ...rest } = patch;
  void _drop;
  const { error } = await (await sb()).from("members").update(rest).in("id", ids);
  if (error) throw new Error(error.message);
}

/** One member by id, or null. Read before an edit so the knock-on writes can
 *  compare the old name and divisions with the new ones. */
export const getMember = cache(async (id: string): Promise<Member | null> => {
  const data = await readRows<Member | null>(
    "member", (await sb()).from("members").select("*").eq("id", id).maybeSingle(), null);
  if (!data) return null;
  const [m] = coalesce([data], ["name", "nickname", "nrp"]);
  return { ...m, divisions: m.divisions ?? (m.division ? [m.division] : []) };
});

/** The by-name roster fields: each table, its text column, and whether it is
 *  scoped by `event_id` directly. */
const NAME_FIELDS = [
  { table: "tasks", column: "pic" },
  { table: "job_harih", column: "pic" },
  { table: "prospects", column: "pic" },
  { table: "teams", column: "coordinator" },
] as const;

/**
 * Carry a member's new display name into every field that stores people by
 * name (task PIC, Hari-H PIC, prospect PIC, team coordinator), within the
 * member's edition. `from`/`to` come from `memberRipple`, which has already
 * dropped any name another member also answers to. Returns how many rows
 * changed.
 *
 * `eventId === null` is a legacy unscoped member, who is shown under every
 * edition, so the rename applies everywhere.
 */
export async function renameMemberReferences(
  eventId: string | null,
  from: string[],
  to: string,
): Promise<number> {
  const client = await sb();
  let changed = 0;
  for (const { table, column } of NAME_FIELDS) {
    let q = client.from(table).select(`id, ${column}`).neq(column, "");
    if (eventId) q = q.eq("event_id", eventId);
    const rows = await readRows<Record<string, string>[]>(`${table} names`, q, []);
    for (const row of rows) {
      const next = renameInRoster(row[column], from, to);
      if (next === null) continue;
      await must(client.from(table).update({ [column]: next }).eq("id", row.id));
      changed++;
    }
  }
  return changed;
}

/**
 * Take a person off the coordinator line of some (or all) divisions of an
 * edition. Used when a member leaves a division, becomes an intern, or is
 * deleted - see `memberRipple`.
 */
export async function unseatCoordinator(
  eventId: string | null,
  divisions: string[] | "all",
  names: string[],
) {
  if (divisions !== "all" && !divisions.length) return;
  const client = await sb();
  let q = client.from("teams").select("id, division, coordinator").neq("coordinator", "");
  if (eventId) q = q.eq("event_id", eventId);
  if (divisions !== "all") q = q.in("division", divisions);
  const rows = await readRows<{ id: string; coordinator: string }[]>("team coordinators", q, []);
  for (const row of rows) {
    const next = removeFromRoster(row.coordinator, names);
    if (next !== null) await must(client.from("teams").update({ coordinator: next }).eq("id", row.id));
  }
}

/**
 * What deleting divisions leaves behind, cleaned up: the key is removed from
 * every member's `divisions` (their primary moves to the next one they have),
 * and the division's team row - its coordinator line - goes with it.
 *
 * Tasks are deliberately NOT touched. They keep their division key and lose
 * only the badge; deleting or re-filing a division's whole work history as a
 * side effect of tidying the division list is the user's call, not this one's.
 */
export async function detachDivisions(eventId: string, keys: string[]) {
  if (!keys.length) return;
  const client = await sb();
  const gone = new Set(keys);
  const rows = await readRows<Pick<Member, "id" | "division" | "divisions">[]>(
    "members in division",
    client.from("members").select("id, division, divisions").eq("event_id", eventId),
    [],
  );
  for (const m of rows) {
    const current = memberDivisions(m);
    if (!current.some((d) => gone.has(d))) continue;
    await must(client.from("members")
      .update(divisionFields(current.filter((d) => !gone.has(d))))
      .eq("id", m.id));
  }
  await must(client.from("teams").delete().eq("event_id", eventId).in("division", keys));
}

export async function createDivision(input: Partial<Division>) {
  const client = await sb();
  // "order" comes from a sequence default (migration 0044) rather than a
  // max()+1 read: two people adding at the same moment used to read the same
  // number and write it twice. Gaps do not matter, the column is only sorted on.
  //
  // The numbering is no longer per-event, and does not need to be: divisions
  // are only ever SORTED by it inside one edition, so a shared sequence keeps
  // the relative order right while dropping the per-event max() lookup.
  await must(client.from("divisions").insert({
    event_id: input.event_id ?? null,
    key: input.key ?? uid("DIV").toUpperCase(),
    name: input.name ?? "",
    short: input.short ?? "",
    color: input.color ?? "#6366f1",
    ...(input.order != null ? { order: input.order } : {}),
    exclude_from_rundown: input.exclude_from_rundown ?? false,
  }));
}
export async function updateDivision(eventId: string, key: string, patch: Partial<Division>) {
  const { id: _i, event_id: _e, ...rest } = patch;
  void _i; void _e;
  await must((await sb()).from("divisions").update(rest).eq("event_id", eventId).eq("key", key));
}
export async function deleteDivision(eventId: string, key: string) {
  await must((await sb()).from("divisions").delete().eq("event_id", eventId).eq("key", key));
}
export async function bulkDeleteDivisions(eventId: string, keys: string[]) {
  if (!keys.length) return;
  await must((await sb()).from("divisions").delete().eq("event_id", eventId).in("key", keys));
}
export async function bulkUpdateDivisions(eventId: string, keys: string[], patch: Partial<Division>) {
  if (!keys.length) return;
  const { id: _i, event_id: _e, ...rest } = patch;
  void _i; void _e;
  await must((await sb()).from("divisions").update(rest).eq("event_id", eventId).in("key", keys));
}

export async function createTeam(input: Partial<Team>) {
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
  const { id: _drop, ...rest } = patch;
  void _drop;
  const { error } = await (await sb()).from("teams").update(rest).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteTeam(id: string) {
  await must((await sb()).from("teams").delete().eq("id", id));
}

// ================= CRUD: rundown / jobs =================
export async function createRundown(input: Partial<RundownItem>) {
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
  const client = await sb();
  // This read FEEDS the write below, so a swallowed error here does not show an
  // empty cell, it erases one: `current` would fall back to {} and the update
  // would replace every other division's job on this row with nothing.
  const data = await readRows<{ division_jobs: unknown } | null>(
    "rundown division jobs",
    client.from("rundown").select("division_jobs").eq("id", id).maybeSingle(),
    null,
  );
  const current =
    data?.division_jobs && typeof data.division_jobs === "object" ? data.division_jobs : {};
  await must(
    client.from("rundown").update({ division_jobs: { ...current, [division]: value } }).eq("id", id),
  );
}

export async function deleteRundown(id: string) {
  await must((await sb()).from("rundown").delete().eq("id", id));
}

export async function createJob(input: Partial<JobHariH>) {
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
  const { id: _d, ...rest } = patch;
  void _d;
  await must((await sb()).from("job_harih").update(rest).eq("id", id));
}
export async function deleteJob(id: string) {
  await must((await sb()).from("job_harih").delete().eq("id", id));
}
/** Persist a new order for Hari-H jobs: each id gets its 1-based `no`. */
export async function reorderJobs(orderedIds: string[]) {
  if (!orderedIds.length) return;
  await reorderVia("job_harih", orderedIds);
}
