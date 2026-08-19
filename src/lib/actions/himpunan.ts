"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEvent } from "@/lib/data/repo";
import {
  createCompareEntry, createFgdPlan, createFgdRow, deleteCompareEntry, deleteFgdPlan,
  deleteFgdRow, updateCompareEntry, updateFgdPlan, updateFgdRow,
} from "@/lib/data/himpunan-repo";
import type { CompareEntry, FgdPlan } from "@/lib/types";
import {
  compareEntrySchema, compareUpdateSchema, fgdPlanSchema, fgdPlanUpdateSchema,
  fgdRowUpdateSchema, idSchema, parse,
} from "./schemas";
import { archivedGuard, errMsg } from "./lock";

// ============================================================
// Menu Himpunan: plotting FGD + Compare.
//
// The module is "full" for admin/coordinator/staff and "view" for the rest, so
// every write here checks `can.manageHimpunan`. Deleting is the same level
// (the matrix gives those three roles "full"), so there is no separate
// `canDelete` split the way tasks and links need one.
// ============================================================

type Result = { ok: true } | { ok: false; error: string };

async function guard(eventId?: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageHimpunan(user)) {
    return { ok: false, error: "Kamu tidak punya akses mengubah data Himpunan." };
  }
  // An archived edition is read-only for everyone but admin, enforced in the
  // database too (writable_event in 0040's policies).
  if (eventId) {
    const blocked = await archivedGuard(user, eventId);
    if (blocked) return blocked;
  }
  return { ok: true };
}

// ---------------- FGD ----------------

export async function createFgdPlanAction(input: Partial<FgdPlan>): Promise<Result> {
  const v = parse(fgdPlanSchema, input);
  if (!v.ok) return v;
  const g = await guard(v.data.event_id);
  if (!g.ok) return g;
  try {
    await createFgdPlan(v.data);
  } catch (e) { return errMsg(e); }
  revalidatePath("/himpunan");
  return { ok: true };
}

export async function updateFgdPlanAction(id: string, patch: Partial<FgdPlan>): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(fgdPlanUpdateSchema, patch);
  if (!v.ok) return v;
  const g = await guard();
  if (!g.ok) return g;
  try {
    await updateFgdPlan(idv.data, v.data);
  } catch (e) { return errMsg(e); }
  revalidatePath("/himpunan");
  return { ok: true };
}

export async function deleteFgdPlanAction(id: string): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const g = await guard();
  if (!g.ok) return g;
  try {
    await deleteFgdPlan(idv.data);
  } catch (e) { return errMsg(e); }
  revalidatePath("/himpunan");
  return { ok: true };
}

export async function createFgdRowAction(planId: string): Promise<Result> {
  const idv = parse(idSchema, planId);
  if (!idv.ok) return idv;
  const g = await guard();
  if (!g.ok) return g;
  try {
    await createFgdRow(idv.data);
  } catch (e) { return errMsg(e); }
  revalidatePath("/himpunan");
  return { ok: true };
}

export async function updateFgdRowAction(
  id: string,
  patch: { ours?: string; theirs?: string },
): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(fgdRowUpdateSchema, patch);
  if (!v.ok) return v;
  const g = await guard();
  if (!g.ok) return g;
  try {
    await updateFgdRow(idv.data, v.data);
  } catch (e) { return errMsg(e); }
  revalidatePath("/himpunan");
  return { ok: true };
}

export async function deleteFgdRowAction(id: string): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const g = await guard();
  if (!g.ok) return g;
  try {
    await deleteFgdRow(idv.data);
  } catch (e) { return errMsg(e); }
  revalidatePath("/himpunan");
  return { ok: true };
}

// ---------------- Compare ----------------

export async function createCompareEntryAction(input: Partial<CompareEntry>): Promise<Result> {
  const v = parse(compareEntrySchema, input);
  if (!v.ok) return v;
  const g = await guard(v.data.event_id);
  if (!g.ok) return g;
  // Fail early on an edition that does not exist rather than leaving an
  // unreachable row behind a foreign key error.
  if (!(await getEvent(v.data.event_id))) {
    return { ok: false, error: "Ormawa Visit tidak ditemukan." };
  }
  try {
    await createCompareEntry({
      event_id: v.data.event_id,
      prospect_id: v.data.prospect_id ?? null,
      org_name: v.data.org_name ?? "",
      aspect: v.data.aspect ?? "",
      indicator: v.data.indicator ?? "",
      plus: v.data.plus ?? "",
      minus: v.data.minus ?? "",
    });
  } catch (e) { return errMsg(e); }
  revalidatePath("/himpunan");
  return { ok: true };
}

export async function updateCompareEntryAction(
  id: string,
  patch: Partial<CompareEntry>,
): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(compareUpdateSchema, patch);
  if (!v.ok) return v;
  const g = await guard();
  if (!g.ok) return g;
  try {
    await updateCompareEntry(idv.data, v.data);
  } catch (e) { return errMsg(e); }
  revalidatePath("/himpunan");
  return { ok: true };
}

export async function deleteCompareEntryAction(id: string): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const g = await guard();
  if (!g.ok) return g;
  try {
    await deleteCompareEntry(idv.data);
  } catch (e) { return errMsg(e); }
  revalidatePath("/himpunan");
  return { ok: true };
}
