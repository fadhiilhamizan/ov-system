"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createEvent, updateEvent, deleteEvent,
  createMember, updateMember, deleteMember,
  createDivision, updateDivision, deleteDivision,
  createTeam, updateTeam, deleteTeam,
} from "@/lib/data/repo";
import type { Division, Member, OVEvent, Team } from "@/lib/types";
import { eventSchema, memberSchema, divisionSchema, idSchema, parse } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses untuk ini." };

// ---------------- Events (Ormawa Visit) ----------------
export async function createEventAction(input: Partial<OVEvent>): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  const v = parse(eventSchema, input);
  if (!v.ok) return v;
  await createEvent(v.data);
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

// ---------------- Divisions ----------------
export async function createDivisionAction(input: Partial<Division>): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  const v = parse(divisionSchema, input);
  if (!v.ok) return v;
  await createDivision(v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateDivisionAction(key: string, patch: Partial<Division>): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, key);
  if (!idv.ok) return idv;
  const v = parse(divisionSchema.partial(), patch);
  if (!v.ok) return v;
  await updateDivision(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteDivisionAction(key: string): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, key);
  if (!idv.ok) return idv;
  await deleteDivision(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------- Teams (division structure) ----------------
export async function createTeamAction(input: Partial<Team>): Promise<Result> {
  if (!can.manageTeams(await getCurrentUser())) return DENY;
  await createTeam(input);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateTeamAction(id: string, patch: Partial<Team>): Promise<Result> {
  if (!can.manageTeams(await getCurrentUser())) return DENY;
  await updateTeam(id, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteTeamAction(id: string): Promise<Result> {
  if (!can.manageTeams(await getCurrentUser())) return DENY;
  await deleteTeam(id);
  revalidatePath("/", "layout");
  return { ok: true };
}
