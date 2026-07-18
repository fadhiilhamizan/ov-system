"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  updateBudgetItem, createBudgetItem, deleteBudgetItem,
  createBudgetPlan, deleteBudgetPlan,
} from "@/lib/data/repo";

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses mengelola anggaran." };

export async function updateBudgetItemAction(
  itemId: string,
  patch: { qty?: number | null; unit_price?: number | null; name?: string; category?: string; unit?: string },
): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  await updateBudgetItem(itemId, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createBudgetItemAction(
  planId: string,
  input: { category: string; name: string; qty?: number | null; unit?: string; unit_price?: number | null },
): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  if (!input.name?.trim()) return { ok: false, error: "Nama item wajib diisi." };
  await createBudgetItem(planId, input);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBudgetItemAction(itemId: string): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  await deleteBudgetItem(itemId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createBudgetPlanAction(input: { name: string; event_id: string }): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  if (!input.name?.trim()) return { ok: false, error: "Nama rencana anggaran wajib diisi." };
  await createBudgetPlan(input);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBudgetPlanAction(id: string): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  await deleteBudgetPlan(id);
  revalidatePath("/", "layout");
  return { ok: true };
}
