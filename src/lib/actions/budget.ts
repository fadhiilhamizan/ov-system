"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  updateBudgetItem, createBudgetItem, deleteBudgetItem,
  createBudgetPlan, deleteBudgetPlan,
} from "@/lib/data/repo";
import { budgetItemSchema, updateBudgetItemSchema, budgetPlanSchema, idSchema, parse } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses mengelola anggaran." };

export async function updateBudgetItemAction(
  itemId: string,
  patch: { qty?: number | null; unit_price?: number | null; name?: string; category?: string; unit?: string },
): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, itemId);
  if (!idv.ok) return idv;
  const v = parse(updateBudgetItemSchema, patch);
  if (!v.ok) return v;
  await updateBudgetItem(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createBudgetItemAction(
  planId: string,
  input: { category: string; name: string; qty?: number | null; unit?: string; unit_price?: number | null },
): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, planId);
  if (!idv.ok) return idv;
  const v = parse(budgetItemSchema, input);
  if (!v.ok) return v;
  await createBudgetItem(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBudgetItemAction(itemId: string): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, itemId);
  if (!idv.ok) return idv;
  await deleteBudgetItem(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createBudgetPlanAction(input: { name: string; event_id: string }): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const v = parse(budgetPlanSchema, input);
  if (!v.ok) return v;
  await createBudgetPlan(v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBudgetPlanAction(id: string): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteBudgetPlan(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
