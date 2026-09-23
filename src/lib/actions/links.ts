"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { can } from "@/lib/permissions";
import {
  createLink, deleteLink, updateLink, bulkDeleteLinks, getLink, pushLinkToOwners, releaseLinkOwners,
} from "@/lib/data/repo";
import { isOwnedLink } from "@/lib/links";
import type { LinkItem } from "@/lib/types";
import { createLinkSchema, linkUpdateSchema, idSchema, parse } from "./schemas";
import { archivedGuard, errMsg } from "./lock";

type Result = { ok: true } | { ok: false; error: string };

async function guard(): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageLinks(user)) return { ok: false, error: "Kamu tidak punya akses mengelola tautan." };
  return { ok: true };
}

/** Deleting needs FULL access - "limited" roles may add and edit only. */
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
  // The edition comes from the session, never the payload: an omitted event_id
  // used to make the guard below pass unconditionally and file the entry under
  // every Ormawa Visit at once. See the note at the top of schemas.ts.
  const event = await getActiveEvent();
  const blocked = await archivedGuard(user, event.id);
  if (blocked) return blocked;
  // `source` is the repo's, not the caller's: "task" and "prospect" mean the
  // entry is OWNED by a child row that will update and delete it. A manual
  // entry created here is exactly that, and saying so keeps the clone rules
  // (which skip published entries) honest.
  try { await createLink({ ...v.data, event_id: event.id, source: "manual" }); }
  catch (e) { return errMsg(e); }
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
  const current = await getLink(idv.data);
  if (!current) return { ok: false, error: "Tautan tidak ditemukan." };
  const owned = isOwnedLink(current);
  // An entry PUBLISHED from a task result or a prospect is rebuilt from its
  // owner on every save of that owner, so only the two fields that flow back
  // (name and URL) may be edited here. Section, division and note are the
  // owner's; accepting them would last until the next save and then vanish.
  const data = owned ? { name: v.data.name, url: v.data.url } : v.data;
  try {
    await updateLink(idv.data, data);
    if (owned) {
      await pushLinkToOwners(idv.data, {
        url: data.url !== undefined && data.url !== current.url ? data.url : undefined,
        name: data.name !== undefined && data.name !== current.name ? data.name : undefined,
      });
    }
  } catch (e) { return errMsg(e); }
  if (owned) revalidateEntities("links", "taskLinks", "prospectLinks");
  else revalidateEntities("links");
  return { ok: true };
}

export async function deleteLinkAction(id: string): Promise<Result> {
  const g = await deleteGuard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  try {
    // Untick "publish" on whatever owned it, or the owner goes on claiming the
    // entry exists and republishes it on its next save.
    await releaseLinkOwners([idv.data]);
    await deleteLink(idv.data);
  } catch (e) { return errMsg(e); }
  revalidateEntities("links", "taskLinks", "prospectLinks");
  return { ok: true };
}

export async function bulkDeleteLinksAction(ids: string[]): Promise<Result> {
  const g = await deleteGuard();
  if (!g.ok) return g;
  const clean: string[] = [];
  for (const id of ids) { const v = parse(idSchema, id); if (!v.ok) return v; clean.push(v.data); }
  try {
    await releaseLinkOwners(clean);
    await bulkDeleteLinks(clean);
  } catch (e) { return errMsg(e); }
  revalidateEntities("links", "taskLinks", "prospectLinks");
  return { ok: true };
}
