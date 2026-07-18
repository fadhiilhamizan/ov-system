"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createRundown, updateRundown, deleteRundown,
  createJob, updateJob, deleteJob,
} from "@/lib/data/repo";
import type { JobHariH, RundownItem } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses untuk ini." };

// ---------------- Rundown ----------------
export async function createRundownAction(input: Partial<RundownItem>): Promise<Result> {
  if (!can.manageRundown(await getCurrentUser())) return DENY;
  if (!input.activity?.trim()) return { ok: false, error: "Kegiatan wajib diisi." };
  await createRundown(input);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateRundownAction(id: string, patch: Partial<RundownItem>): Promise<Result> {
  if (!can.manageRundown(await getCurrentUser())) return DENY;
  await updateRundown(id, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteRundownAction(id: string): Promise<Result> {
  if (!can.manageRundown(await getCurrentUser())) return DENY;
  await deleteRundown(id);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------- Jobs (Hari-H) ----------------
export async function createJobAction(input: Partial<JobHariH>): Promise<Result> {
  if (!can.manageJobs(await getCurrentUser())) return DENY;
  if (!input.job?.trim()) return { ok: false, error: "Deskripsi tugas wajib diisi." };
  await createJob(input);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateJobAction(id: string, patch: Partial<JobHariH>): Promise<Result> {
  if (!can.manageJobs(await getCurrentUser())) return DENY;
  await updateJob(id, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteJobAction(id: string): Promise<Result> {
  if (!can.manageJobs(await getCurrentUser())) return DENY;
  await deleteJob(id);
  revalidatePath("/", "layout");
  return { ok: true };
}
