"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  updateBudgetItem, createBudgetItem, deleteBudgetItem, bulkDeleteBudgetItems,
  createBudgetPlan, deleteBudgetPlan, getBudgetPlans, setCategoryColor,
} from "@/lib/data/repo";
import { budgetItemSchema, updateBudgetItemSchema, budgetPlanSchema, idSchema, parse } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses mengelola anggaran." };
/** Repo writes throw on a Supabase error — surface it rather than
 *  reporting a save that never happened. */
const errMsg = (e: unknown): Result => ({
  ok: false,
  error: e instanceof Error ? `Gagal menyimpan: ${e.message}` : "Gagal menyimpan anggaran.",
});

export async function updateBudgetItemAction(
  itemId: string,
  patch: {
    qty?: number | null; unit_price?: number | null; name?: string; category?: string;
    unit?: string; category_color?: string | null;
  },
): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, itemId);
  if (!idv.ok) return idv;
  const v = parse(updateBudgetItemSchema, patch);
  if (!v.ok) return v;
  try { await updateBudgetItem(idv.data, v.data); } catch (e) { return errMsg(e); }
  revalidateEntities("budget");
  return { ok: true };
}

export async function createBudgetItemAction(
  planId: string,
  input: {
    category: string; name: string; qty?: number | null; unit?: string;
    unit_price?: number | null; category_color?: string | null;
  },
): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, planId);
  if (!idv.ok) return idv;
  const v = parse(budgetItemSchema, input);
  if (!v.ok) return v;
  try {
    await createBudgetItem(idv.data, v.data);
    // The dot colour belongs to the CATEGORY: apply it to the rows that were
    // already in it, otherwise one category would show two different dots.
    if (v.data.category_color) await setCategoryColor(idv.data, v.data.category, v.data.category_color);
  } catch (e) { return errMsg(e); }
  revalidateEntities("budget");
  return { ok: true };
}

/** Recolour an existing category from the item dialog / category chip. */
export async function setCategoryColorAction(
  planId: string,
  category: string,
  color: string,
): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, planId);
  if (!idv.ok) return idv;
  const v = parse(budgetItemSchema.pick({ category: true, category_color: true }), {
    category,
    category_color: color,
  });
  if (!v.ok) return v;
  if (!v.data.category_color) return { ok: false, error: "Warna tidak valid." };
  try { await setCategoryColor(idv.data, v.data.category, v.data.category_color); } catch (e) { return errMsg(e); }
  revalidateEntities("budget");
  return { ok: true };
}

export async function deleteBudgetItemAction(itemId: string): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, itemId);
  if (!idv.ok) return idv;
  await deleteBudgetItem(idv.data);
  revalidateEntities("budget");
  return { ok: true };
}

export async function duplicateBudgetItemAction(itemId: string): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, itemId);
  if (!idv.ok) return idv;
  const plans = await getBudgetPlans();
  const plan = plans.find((p) => p.items.some((i) => i.id === idv.data));
  const item = plan?.items.find((i) => i.id === idv.data);
  if (!plan || !item) return { ok: false, error: "Item tidak ditemukan." };
  try {
    await createBudgetItem(plan.id, {
      category: item.category,
      name: `${item.name} (salinan)`,
      qty: item.qty,
      unit: item.unit,
      unit_price: item.unit_price,
      category_color: item.category_color ?? null,
    });
  } catch (e) { return errMsg(e); }
  revalidateEntities("budget");
  return { ok: true };
}

export async function bulkDeleteBudgetItemsAction(ids: string[]): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const clean: string[] = [];
  for (const id of ids) { const v = parse(idSchema, id); if (!v.ok) return v; clean.push(v.data); }
  await bulkDeleteBudgetItems(clean);
  revalidateEntities("budget");
  return { ok: true };
}

export async function createBudgetPlanAction(input: { name: string; event_id: string }): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const v = parse(budgetPlanSchema, input);
  if (!v.ok) return v;
  await createBudgetPlan(v.data);
  revalidateEntities("budget");
  return { ok: true };
}

export async function deleteBudgetPlanAction(id: string): Promise<Result> {
  if (!can.manageBudget(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteBudgetPlan(idv.data);
  revalidateEntities("budget");
  return { ok: true };
}
