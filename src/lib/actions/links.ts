"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createLink, deleteLink, updateLink, bulkDeleteLinks } from "@/lib/data/repo";
import type { LinkItem } from "@/lib/types";
import { createLinkSchema, linkUpdateSchema, idSchema, parse } from "./schemas";
import { archivedGuard, errMsg } from "./lock";

type Result = { ok: true } | { ok: false; error: string };

async function guard(): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageLinks(user)) return { ok: false, error: "Kamu tidak punya akses mengelola tautan." };
  return { ok: true };
}

/** Deleting needs FULL access â€” "limited" roles may add and edit only. */
async function deleteGuard(): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.deleteLink(user)) return { ok: false, error: "Kamu tidak punya akses menghapus tautan." };
  return { ok: true };
}

export async function createLinkAction(input: Partial<LinkItem>): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.createLink(user)) return { ok: false, error: "Kamu tidak punya akses menambah tautan." };
  const v = parse(createLinkSchema, input);
  if (!v.ok) return v;
  const blocked = await archivedGuard(user, v.data.event_id);
  if (blocked) return blocked;
  try { await createLink(v.data); } catch (e) { return errMsg(e); }
  revalidateEntities("links");
  return { ok: true };
}

export async function updateLinkAction(id: string, patch: Partial<LinkItem>): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(linkUpdateSchema, patch);
  if (!v.ok) return v;
  try { await updateLink(idv.data, v.data); } catch (e) { return errMsg(e); }
  revalidateEntities("links");
  return { ok: true };
}

export async function deleteLinkAction(id: string): Promise<Result> {
  const g = await deleteGuard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  try { await deleteLink(idv.data); } catch (e) { return errMsg(e); }
  revalidateEntities("links");
  return { ok: true };
}

export async function bulkDeleteLinksAction(ids: string[]): Promise<Result> {
  const g = await deleteGuard();
  if (!g.ok) return g;
  const clean: string[] = [];
  for (const id of ids) { const v = parse(idSchema, id); if (!v.ok) return v; clean.push(v.data); }
  try { await bulkDeleteLinks(clean); } catch (e) { return errMsg(e); }
  revalidateEntities("links");
  return { ok: true };
}
