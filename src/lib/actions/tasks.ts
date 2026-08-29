"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createTask, deleteTask, getTask, updateTask, bulkUpdateTasks, bulkDeleteTasks,
  syncTaskLinks, purgeTaskLinks, syncTaskRefs, getTasksByIds,
} from "@/lib/data/repo";
import type { AppUser, DivisionKey, Task, TaskLinkInput, TaskRefInput, TaskStatus } from "@/lib/types";
import {
  createTaskSchema, updateTaskSchema, taskStatusSchema, taskLinksSchema, taskRefsSchema,
  bulkTaskFieldsSchema, idSchema, parse,
} from "./schemas";
import { archivedGuard } from "./lock";

export interface TaskInput {
  event_id: string;
  division: DivisionKey;
  no?: string;
  pic?: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string;
  result?: string;
  status?: TaskStatus;
}

type Result = { ok: true } | { ok: false; error: string };

const errMsg = (e: unknown) =>
  e instanceof Error ? `Gagal menyimpan: ${e.message}` : "Gagal menyimpan tugas.";

export async function createTaskAction(
  input: TaskInput,
  links?: TaskLinkInput[],
  refs?: TaskRefInput[],
): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageTasks(user)) {
    return { ok: false, error: "Kamu tidak punya akses membuat tugas." };
  }
  const v = parse(createTaskSchema, input);
  if (!v.ok) return v;
  const lv = parse(taskLinksSchema, links ?? []);
  if (!lv.ok) return lv;
  const rv = parse(taskRefsSchema, refs ?? []);
  if (!rv.ok) return rv;
  const blocked = await archivedGuard(user, v.data.event_id);
  if (blocked) return blocked;

  try {
    const id = await createTask(v.data);
    if (id && lv.data.length) {
      const created = await getTask(id);
      if (created) await syncTaskLinks(created, lv.data);
    }
    if (id && rv.data.length) await syncTaskRefs(id, rv.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidateEntities("tasks", "taskLinks");
  return { ok: true };
}

export async function updateTaskAction(
  id: string,
  patch: Partial<Task>,
  links?: TaskLinkInput[],
  refs?: TaskRefInput[],
): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(updateTaskSchema, patch);
  if (!v.ok) return v;
  const lv = links ? parse(taskLinksSchema, links) : null;
  if (lv && !lv.ok) return lv;
  const rv = refs ? parse(taskRefsSchema, refs) : null;
  if (rv && !rv.ok) return rv;

  const user = await getCurrentUser();
  const task = await getTask(idv.data);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };

  // Attaching result links counts as filling in the result, so it stays within
  // "progress only" permissions (staff/intern on their own tasks).
  const keys = Object.keys(v.data);
  const onlyProgress = keys.every((k) => k === "status" || k === "result");
  const allowed = onlyProgress ? can.editTaskProgress(user) : can.editTask(user);
  if (!allowed) return { ok: false, error: "Kamu tidak punya akses mengedit tugas ini." };
  const blocked = await archivedGuard(user, task.event_id);
  if (blocked) return blocked;
  // Moving a task BETWEEN editions is two writes as far as the archive lock is
  // concerned: it leaves one edition and lands in another. `updateTaskSchema`
  // accepts `event_id`, and guarding only the edition it came FROM let a task
  // be dropped INTO an archived one. (The `events_update` policy's WITH CHECK
  // catches it in the database; this is the readable half.)
  if (v.data.event_id && v.data.event_id !== task.event_id) {
    const blockedDest = await archivedGuard(user, v.data.event_id);
    if (blockedDest) return blockedDest;
  }

  try {
    await updateTask(idv.data, v.data);
    if (lv && lv.ok) await syncTaskLinks({ ...task, ...v.data }, lv.data);
    if (rv && rv.ok) await syncTaskRefs(idv.data, rv.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidateEntities("tasks", "taskLinks");
  return { ok: true };
}

export async function setTaskStatusAction(id: string, status: TaskStatus): Promise<Result> {
  const v = parse(taskStatusSchema, status);
  if (!v.ok) return v;
  return updateTaskAction(id, { status: v.data });
}

type BulkResult = { ok: true; count: number; skipped: number } | { ok: false; error: string };

/**
 * Refuse a whole batch when any selected task belongs to an archived edition.
 *
 * One lookup per DISTINCT edition rather than per task: a selection is normally
 * all inside the Ormawa Visit on screen, so this is a single call in practice.
 *
 * All-or-nothing on purpose. Silently writing the writable half of a selection
 * and dropping the rest is the shape of bug this project keeps paying for: the
 * count in the toast would look right and some rows would simply not change.
 */
async function archivedGuardForTasks(user: AppUser, tasks: Task[]) {
  for (const eventId of new Set(tasks.map((t) => t.event_id))) {
    const blocked = await archivedGuard(user, eventId);
    if (blocked) return blocked;
  }
  return null;
}

export async function bulkSetStatusAction(ids: string[], status: TaskStatus): Promise<BulkResult> {
  const sv = parse(taskStatusSchema, status);
  if (!sv.ok) return sv;
  const user = await getCurrentUser();
  // One query in, one query out. Reading the rows first is what drops unknown
  // ids and gives the archive guard something to check; it used to be one round
  // trip PER selected id, which the already-batched write below disguised.
  const tasks = await getTasksByIds(ids);
  const blocked = await archivedGuardForTasks(user, tasks);
  if (blocked) return blocked;
  const allowed = can.editTaskProgress(user) ? tasks.map((t) => t.id) : [];
  try {
    if (allowed.length) await bulkUpdateTasks(allowed, { status: sv.data });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidateEntities("tasks", "taskLinks");
  return { ok: true, count: allowed.length, skipped: ids.length - allowed.length };
}

/**
 * Set Divisi / PIC / Deadline on many selected tasks at once.
 *
 * Only the fields actually present in `patch` are written, so the bulk editor
 * can change just the deadline without blanking the PIC of every row it
 * touches. Unlike `bulkSetStatusAction` this is a real edit, so it needs
 * `can.editTask` (not the looser progress-only permission) and it refuses when
 * any selected task sits in an archived edition.
 */
export async function bulkUpdateTaskFieldsAction(
  ids: string[],
  patch: { division?: DivisionKey; pic?: string; end_date?: string | null },
): Promise<BulkResult> {
  const v = parse(bulkTaskFieldsSchema, patch);
  if (!v.ok) return v;
  if (!Object.keys(v.data).length) return { ok: false, error: "Tidak ada kolom yang diubah." };

  const user = await getCurrentUser();
  if (!can.editTask(user)) return { ok: false, error: "Kamu tidak punya akses mengedit tugas." };

  const tasks = await getTasksByIds(ids);
  const blocked = await archivedGuardForTasks(user, tasks);
  if (blocked) return blocked;

  const allowed = tasks.map((t) => t.id);
  try {
    if (allowed.length) await bulkUpdateTasks(allowed, v.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidateEntities("tasks", "taskLinks");
  return { ok: true, count: allowed.length, skipped: ids.length - allowed.length };
}

export async function bulkDeleteTasksAction(ids: string[]): Promise<BulkResult> {
  const user = await getCurrentUser();
  const tasks = await getTasksByIds(ids);
  const blocked = await archivedGuardForTasks(user, tasks);
  if (blocked) return blocked;
  const allowed = can.deleteTask(user) ? tasks.map((t) => t.id) : [];
  try {
    for (const id of allowed) await purgeTaskLinks(id);
    if (allowed.length) await bulkDeleteTasks(allowed);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidateEntities("tasks", "taskLinks");
  return { ok: true, count: allowed.length, skipped: ids.length - allowed.length };
}

export async function duplicateTaskAction(id: string): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const user = await getCurrentUser();
  const task = await getTask(idv.data);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };
  if (!can.manageTasks(user)) {
    return { ok: false, error: "Kamu tidak punya akses membuat tugas." };
  }
  const blocked = await archivedGuard(user, task.event_id);
  if (blocked) return blocked;
  // Fresh copy: keeps the plan (division/PIC/dates/notes), resets progress.
  try {
    await createTask({
      event_id: task.event_id,
      division: task.division,
      title: `${task.title} (salinan)`,
      pic: task.pic,
      start_date: task.start_date,
      end_date: task.end_date,
      notes: task.notes,
      status: "todo",
    });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidateEntities("tasks", "taskLinks");
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const user = await getCurrentUser();
  const task = await getTask(idv.data);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };
  // Deleting needs FULL access - "limited" roles (staff/intern) may create,
  // edit and fill in results, but never delete.
  if (!can.deleteTask(user)) {
    return { ok: false, error: "Kamu tidak punya akses menghapus tugas ini." };
  }
  const blocked = await archivedGuard(user, task.event_id);
  if (blocked) return blocked;
  // Drop the task's published Super Link rows first (task_links themselves
  // cascade with the task).
  try {
    await purgeTaskLinks(task.id);
    await deleteTask(idv.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidateEntities("tasks", "taskLinks");
  return { ok: true };
}
