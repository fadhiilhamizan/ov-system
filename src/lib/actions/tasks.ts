"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createTask, deleteTask, getTask, updateTask } from "@/lib/data/repo";
import type { DivisionKey, Task, TaskStatus } from "@/lib/types";

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
  if (!input.title?.trim()) return { ok: false, error: "Judul tugas wajib diisi." };
  createTask({ ...input, title: input.title.trim() });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTaskAction(id: string, patch: Partial<Task>): Promise<Result> {
  const user = await getCurrentUser();
  const task = getTask(id);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };

  const keys = Object.keys(patch);
  const onlyProgress = keys.every((k) => k === "status" || k === "result");
  const allowed = onlyProgress ? can.editTaskProgress(user, task) : can.editTask(user, task);
  if (!allowed) return { ok: false, error: "Kamu tidak punya akses mengedit tugas ini." };

  updateTask(id, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setTaskStatusAction(id: string, status: TaskStatus): Promise<Result> {
  return updateTaskAction(id, { status });
}

export async function deleteTaskAction(id: string): Promise<Result> {
  const user = await getCurrentUser();
  const task = getTask(id);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };
  if (!can.manageTasks(user, task.division)) {
    return { ok: false, error: "Kamu tidak punya akses menghapus tugas ini." };
  }
  deleteTask(id);
  revalidatePath("/", "layout");
  return { ok: true };
}
