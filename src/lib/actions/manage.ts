"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createEvent, updateEvent, deleteEvent, cloneEventData,
  createMember, updateMember, deleteMember, bulkDeleteMembers, bulkUpdateMembers,
  createDivision, updateDivision, deleteDivision, bulkDeleteDivisions, bulkUpdateDivisions,
  createTeam, updateTeam, deleteTeam,
} from "@/lib/data/repo";
import type { CloneOptions } from "@/lib/data/repo";
import type { Division, Member, OVEvent, Team } from "@/lib/types";
import { uid } from "@/lib/utils";
import { getActiveEvent } from "@/lib/session";
import { eventSchema, memberSchema, divisionSchema, teamSchema, idSchema, parse } from "./schemas";

export interface EventTemplate extends CloneOptions {
  sourceEventId: string;
}

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses untuk ini." };

// ---------------- Events (Ormawa Visit) ----------------
export async function createEventAction(
  input: Partial<OVEvent>,
  template?: EventTemplate,
): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  const v = parse(eventSchema, input);
  if (!v.ok) return v;
  // Generate the id up front so we can seed the new edition from a template.
  const id = uid("ov");
  await createEvent({ ...v.data, id });
  if (template?.sourceEventId) {
    const sv = parse(idSchema, template.sourceEventId);
    if (sv.ok) {
      await cloneEventData(sv.data, id, {
        divisions: !!template.divisions,
        members: !!template.members,
        tasks: !!template.tasks,
        rundown: !!template.rundown,
        jobs: !!template.jobs,
        budget: !!template.budget,
      });
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateEventAction(id: string, patch: Partial<OVEvent>): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(eventSchema.partial(), patch);
  if (!v.ok) return v;
  await updateEvent(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteEventAction(id: string): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteEvent(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------- Members ----------------
export async function createMemberAction(input: Partial<Member>): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  const v = parse(memberSchema, input);
  if (!v.ok) return v;
  await createMember(v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateMemberAction(id: string, patch: Partial<Member>): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(memberSchema.partial(), patch);
  if (!v.ok) return v;
  await updateMember(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteMemberAction(id: string): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteMember(idv.data);
  revalidatePath("/", "layout");
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
  await bulkDeleteMembers(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function bulkUpdateMembersAction(ids: string[], patch: Partial<Member>): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  const idv = parseIds(ids);
  if (!idv.ok) return idv;
  const v = parse(memberSchema.partial(), patch);
  if (!v.ok) return v;
  await bulkUpdateMembers(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------- Divisions ----------------
export async function createDivisionAction(input: Partial<Division>): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  const v = parse(divisionSchema, input);
  if (!v.ok) return v;
  // Divisions belong to the currently-active Ormawa Visit.
  const event = await getActiveEvent();
  await createDivision({ ...v.data, event_id: event.id });
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateDivisionAction(key: string, patch: Partial<Division>): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, key);
  if (!idv.ok) return idv;
  const v = parse(divisionSchema.partial(), patch);
  if (!v.ok) return v;
  const event = await getActiveEvent();
  await updateDivision(event.id, idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteDivisionAction(key: string): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, key);
  if (!idv.ok) return idv;
  const event = await getActiveEvent();
  await deleteDivision(event.id, idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function bulkDeleteDivisionsAction(keys: string[]): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  const idv = parseIds(keys);
  if (!idv.ok) return idv;
  const event = await getActiveEvent();
  await bulkDeleteDivisions(event.id, idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function bulkUpdateDivisionsAction(keys: string[], patch: Partial<Division>): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  const idv = parseIds(keys);
  if (!idv.ok) return idv;
  const v = parse(divisionSchema.partial(), patch);
  if (!v.ok) return v;
  const event = await getActiveEvent();
  await bulkUpdateDivisions(event.id, idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------- Teams (division structure) ----------------
export async function createTeamAction(input: Partial<Team>): Promise<Result> {
  if (!can.manageTeams(await getCurrentUser())) return DENY;
  const v = parse(teamSchema, input);
  if (!v.ok) return v;
  await createTeam(v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateTeamAction(id: string, patch: Partial<Team>): Promise<Result> {
  if (!can.manageTeams(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(teamSchema, patch);
  if (!v.ok) return v;
  await updateTeam(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteTeamAction(id: string): Promise<Result> {
  if (!can.manageTeams(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteTeam(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
