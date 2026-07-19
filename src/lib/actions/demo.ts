"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { resetDemoData } from "@/lib/data/repo";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Restore the "Ormawa Visit Demo" edition to its original mockup. Only clears
 * and re-seeds demo-scoped rows, so real Ormawa Visit data is never affected.
 * Admin only (same gate as managing editions).
 */
export async function resetDemoDataAction(): Promise<Result> {
  if (!can.manageEvents(await getCurrentUser()))
    return { ok: false, error: "Kamu tidak punya akses untuk ini." };
  try {
    await resetDemoData();
  } catch {
    return { ok: false, error: "Gagal mereset data demo. Coba lagi." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
