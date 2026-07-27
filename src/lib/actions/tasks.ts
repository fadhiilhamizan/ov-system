"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createTask, deleteTask, getTask, updateTask, bulkUpdateTasks, bulkDeleteTasks,
  syncTaskLinks, purgeTaskLinks,
} from "@/lib/data/repo";
import type { DivisionKey, Task, TaskLinkInput, TaskStatus } from "@/lib/types";
import { createTaskSchema, updateTaskSchema, taskStatusSchema, taskLinksSchema, idSchema, parse } from "./schemas";
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

export async function createTaskAction(input: TaskInput, links?: TaskLinkInput[]): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageTasks(user)) {
    return { ok: false, error: "Kamu tidak punya akses membuat tugas." };
  }
  const v = parse(createTaskSchema, input);
  if (!v.ok) return v;
  const lv = parse(taskLinksSchema, links ?? []);
  if (!lv.ok) return lv;
  const blocked = await archivedGuard(user, v.data.event_id);
  if (blocked) return blocked;

  try {
    const id = await createTask(v.data);
    if (id && lv.data.length) {
      const created = await getTask(id);
      if (created) await syncTaskLinks(created, lv.data);
    }
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
): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(updateTaskSchema, patch);
  if (!v.ok) return v;
  const lv = links ? parse(taskLinksSchema, links) : null;
  if (lv && !lv.ok) return lv;

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

  try {
    await updateTask(idv.data, v.data);
    if (lv && lv.ok) await syncTaskLinks({ ...task, ...v.data }, lv.data);
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

export async function bulkSetStatusAction(ids: string[], status: TaskStatus): Promise<BulkResult> {
  const sv = parse(taskStatusSchema, status);
  if (!sv.ok) return sv;
  const user = await getCurrentUser();
  // Fetch the rows so unknown ids are dropped, then apply the change in ONE
  // batched write instead of N round-trips.
  const tasks = await Promise.all(ids.map((id) => getTask(id)));
  const allowed = can.editTaskProgress(user)
    ? tasks.filter((t): t is Task => !!t).map((t) => t.id)
    : [];
  try {
    if (allowed.length) await bulkUpdateTasks(allowed, { status: sv.data });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidateEntities("tasks", "taskLinks");
  return { ok: true, count: allowed.length, skipped: ids.length - allowed.length };
}

export async function bulkDeleteTasksAction(ids: string[]): Promise<BulkResult> {
  const user = await getCurrentUser();
  const tasks = await Promise.all(ids.map((id) => getTask(id)));
  const allowed = can.deleteTask(user)
    ? tasks.filter((t): t is Task => !!t).map((t) => t.id)
    : [];
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
  // Deleting needs FULL access — "limited" roles (staff/intern) may create,
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
