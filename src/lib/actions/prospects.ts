"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createProspect, deleteProspect, updateProspect, bulkDeleteProspects,
  getProspects, setPrimaryProspect, unsetPrimaryProspect, syncEventFromProspect,
} from "@/lib/data/repo";
import type { Prospect } from "@/lib/types";
import { prospectSchema, prospectUpdateSchema, idSchema, parse } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };

async function guard(): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageProspects(user)) return { ok: false, error: "Kamu tidak punya akses mengelola prospek." };
  return { ok: true };
}

export async function createProspectAction(input: Partial<Prospect>): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const v = parse(prospectSchema, input);
  if (!v.ok) return v;
  await createProspect(v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProspectAction(id: string, patch: Partial<Prospect>): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(prospectUpdateSchema, patch);
  if (!v.ok) return v;
  await updateProspect(idv.data, v.data);
  // Editing the primary prospect re-syncs the OV's partner/campus/location/mode.
  const updated = (await getProspects()).find((p) => p.id === idv.data);
  if (updated?.is_primary && updated.event_id) await syncEventFromProspect(updated.event_id, updated);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Mark a prospect as this OV's primary (confirmed partner) and copy its data
 *  onto the OV. Clears any previous primary — only one per OV. */
export async function setPrimaryProspectAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await setPrimaryProspect(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function unsetPrimaryProspectAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await unsetPrimaryProspect(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteProspectAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteProspect(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function bulkDeleteProspectsAction(ids: string[]): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const clean: string[] = [];
  for (const id of ids) { const v = parse(idSchema, id); if (!v.ok) return v; clean.push(v.data); }
  await bulkDeleteProspects(clean);
  revalidatePath("/", "layout");
  return { ok: true };
}
