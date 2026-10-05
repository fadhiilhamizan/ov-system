"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { can } from "@/lib/permissions";
import {
  createRundown, applyRundownChanges, deleteRundown, bulkDeleteRundown, getRundown,
  createJob, updateJob, deleteJob, reorderJobs, getJobs,
} from "@/lib/data/repo";
import type { JobHariH, RundownItem } from "@/lib/types";
import {
  rundownSchema, rundownChangesSchema, clientUuidSchema, jobSchema, idSchema, bulkIdsSchema, parse,
} from "./schemas";
import { archivedGuard, errMsg } from "./lock";

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses untuk ini." };

// Rundown and Hari-H are always edited in the context of the active Ormawa
// Visit, so that is the edition whose archive flag gates these writes, and the
// edition new rows belong to. The authoritative check is `writable_event()` in
// migration 0028.
//
// It used to accept the caller's own `event_id` and fall back to the session.
// That fallback was the hole: a payload with no event_id made the guard check
// nothing and the row land unscoped, visible under every edition. The session
// is now the only source, so the edition that is GUARDED and the edition that
// is WRITTEN are the same value by construction.
const scopeOf = async () => (await getActiveEvent()).id;

// ---------------- Rundown ----------------
/**
 * `newId` is optional and client-generated: the table shows the row the moment
 * "Tambah baris" is clicked and queues edits against that id, instead of
 * freezing until the insert returns.
 */
export async function createRundownAction(
  input: Partial<RundownItem>,
  newId?: string,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageRundown(user)) return DENY;
  // Empty rows are allowed - the rundown table lets you add a blank row and
  // fill it in inline.
  const v = parse(rundownSchema, input);
  if (!v.ok) return v;
  let id: string | undefined;
  if (newId !== undefined) {
    const idv = parse(clientUuidSchema, newId);
    if (!idv.ok) return idv;
    id = idv.data;
  }
  const eventId = await scopeOf();
  const blocked = await archivedGuard(user, eventId);
  if (blocked) return blocked;
  // Scope written explicitly: the schema no longer carries it, and a row
  // inserted with event_id null shows up under every Ormawa Visit.
  try { await createRundown({ ...v.data, id, event_id: eventId }); } catch (e) { return errMsg(e); }
  revalidateEntities("rundown");
  return { ok: true };
}

/**
 * Save a batch of inline cell edits.
 *
 * The table no longer saves each cell the instant it loses focus: it keeps the
 * edit locally, shows it immediately, and flushes everything typed in the last
 * moment as ONE call once the person pauses. One round trip (and one
 * revalidation) per pause instead of one per cell is what stopped the table
 * feeling like it froze after every keystroke-and-tab.
 *
 * Division cells arrive as a partial map (only the keys that changed) and are
 * merged server-side against the live row - see `applyRundownChanges`.
 */
export async function saveRundownChangesAction(
  changes: { id: string; patch: Partial<RundownItem> }[],
): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageRundown(user)) return DENY;
  const v = parse(rundownChangesSchema, changes);
  if (!v.ok) return v;
  const blocked = await archivedGuard(user, await scopeOf());
  if (blocked) return blocked;
  try { await applyRundownChanges(v.data); } catch (e) { return errMsg(e); }
  revalidateEntities("rundown");
  return { ok: true };
}

export async function duplicateRundownAction(id: string, newId?: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageRundown(user)) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  let copyId: string | undefined;
  if (newId !== undefined) {
    const nv = parse(clientUuidSchema, newId);
    if (!nv.ok) return nv;
    copyId = nv.data;
  }
  const row = (await getRundown()).find((r) => r.id === idv.data);
  if (!row) return { ok: false, error: "Baris rundown tidak ditemukan." };
  const blocked = await archivedGuard(user, row.event_id);
  if (blocked) return blocked;
  try {
    await createRundown({
      id: copyId,
      event_id: row.event_id, variant: row.variant,
      time_start: row.time_start, time_end: row.time_end, duration: row.duration,
      activity: row.activity, keterangan: row.keterangan,
      mc: row.mc, operator: row.operator, division_jobs: row.division_jobs,
    });
  } catch (e) { return errMsg(e); }
  revalidateEntities("rundown");
  return { ok: true };
}
export async function deleteRundownAction(id: string): Promise<Result> {
  // Deleting needs FULL access - "limited" roles (staff/intern) may add and
  // edit rows but never remove them.
  const user = await getCurrentUser();
  if (!can.deleteRundown(user)) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const blocked = await archivedGuard(user, await scopeOf());
  if (blocked) return blocked;
  try { await deleteRundown(idv.data); } catch (e) { return errMsg(e); }
  revalidateEntities("rundown");
  return { ok: true };
}

/**
 * Remove the rows ticked in the rundown table, all at once. Same rule as a
 * single delete: FULL access only. Only rows of the active edition are
 * touched, whatever ids the payload names.
 */
export async function bulkDeleteRundownAction(ids: string[]): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.deleteRundown(user)) return DENY;
  const v = parse(bulkIdsSchema, ids);
  if (!v.ok) return v;
  const eventId = await scopeOf();
  const blocked = await archivedGuard(user, eventId);
  if (blocked) return blocked;
  try { await bulkDeleteRundown(eventId, v.data); } catch (e) { return errMsg(e); }
  revalidateEntities("rundown");
  return { ok: true };
}

// ---------------- Jobs (Hari-H) ----------------
export async function createJobAction(input: Partial<JobHariH>): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageJobs(user)) return DENY;
  const v = parse(jobSchema, input);
  if (!v.ok) return v;
  if (!v.data.job?.trim()) return { ok: false, error: "Deskripsi tugas wajib diisi." };
  const eventId = await scopeOf();
  const blocked = await archivedGuard(user, eventId);
  if (blocked) return blocked;
  // Same as createRundownAction: the scope is written, not inherited from null.
  try { await createJob({ ...v.data, event_id: eventId }); } catch (e) { return errMsg(e); }
  revalidateEntities("jobs");
  return { ok: true };
}
export async function updateJobAction(id: string, patch: Partial<JobHariH>): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageJobs(user)) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(jobSchema, patch);
  if (!v.ok) return v;
  const blocked = await archivedGuard(user, await scopeOf());
  if (blocked) return blocked;
  try { await updateJob(idv.data, v.data); } catch (e) { return errMsg(e); }
  revalidateEntities("jobs");
  return { ok: true };
}
/** `newId`: optional client uuid, so the copy can be shown before it exists. */
export async function duplicateJobAction(id: string, newId?: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageJobs(user)) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  let copyId: string | undefined;
  if (newId !== undefined) {
    const nv = parse(clientUuidSchema, newId);
    if (!nv.ok) return nv;
    copyId = nv.data;
  }
  const job = (await getJobs()).find((j) => j.id === idv.data);
  if (!job) return { ok: false, error: "Tugas tidak ditemukan." };
  const blocked = await archivedGuard(user, job.event_id);
  if (blocked) return blocked;
  try {
    await createJob({
      id: copyId, event_id: job.event_id, job: `${job.job} (salinan)`, pic: job.pic, notes: job.notes,
    });
  } catch (e) { return errMsg(e); }
  revalidateEntities("jobs");
  return { ok: true };
}
export async function deleteJobAction(id: string): Promise<Result> {
  // Deleting needs FULL access - see deleteRundownAction.
  const user = await getCurrentUser();
  if (!can.deleteJob(user)) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const blocked = await archivedGuard(user, await scopeOf());
  if (blocked) return blocked;
  try { await deleteJob(idv.data); } catch (e) { return errMsg(e); }
  revalidateEntities("jobs");
  return { ok: true };
}
export async function reorderJobsAction(orderedIds: string[]): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageJobs(user)) return DENY;
  const clean: string[] = [];
  for (const id of orderedIds) { const v = parse(idSchema, id); if (!v.ok) return v; clean.push(v.data); }
  const blocked = await archivedGuard(user, await scopeOf());
  if (blocked) return blocked;
  try { await reorderJobs(clean); } catch (e) { return errMsg(e); }
  revalidateEntities("jobs");
  return { ok: true };
}
