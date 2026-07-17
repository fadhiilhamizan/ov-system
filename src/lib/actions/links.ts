"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createLink, deleteLink, updateLink } from "@/lib/data/repo";
import type { LinkItem } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

async function guard(): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageLinks(user)) return { ok: false, error: "Kamu tidak punya akses mengelola tautan." };
  return { ok: true };
}

export async function createLinkAction(input: Partial<LinkItem>): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  if (!input.name?.trim()) return { ok: false, error: "Nama tautan wajib diisi." };
  await createLink(input);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateLinkAction(id: string, patch: Partial<LinkItem>): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  await updateLink(id, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteLinkAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  await deleteLink(id);
  revalidatePath("/", "layout");
  return { ok: true };
}
