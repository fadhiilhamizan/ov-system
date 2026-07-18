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

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses untuk ini." };

// ---------------- Events (Ormawa Visit) ----------------
export async function createEventAction(input: Partial<OVEvent>): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  if (!input.title?.trim()) return { ok: false, error: "Nama Ormawa Visit wajib diisi." };
  await createEvent(input);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateEventAction(id: string, patch: Partial<OVEvent>): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  await updateEvent(id, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteEventAction(id: string): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser())) return DENY;
  await deleteEvent(id);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------- Members ----------------
export async function createMemberAction(input: Partial<Member>): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  if (!input.name?.trim()) return { ok: false, error: "Nama anggota wajib diisi." };
  await createMember(input);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateMemberAction(id: string, patch: Partial<Member>): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  await updateMember(id, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteMemberAction(id: string): Promise<Result> {
  if (!can.manageMembers(await getCurrentUser())) return DENY;
  await deleteMember(id);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------- Divisions ----------------
export async function createDivisionAction(input: Partial<Division>): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  if (!input.name?.trim()) return { ok: false, error: "Nama divisi wajib diisi." };
  await createDivision(input);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateDivisionAction(key: string, patch: Partial<Division>): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  await updateDivision(key, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteDivisionAction(key: string): Promise<Result> {
  if (!can.manageDivisions(await getCurrentUser())) return DENY;
  await deleteDivision(key);
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
