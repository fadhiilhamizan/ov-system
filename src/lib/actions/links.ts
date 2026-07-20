"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createLink, deleteLink, updateLink, bulkDeleteLinks } from "@/lib/data/repo";
import type { LinkItem } from "@/lib/types";
import { createLinkSchema, linkUpdateSchema, idSchema, parse } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };

async function guard(): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageLinks(user)) return { ok: false, error: "Kamu tidak punya akses mengelola tautan." };
  return { ok: true };
}

export async function createLinkAction(input: Partial<LinkItem>): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.createLink(user)) return { ok: false, error: "Kamu tidak punya akses menambah tautan." };
  const v = parse(createLinkSchema, input);
  if (!v.ok) return v;
  await createLink(v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateLinkAction(id: string, patch: Partial<LinkItem>): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(linkUpdateSchema, patch);
  if (!v.ok) return v;
  await updateLink(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteLinkAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteLink(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function bulkDeleteLinksAction(ids: string[]): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const clean: string[] = [];
  for (const id of ids) { const v = parse(idSchema, id); if (!v.ok) return v; clean.push(v.data); }
  await bulkDeleteLinks(clean);
  revalidatePath("/", "layout");
  return { ok: true };
}
