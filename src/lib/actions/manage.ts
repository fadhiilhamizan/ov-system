"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { can, canToggleLock } from "@/lib/permissions";
import {
  createEvent, updateEvent, deleteEvent, setEventLocked, cloneEventData, getEvent,
  createMember, updateMember, deleteMember, bulkDeleteMembers, bulkUpdateMembers,
  createDivision, updateDivision, deleteDivision, bulkDeleteDivisions, bulkUpdateDivisions,
  createTeam, updateTeam, deleteTeam, getMembers, getDivisions, getBudgetPlans,
  getMember, renameMemberReferences, unseatCoordinator, detachDivisions,
} from "@/lib/data/repo";
import type { CloneFilters, CloneMode, CloneSources, Division, Member, OVEvent, Team } from "@/lib/types";
import { CLONE_MODULES } from "@/lib/types";
import { uid } from "@/lib/utils";
import { getActiveEvent } from "@/lib/session";
import {
  eventSchema, memberSchema, divisionSchema, teamSchema, cloneSourcesSchema, cloneFiltersSchema,
  cloneModeSchema, idSchema, parse,
} from "./schemas";
import { divisionFields, memberDivisions, memberRipple, withDivisionAdded } from "@/lib/members";
import { archivedGuard } from "./lock";

/** Keep the legacy primary `division` column in step with `divisions[]`. */
function withPrimaryDivision<T extends { divisions?: string[] }>(data: T) {
  return data.divisions ? { ...data, ...divisionFields(data.divisions) } : data;
}

/**
 * Carry one roster change into the places that name people as TEXT (task,
 * Hari-H and prospect PIC; team coordinator). See `memberRipple` for the rules
 * and docs/INTEGRATION.md for the map. Returns true when anything outside
 * `members` was written, so the caller knows to bust those routes too.
 */
async function applyRipple(before: Member, after: Member | null, roster: Member[], rename = true) {
  const eventId = before.event_id ?? null;
  // Only the people who share this member's edition can make a name
  // ambiguous; a namesake in another Ormawa Visit is never on the same task.
  const peers = roster.filter((m) => !eventId || !m.event_id || m.event_id === eventId);
  const ripple = memberRipple(before, after, peers);
  let touched = false;
  if (rename && ripple.rename) {
    touched = (await renameMemberReferences(eventId, ripple.rename.from, ripple.rename.to)) > 0;
  }
  if (ripple.unseat) {
    await unseatCoordinator(eventId, ripple.unseat.divisions, ripple.unseat.names);
    touched = true;
  }
  return touched;
}

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses untuk ini." };
/** Repo writes throw on a Supabase error (RLS denial, missing column, ...) -
 *  surface it instead of reporting a save that never happened. */
const errMsg = (e: unknown): Result => ({
  ok: false,
  error: e instanceof Error ? `Gagal menyimpan: ${e.message}` : "Gagal menyimpan data.",
});

// ---------------- Events (Ormawa Visit) ----------------
export async function createEventAction(
  input: Partial<OVEvent>,
  template?: CloneSources,
  filters?: CloneFilters,
): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  const v = parse(eventSchema, input);
  if (!v.ok) return v;
  const sources = cleanSources(template);
  if (sources && !sources.ok) return sources;
  // Generate the id up front so we can seed the new edition from a template.
  const id = uid("ov");
  try {
    await createEvent({ ...v.data, id });
    // A brand-new edition has nothing to replace, so `replace` stays off.
    if (sources) {
      const fv = parse(cloneFiltersSchema, filters ?? {});
      await cloneEventData(id, sources.data, { replace: false, filters: fv.ok ? fv.data : {} });
    }
  } catch (e) { return errMsg(e); }
  revalidateEntities("events");
  return { ok: true };
}

/** Drop menus with no source and reject a source id that isn't a plausible id.
 *  Returns null when nothing at all was selected. */
function cleanSources(
  input: CloneSources | undefined,
): { ok: true; data: CloneSources } | { ok: false; error: string } | null {
  if (!input) return null;
  const v = parse(cloneSourcesSchema, input);
  if (!v.ok) return v;
  const data: CloneSources = {};
  for (const mod of CLONE_MODULES) {
    const src = v.data[mod];
    if (src) data[mod] = src;
  }
  return Object.keys(data).length ? { ok: true, data } : null;
}

/**
 * Copy menus into an Ormawa Visit that already exists.
 *
 * Destructive by design: each chosen menu has the target's current rows deleted
 * and replaced by the source's. The dialog says so in as many words - without
 * the wipe a second copy would simply stack duplicates, which is the bug this
 * project has already paid for twice.
 */
export async function applyEventTemplateAction(
  targetId: string,
  template: CloneSources,
  mode: CloneMode = "replace",
  filters?: CloneFilters,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageEvents(user)) return DENY;
  const idv = parse(idSchema, targetId);
  if (!idv.ok) return idv;
  const sources = cleanSources(template);
  if (!sources) return { ok: false, error: "Pilih minimal satu menu untuk disalin." };
  if (!sources.ok) return sources;
  // Copying INTO an archived edition is still a write to that edition.
  const blocked = await archivedGuard(user, idv.data);
  if (blocked) return blocked;
  // A menu cannot be its own source: that would delete the rows and then read
  // them back from the hole it just made.
  for (const mod of CLONE_MODULES) {
    if (sources.data[mod] === idv.data) {
      return { ok: false, error: "Ormawa Visit tidak bisa menyalin dari dirinya sendiri." };
    }
  }
  try {
    const mv = parse(cloneModeSchema, mode);
    const fv = parse(cloneFiltersSchema, filters ?? {});
    await cloneEventData(idv.data, sources.data, {
      replace: (mv.ok ? mv.data : "replace") === "replace",
      filters: fv.ok ? fv.data : {},
    });
  } catch (e) { return errMsg(e); }
  revalidateEntities("events", "divisions", "members", "tasks", "rundown", "jobs", "budget", "prospects", "links");
  return { ok: true };
}

/** Archive an Ormawa Visit, or take it back out of the archive. Admin-only:
 *  once archived, no other role may change anything that belongs to it. */
export async function setEventLockedAction(id: string, locked: boolean): Promise<Result> {
  if (!canToggleLock(await getCurrentUser())) {
    return { ok: false, error: "Hanya admin yang bisa mengunci atau membuka arsip." };
  }
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  try { await setEventLocked(idv.data, !!locked); } catch (e) { return errMsg(e); }
  revalidateEntities("events");
  return { ok: true };
}
export async function updateEventAction(id: string, patch: Partial<OVEvent>): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(eventSchema.partial(), patch);
  if (!v.ok) return v;
  try { await updateEvent(idv.data, v.data); } catch (e) { return errMsg(e); }
  revalidateEntities("events");
  return { ok: true };
}
/** Copy an Ormawa Visit's metadata into a new draft (data is not cloned -
 *  use the template picker on create for that). */
export async function duplicateEventAction(id: string): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const ev = await getEvent(idv.data);
  if (!ev) return { ok: false, error: "Ormawa Visit tidak ditemukan." };
  const { id: _drop, order: _order, ...rest } = ev;
  void _drop; void _order;
  try { await createEvent({ ...rest, id: uid("ov"), title: `${ev.title} (salinan)`, status: "planning" }); } catch (e) { return errMsg(e); }
  revalidateEntities("events");
  return { ok: true };
}

export async function deleteEventAction(id: string): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  try { await deleteEvent(idv.data); } catch (e) { return errMsg(e); }
  revalidateEntities("events");
  return { ok: true };
}

// ---------------- Members ----------------
//
// NO archive guard here, and that is deliberate rather than an oversight.
// The other edition-scoped write paths (tasks, rundown, jobs, links,
// divisions) all call `archivedGuard`, and the ones that did not were real
// bugs. Here it would be unreachable code: `can.manageMembers` and
// `can.manageTeams` need level "full", which MODULE_ACCESS_LEVEL grants to
// admin alone, and `archivedGuard` returns null for admin on its first line -
// an admin may still correct an archived edition, which is the exception the
// lock is built around.
//
// If `members` ever moves to "limited" for another role, the guard belongs
// here AND a `writable_event()` clause belongs on the members policy: today
// that policy is admin-only with no edition clause, so the app half alone
// would not hold.
export async function createMemberAction(input: Partial<Member>): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  const v = parse(memberSchema, input);
  if (!v.ok) return v;
  // The edition comes from the session: `memberSchema` no longer accepts
  // `event_id` (see the note atop schemas.ts), and a member written without one
  // is unscoped, which every reader renders under EVERY Ormawa Visit.
  const event = await getActiveEvent();
  try { await createMember({ ...withPrimaryDivision(v.data), event_id: event.id }); } catch (e) { return errMsg(e); }
  revalidateEntities("members");
  return { ok: true };
}
export async function updateMemberAction(id: string, patch: Partial<Member>): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(memberSchema.partial(), patch);
  if (!v.ok) return v;
  const before = await getMember(idv.data);
  if (!before) return { ok: false, error: "Anggota tidak ditemukan." };
  // Read BEFORE the write: the ambiguity check needs everyone else's names.
  const roster = await getMembers(before.event_id ?? undefined);
  const data = withPrimaryDivision(v.data);
  let rippled = false;
  try {
    await updateMember(idv.data, data);
    rippled = await applyRipple(before, { ...before, ...data }, roster);
  } catch (e) { return errMsg(e); }
  if (rippled) revalidateEntities("members", "teams", "tasks", "jobs", "prospects");
  else revalidateEntities("members");
  return { ok: true };
}
export async function deleteMemberAction(id: string): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const before = await getMember(idv.data);
  const roster = before ? await getMembers(before.event_id ?? undefined) : [];
  try {
    await deleteMember(idv.data);
    // A deleted member cannot go on being listed as a division's coordinator.
    // Their name stays on the tasks they were PIC of (see memberRipple).
    if (before) await applyRipple(before, null, roster);
  } catch (e) { return errMsg(e); }
  revalidateEntities("members", "teams");
  return { ok: true };
}

/** Validate a list of row ids, returning the clean ids or the first error. */
function parseIds(ids: string[]): { ok: true; data: string[] } | { ok: false; error: string } {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Tidak ada yang dipilih." };
  const clean: string[] = [];
  for (const id of ids) {
    const v = parse(idSchema, id);
    if (!v.ok) return v;
    clean.push(v.data);
  }
  return { ok: true, data: clean };
}

export async function bulkDeleteMembersAction(ids: string[]): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  const idv = parseIds(ids);
  if (!idv.ok) return idv;
  const wanted = new Set(idv.data);
  const roster = await getMembers();
  const leaving = roster.filter((m) => wanted.has(m.id));
  // Everyone ELSE is the ambiguity reference: two leavers who share a name do
  // not protect each other's coordinator seat.
  const staying = roster.filter((m) => !wanted.has(m.id));
  try {
    await bulkDeleteMembers(idv.data);
    for (const m of leaving) await applyRipple(m, null, staying);
  } catch (e) { return errMsg(e); }
  revalidateEntities("members", "teams");
  return { ok: true };
}

export async function bulkUpdateMembersAction(ids: string[], patch: Partial<Member>): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  const idv = parseIds(ids);
  if (!idv.ok) return idv;
  const v = parse(memberSchema.partial(), patch);
  if (!v.ok) return v;
  const data = withPrimaryDivision(v.data);
  const wanted = new Set(idv.data);
  const roster = await getMembers();
  try {
    await bulkUpdateMembers(idv.data, data);
    // Bulk edits change divisions or type, never one person's name, so only
    // the coordinator half of the ripple applies.
    for (const m of roster.filter((x) => wanted.has(x.id))) {
      await applyRipple(m, { ...m, ...data }, roster, false);
    }
  } catch (e) { return errMsg(e); }
  revalidateEntities("members", "teams");
  return { ok: true };
}

/**
 * Put EXISTING members into a division.
 *
 * Distinct from `bulkUpdateMembersAction`, which REPLACES the whole divisions
 * array: that is right for "set these people's division", but wrong for
 * "also add them to Konsumsi" because it would strip every other division they
 * belong to. Here each member keeps what they had (see `withDivisionAdded`).
 */
export async function addMembersToDivisionAction(
  ids: string[],
  divisionKey: string,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageMembers(user)) return DENY;
  const idv = parseIds(ids);
  if (!idv.ok) return idv;
  const keyv = parse(idSchema, divisionKey);
  if (!keyv.ok) return keyv;

  const event = await getActiveEvent();
  const blocked = await archivedGuard(user, event.id);
  if (blocked) return blocked;

  const wanted = new Set(idv.data);
  const roster = (await getMembers(event.id)).filter((m) => wanted.has(m.id));
  try {
    for (const m of roster) {
      const next = withDivisionAdded(m, keyv.data);
      // Skip the write when nothing actually changes.
      if (next.join("\u0000") === memberDivisions(m).join("\u0000")) continue;
      await updateMember(m.id, divisionFields(next));
    }
  } catch (e) { return errMsg(e); }
  revalidateEntities("members", "teams");
  return { ok: true };
}

// ---------------- Divisions ----------------
/**
 * A division's `key` is what every other table points at (task, member,
 * team, rundown column, Super Link entry), and none of them follows a change.
 * The form never sends it, but `divisionSchema` accepts it for create, so an
 * update payload could carry one and orphan all of that at once. Renaming is
 * `name`/`short`; the key is fixed for the life of the division.
 */
function withoutKey<T extends { key?: string }>(data: T): Omit<T, "key"> {
  const { key: _key, ...rest } = data;
  void _key;
  return rest;
}

export async function createDivisionAction(input: Partial<Division>): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageDivisions(user)) return DENY;
  const v = parse(divisionSchema, input);
  if (!v.ok) return v;
  // Divisions belong to the currently-active Ormawa Visit.
  const event = await getActiveEvent();
  const blocked = await archivedGuard(user, event.id);
  if (blocked) return blocked;
  try { await createDivision({ ...v.data, event_id: event.id }); } catch (e) { return errMsg(e); }
  revalidateEntities("divisions");
  return { ok: true };
}
export async function updateDivisionAction(key: string, patch: Partial<Division>): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageDivisions(user)) return DENY;
  const idv = parse(idSchema, key);
  if (!idv.ok) return idv;
  const v = parse(divisionSchema.partial(), patch);
  if (!v.ok) return v;
  const event = await getActiveEvent();
  const blocked = await archivedGuard(user, event.id);
  if (blocked) return blocked;
  try { await updateDivision(event.id, idv.data, withoutKey(v.data)); } catch (e) { return errMsg(e); }
  revalidateEntities("divisions");
  return { ok: true };
}
export async function deleteDivisionAction(key: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageDivisions(user)) return DENY;
  const idv = parse(idSchema, key);
  if (!idv.ok) return idv;
  const event = await getActiveEvent();
  const blocked = await archivedGuard(user, event.id);
  if (blocked) return blocked;
  try {
    await deleteDivision(event.id, idv.data);
    await detachDivisions(event.id, [idv.data]);
  } catch (e) { return errMsg(e); }
  revalidateEntities("divisions", "members", "teams");
  return { ok: true };
}
export async function bulkDeleteDivisionsAction(keys: string[]): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageDivisions(user)) return DENY;
  const idv = parseIds(keys);
  if (!idv.ok) return idv;
  const event = await getActiveEvent();
  const blocked = await archivedGuard(user, event.id);
  if (blocked) return blocked;
  try {
    await bulkDeleteDivisions(event.id, idv.data);
    await detachDivisions(event.id, idv.data);
  } catch (e) { return errMsg(e); }
  revalidateEntities("divisions", "members", "teams");
  return { ok: true };
}
export async function bulkUpdateDivisionsAction(keys: string[], patch: Partial<Division>): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageDivisions(user)) return DENY;
  const idv = parseIds(keys);
  if (!idv.ok) return idv;
  const v = parse(divisionSchema.partial(), patch);
  if (!v.ok) return v;
  const event = await getActiveEvent();
  const blocked = await archivedGuard(user, event.id);
  if (blocked) return blocked;
  try { await bulkUpdateDivisions(event.id, idv.data, withoutKey(v.data)); } catch (e) { return errMsg(e); }
  revalidateEntities("divisions");
  return { ok: true };
}

// ---------------- Teams (division structure) ----------------
export async function createTeamAction(input: Partial<Team>): Promise<Result> {
  if (!can.manageTeams(await getCurrentUser())) return DENY;
  const v = parse(teamSchema, input);
  if (!v.ok) return v;
  // Scope from the session, same reason as createMemberAction.
  const event = await getActiveEvent();
  try { await createTeam({ ...v.data, event_id: event.id }); } catch (e) { return errMsg(e); }
  revalidateEntities("teams");
  return { ok: true };
}
export async function updateTeamAction(id: string, patch: Partial<Team>): Promise<Result> {
  if (!can.manageTeams(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(teamSchema, patch);
  if (!v.ok) return v;
  try { await updateTeam(idv.data, v.data); } catch (e) { return errMsg(e); }
  revalidateEntities("teams");
  return { ok: true };
}
export async function deleteTeamAction(id: string): Promise<Result> {
  if (!can.manageTeams(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  try { await deleteTeam(idv.data); } catch (e) { return errMsg(e); }
  revalidateEntities("teams");
  return { ok: true };
}

/**
 * Divisions and budget plans of a SOURCE edition, for the copy dialog's
 * per-menu narrowing (which divisions' work, which RAB plan).
 *
 * Fetched on demand rather than loaded for every edition up front: the events
 * page lists all editions, and eagerly reading each one's divisions and plans
 * would be a pile of queries for a dialog that is usually not even opened.
 */
export async function getCloneOptionsAction(
  eventId: string,
): Promise<{ divisions: { key: string; name: string }[]; plans: { id: string; name: string }[] }> {
  if (!can.manageEvents(await getCurrentUser())) return { divisions: [], plans: [] };
  const idv = parse(idSchema, eventId);
  if (!idv.ok) return { divisions: [], plans: [] };
  const [divisions, plans] = await Promise.all([getDivisions(idv.data), getBudgetPlans(idv.data)]);
  return {
    divisions: divisions.map((d) => ({ key: d.key, name: d.name })),
    plans: plans.map((p) => ({ id: p.id, name: p.name })),
  };
}
