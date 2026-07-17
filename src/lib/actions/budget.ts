"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { updateBudgetItem } from "@/lib/data/repo";

type Result = { ok: true } | { ok: false; error: string };

export async function updateBudgetItemAction(
  planId: string,
  index: number,
  patch: { qty?: number | null; unit_price?: number | null; name?: string },
): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageBudget(user)) return { ok: false, error: "Kamu tidak punya akses mengedit anggaran." };
  await updateBudgetItem(planId, index, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}
