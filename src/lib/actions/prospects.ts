"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createProspect, deleteProspect, updateProspect } from "@/lib/data/repo";
import type { Prospect } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

async function guard(): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageProspects(user)) return { ok: false, error: "Kamu tidak punya akses mengelola prospek." };
  return { ok: true };
}

export async function createProspectAction(input: Partial<Prospect>): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  if (!input.org_name?.trim() && !input.contact?.trim())
    return { ok: false, error: "Isi minimal nama ormawa atau kontak." };
  createProspect(input);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProspectAction(id: string, patch: Partial<Prospect>): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  updateProspect(id, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteProspectAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  deleteProspect(id);
  revalidatePath("/", "layout");
  return { ok: true };
}
