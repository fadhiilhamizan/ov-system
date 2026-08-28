"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { can } from "@/lib/permissions";
import {
  createRundown, updateRundown, deleteRundown, getRundown, setRundownDivisionJob,
  createJob, updateJob, deleteJob, reorderJobs, getJobs,
} from "@/lib/data/repo";
import type { JobHariH, RundownItem } from "@/lib/types";
import { rundownSchema, rundownDivisionJobSchema, jobSchema, idSchema, parse } from "./schemas";
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
export async function createRundownAction(input: Partial<RundownItem>): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageRundown(user)) return DENY;
  // Empty rows are allowed - the rundown table lets you add a blank row and
  // fill it in inline.
  const v = parse(rundownSchema, input);
  if (!v.ok) return v;
  const eventId = await scopeOf();
  const blocked = await archivedGuard(user, eventId);
  if (blocked) return blocked;
  // Scope written explicitly: the schema no longer carries it, and a row
  // inserted with event_id null shows up under every Ormawa Visit.
  try { await createRundown({ ...v.data, event_id: eventId }); } catch (e) { return errMsg(e); }
  revalidateEntities("rundown");
  return { ok: true };
}
export async function updateRundownAction(id: string, patch: Partial<RundownItem>): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageRundown(user)) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(rundownSchema, patch);
  if (!v.ok) return v;
  const blocked = await archivedGuard(user, await scopeOf());
  if (blocked) return blocked;
  try { await updateRundown(idv.data, v.data); } catch (e) { return errMsg(e); }
  revalidateEntities("rundown");
  return { ok: true };
}
/**
 * Set ONE division's cell on a rundown row.
 *
 * Separate from `updateRundownAction` on purpose: that one takes a whole
 * `division_jobs` object assembled in the browser, and two quick edits in the
 * same row raced each other into silent data loss. Here the client names only
 * the key it changed and the repo merges it onto the live row. Same permission
 * and archive rules as any other rundown edit.
 */
export async function setRundownDivisionJobAction(
  id: string,
  division: string,
  value: string,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageRundown(user)) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(rundownDivisionJobSchema, { division, value });
  if (!v.ok) return v;
  const row = (await getRundown()).find((r) => r.id === idv.data);
  if (!row) return { ok: false, error: "Baris rundown tidak ditemukan." };
  const blocked = await archivedGuard(user, row.event_id);
  if (blocked) return blocked;
  try {
    await setRundownDivisionJob(idv.data, v.data.division, v.data.value);
  } catch (e) { return errMsg(e); }
  revalidateEntities("rundown");
  return { ok: true };
}

export async function duplicateRundownAction(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageRundown(user)) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const row = (await getRundown()).find((r) => r.id === idv.data);
  if (!row) return { ok: false, error: "Baris rundown tidak ditemukan." };
  const blocked = await archivedGuard(user, row.event_id);
  if (blocked) return blocked;
  try {
    await createRundown({
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
export async function duplicateJobAction(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageJobs(user)) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const job = (await getJobs()).find((j) => j.id === idv.data);
  if (!job) return { ok: false, error: "Tugas tidak ditemukan." };
  const blocked = await archivedGuard(user, job.event_id);
  if (blocked) return blocked;
  try {
    await createJob({
      event_id: job.event_id, job: `${job.job} (salinan)`, pic: job.pic, notes: job.notes,
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
