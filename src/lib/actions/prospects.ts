"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createProspect, deleteProspect, updateProspect, bulkDeleteProspects,
  getProspects, setPrimaryProspect, unsetPrimaryProspect, syncEventFromProspect, syncProspectLinks,
} from "@/lib/data/repo";
import type { Prospect, ProspectLinkInput } from "@/lib/types";
import { getActiveEvent } from "@/lib/session";
import { prospectSchema, prospectUpdateSchema, prospectLinksSchema, idSchema, parse } from "./schemas";
import { archivedGuard, errMsg } from "./lock";

type Result = { ok: true } | { ok: false; error: string };

async function guard(): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageProspects(user)) return { ok: false, error: "Kamu tidak punya akses mengelola prospek." };
  return { ok: true };
}

export async function createProspectAction(
  input: Partial<Prospect>,
  links?: ProspectLinkInput[],
): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const v = parse(prospectSchema, input);
  if (!v.ok) return v;
  const lv = parse(prospectLinksSchema, links ?? []);
  if (!lv.ok) return lv;
  // Scope from the session, not the payload: the schema no longer accepts
  // `event_id`, and a prospect written without one appears under every Ormawa
  // Visit at once. See the note at the top of schemas.ts.
  const event = await getActiveEvent();
  const blocked = await archivedGuard(await getCurrentUser(), event.id);
  if (blocked) return blocked;
  try {
    const id = await createProspect({ ...v.data, event_id: event.id });
    // Attach the links, publishing the ticked ones to Super Link.
    if (id && lv.data.length) {
      const created = (await getProspects()).find((p) => p.id === id);
      if (created) await syncProspectLinks(created, lv.data);
    }
  } catch (e) { return errMsg(e); }
  revalidateEntities("prospects", "links");
  return { ok: true };
}

export async function updateProspectAction(
  id: string,
  patch: Partial<Prospect>,
  links?: ProspectLinkInput[],
): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(prospectUpdateSchema, patch);
  if (!v.ok) return v;
  // `undefined` means "the caller is not touching the links" (e.g. the primary
  // toggle); an empty ARRAY means "remove them all", and must not be confused
  // with it, or ticking a prospect as primary would wipe its attachments.
  const lv = links ? parse(prospectLinksSchema, links) : null;
  if (lv && !lv.ok) return lv;
  try {
    await updateProspect(idv.data, v.data);
    if (links) {
      const current = (await getProspects()).find((p) => p.id === idv.data);
      if (current && lv?.ok) await syncProspectLinks(current, lv.data);
    }
  } catch (e) { return errMsg(e); }
  // Editing the primary prospect re-syncs the OV's partner/campus/location/mode.
  // That is a write to `events`, so the bust has to include it: the topbar
  // switcher and the dashboard's "Ringkasan Ormawa Visit" read the edition, and
  // without it they keep showing the previous partner until a hard reload.
  // Only when the sync actually ran - "events" maps to a full-tree revalidate,
  // which an ordinary prospect edit has no reason to pay for.
  const updated = (await getProspects()).find((p) => p.id === idv.data);
  if (updated?.is_primary && updated.event_id) {
    await syncEventFromProspect(updated.event_id, updated);
    revalidateEntities("prospects", "links", "events");
  } else {
    revalidateEntities("prospects", "links");
  }
  return { ok: true };
}

/** Mark a prospect as this OV's primary (confirmed partner) and copy its data
 *  onto the OV. Clears any previous primary â€” only one per OV. */
export async function setPrimaryProspectAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  try { await setPrimaryProspect(idv.data); } catch (e) { return errMsg(e); }
  // `setPrimaryProspect` copies the prospect's identity onto the edition
  // (`syncEventFromProspect`), so this writes `events` too - see the same note
  // in `updateProspectAction`.
  revalidateEntities("prospects", "events");
  return { ok: true };
}
export async function unsetPrimaryProspectAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  try { await unsetPrimaryProspect(idv.data); } catch (e) { return errMsg(e); }
  revalidateEntities("prospects");
  return { ok: true };
}

export async function deleteProspectAction(id: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  try { await deleteProspect(idv.data); } catch (e) { return errMsg(e); }
  // `deleteProspect` purges the prospect's published Super Link rows, so /links
  // is stale without this - the entries stayed on screen until some unrelated
  // write happened to bust that route. Same contract as the task delete path.
  revalidateEntities("prospects", "links");
  return { ok: true };
}

export async function bulkDeleteProspectsAction(ids: string[]): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const clean: string[] = [];
  for (const id of ids) { const v = parse(idSchema, id); if (!v.ok) return v; clean.push(v.data); }
  try { await bulkDeleteProspects(clean); } catch (e) { return errMsg(e); }
  // Purges Super Link rows for every id, so /links has to be busted too.
  revalidateEntities("prospects", "links");
  return { ok: true };
}
