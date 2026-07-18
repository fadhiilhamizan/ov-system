import "server-only";
import { createClient } from "./supabase/server";

/** Tables backed up, in FK-safe DELETE order (children before parents). */
const DELETE_ORDER = [
  "budget_items",
  "tasks",
  "members",
  "teams",
  "rundown",
  "job_harih",
  "prospects",
  "links",
  "budget_plans",
  "faqs",
  "divisions",
  "events",
] as const;

/** Same tables, in FK-safe INSERT order (parents before children). */
const INSERT_ORDER = [...DELETE_ORDER].reverse();

export type BackupData = Record<(typeof DELETE_ORDER)[number], Record<string, unknown>[]>;

export interface BackupMeta {
  id: string;
  kind: "manual" | "auto" | "pre_restore";
  created_at: string;
}

/** Snapshot every mutable app table as raw rows (1:1 with the DB schema). */
export async function captureSnapshot(): Promise<BackupData> {
  const client = await createClient();
  const snapshot = {} as BackupData;
  for (const table of DELETE_ORDER) {
    const { data, error } = await client.from(table).select("*");
    if (error) throw new Error(`Gagal membaca tabel ${table}: ${error.message}`);
    snapshot[table] = data ?? [];
  }
  return snapshot;
}

export async function createBackup(kind: BackupMeta["kind"], userId?: string): Promise<string> {
  const client = await createClient();
  const data = await captureSnapshot();
  const { data: row, error } = await client
    .from("backups")
    .insert({ kind, data, created_by: userId ?? null })
    .select("id")
    .single();
  if (error) throw new Error(`Gagal menyimpan backup: ${error.message}`);

  // Retention: keep only the 10 most recent automatic backups.
  if (kind === "auto") {
    const { data: autos } = await client
      .from("backups")
      .select("id")
      .eq("kind", "auto")
      .order("created_at", { ascending: false });
    const stale = (autos ?? []).slice(10).map((b: { id: string }) => b.id);
    if (stale.length) await client.from("backups").delete().in("id", stale);
  }

  return row.id as string;
}

export async function listBackups(): Promise<BackupMeta[]> {
  const client = await createClient();
  const { data } = await client
    .from("backups")
    .select("id, kind, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as BackupMeta[];
}

export async function getBackupData(id: string): Promise<BackupData | null> {
  const client = await createClient();
  const { data } = await client.from("backups").select("data").eq("id", id).maybeSingle();
  return (data?.data as BackupData) ?? null;
}

export async function deleteBackup(id: string): Promise<void> {
  const client = await createClient();
  await client.from("backups").delete().eq("id", id);
}

/**
 * Replace all current data with a snapshot's contents. Deletes every row in
 * the affected tables (children first) then reinserts the snapshot's rows
 * (parents first), preserving original IDs so foreign keys stay valid.
 * Not wrapped in a single DB transaction — callers should take a
 * `pre_restore` backup first so a partial failure is always recoverable.
 */
export async function restoreSnapshot(data: BackupData): Promise<void> {
  const client = await createClient();
  for (const table of DELETE_ORDER) {
    // Match-everything delete: id is a uuid/text primary key on every table.
    const { error } = await client.from(table).delete().not("id", "is", null);
    if (error) throw new Error(`Gagal menghapus data lama di ${table}: ${error.message}`);
  }
  for (const table of INSERT_ORDER) {
    const rows = data[table];
    if (!rows?.length) continue;
    const { error } = await client.from(table).insert(rows);
    if (error) throw new Error(`Gagal memulihkan data ${table}: ${error.message}`);
  }
}
