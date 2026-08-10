"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser, USE_SUPABASE } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createBackup, listBackups, getBackupData, deleteBackup, restoreSnapshot, parseSnapshot,
  type BackupData, type BackupMeta,
} from "@/lib/backup";

type Result = { ok: true } | { ok: false; error: string };
const DENY = { ok: false as const, error: "Kamu tidak punya akses mengelola backup." };
const NO_SUPABASE = { ok: false as const, error: "Backup hanya tersedia saat terhubung ke Supabase." };

export async function createBackupAction(): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageBackups(user)) return DENY;
  if (!USE_SUPABASE) return NO_SUPABASE;
  try {
    await createBackup("manual", user.id);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal membuat backup." };
  }
}

type ListResult = { ok: true; backups: BackupMeta[] } | { ok: false; error: string };
export async function listBackupsAction(): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!can.manageBackups(user)) return DENY;
  if (!USE_SUPABASE) return NO_SUPABASE;
  const backups = await listBackups();
  return { ok: true, backups };
}

type DownloadResult = { ok: true; data: BackupData } | { ok: false; error: string };
export async function downloadBackupAction(id: string): Promise<DownloadResult> {
  const user = await getCurrentUser();
  if (!can.manageBackups(user)) return DENY;
  if (!USE_SUPABASE) return NO_SUPABASE;
  const data = await getBackupData(id);
  if (!data) return { ok: false, error: "Backup tidak ditemukan." };
  return { ok: true, data };
}

export async function deleteBackupAction(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageBackups(user)) return DENY;
  if (!USE_SUPABASE) return NO_SUPABASE;
  try {
    await deleteBackup(id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghapus backup." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Restore from a JSON file the user previously downloaded.
 *
 * The payload arrives as already-parsed JSON from the browser, so it is
 * untrusted: `parseSnapshot` whitelists it down to the known tables before any
 * of it reaches the database. As with a stored-backup restore, a `pre_restore`
 * snapshot is taken first so a bad import is always recoverable.
 */
export async function importBackupAction(raw: unknown): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageBackups(user)) return DENY;
  if (!USE_SUPABASE) return NO_SUPABASE;
  const parsed = parseSnapshot(raw);
  if (!parsed.ok) return parsed;
  try {
    await createBackup("pre_restore", user.id);
    await restoreSnapshot(parsed.data);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengimpor backup." };
  }
}

/** Read-only shape check, so the UI can show what a file contains BEFORE the
 *  user commits to overwriting everything with it. */
type InspectResult =
  | { ok: true; tables: number; rows: number }
  | { ok: false; error: string };
export async function inspectBackupFileAction(raw: unknown): Promise<InspectResult> {
  if (!can.manageBackups(await getCurrentUser())) return DENY;
  const parsed = parseSnapshot(raw);
  return parsed.ok ? { ok: true, tables: parsed.tables, rows: parsed.rows } : parsed;
}

export async function restoreBackupAction(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageBackups(user)) return DENY;
  if (!USE_SUPABASE) return NO_SUPABASE;
  try {
    // Safety net: snapshot current state before overwriting anything.
    await createBackup("pre_restore", user.id);
    const data = await getBackupData(id);
    if (!data) return { ok: false, error: "Backup tidak ditemukan." };
    await restoreSnapshot(data);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memulihkan backup." };
  }
}
