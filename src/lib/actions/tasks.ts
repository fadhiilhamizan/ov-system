"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createTask, deleteTask, getTask, updateTask } from "@/lib/data/repo";
import type { DivisionKey, Task, TaskStatus } from "@/lib/types";
import { createTaskSchema, updateTaskSchema, taskStatusSchema, idSchema, parse } from "./schemas";

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

export async function createTaskAction(input: TaskInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageTasks(user, input.division)) {
    return { ok: false, error: "Kamu tidak punya akses membuat tugas di divisi ini." };
  }
  const v = parse(createTaskSchema, input);
  if (!v.ok) return v;
  await createTask(v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTaskAction(id: string, patch: Partial<Task>): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(updateTaskSchema, patch);
  if (!v.ok) return v;

  const user = await getCurrentUser();
  const task = await getTask(idv.data);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };

  const keys = Object.keys(v.data);
  const onlyProgress = keys.every((k) => k === "status" || k === "result");
  const allowed = onlyProgress ? can.editTaskProgress(user, task) : can.editTask(user, task);
  if (!allowed) return { ok: false, error: "Kamu tidak punya akses mengedit tugas ini." };

  await updateTask(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setTaskStatusAction(id: string, status: TaskStatus): Promise<Result> {
  const v = parse(taskStatusSchema, status);
  if (!v.ok) return v;
  return updateTaskAction(id, { status: v.data });
}

export async function bulkSetStatusAction(
  ids: string[],
  status: TaskStatus,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  let count = 0;
  for (const id of ids) {
    const task = await getTask(id);
    if (task && can.editTaskProgress(user, task)) {
      await updateTask(id, { status });
      count++;
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, count };
}

export async function bulkDeleteTasksAction(
  ids: string[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  let count = 0;
  for (const id of ids) {
    const task = await getTask(id);
    if (task && can.manageTasks(user, task.division)) {
      await deleteTask(id);
      count++;
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, count };
}

export async function deleteTaskAction(id: string): Promise<Result> {
  const user = await getCurrentUser();
  const task = await getTask(id);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };
  if (!can.manageTasks(user, task.division)) {
    return { ok: false, error: "Kamu tidak punya akses menghapus tugas ini." };
  }
  await deleteTask(id);
  revalidatePath("/", "layout");
  return { ok: true };
}
