"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createRundown, updateRundown, deleteRundown,
  createJob, updateJob, deleteJob,
} from "@/lib/data/repo";
import type { JobHariH, RundownItem } from "@/lib/types";
import { rundownSchema, jobSchema, idSchema, parse } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses untuk ini." };

// ---------------- Rundown ----------------
export async function createRundownAction(input: Partial<RundownItem>): Promise<Result> {
  if (!can.manageRundown(await getCurrentUser())) return DENY;
  // Empty rows are allowed — the rundown table lets you add a blank row and
  // fill it in inline.
  const v = parse(rundownSchema, input);
  if (!v.ok) return v;
  await createRundown(v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateRundownAction(id: string, patch: Partial<RundownItem>): Promise<Result> {
  if (!can.manageRundown(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(rundownSchema, patch);
  if (!v.ok) return v;
  await updateRundown(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteRundownAction(id: string): Promise<Result> {
  if (!can.manageRundown(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteRundown(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------- Jobs (Hari-H) ----------------
export async function createJobAction(input: Partial<JobHariH>): Promise<Result> {
  if (!can.manageJobs(await getCurrentUser())) return DENY;
  const v = parse(jobSchema, input);
  if (!v.ok) return v;
  if (!v.data.job?.trim()) return { ok: false, error: "Deskripsi tugas wajib diisi." };
  await createJob(v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function updateJobAction(id: string, patch: Partial<JobHariH>): Promise<Result> {
  if (!can.manageJobs(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(jobSchema, patch);
  if (!v.ok) return v;
  await updateJob(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function deleteJobAction(id: string): Promise<Result> {
  if (!can.manageJobs(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteJob(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
