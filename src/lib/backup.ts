import "server-only";
import { createClient } from "./supabase/server";

/**
 * Tables backed up, in FK-safe DELETE order (children before parents).
 *
 * `task_links` MUST stay first and ahead of both `tasks` and `links`: it is a
 * child of tasks (ON DELETE CASCADE) and of links (ON DELETE SET NULL). It was
 * missing from this list until v1.20.0, which meant a restore wiped every task
 * result link permanently — the delete pass cascaded them away with the tasks,
 * and the snapshot had nothing to put back.
 *
 * Deliberately NOT backed up:
 *  - `profiles`  — who is an admin is account state, not project data. Rolling
 *    it back could silently restore a role someone had removed on purpose.
 *  - `role_requests` — administrative workflow, and its `user_id` points at
 *    `auth.users`; restoring a row whose account was since deleted would fail
 *    the whole restore on a foreign key.
 *  - `backups` itself.
 */
const DELETE_ORDER = [
  "task_links",
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

/**
 * `auto` is retired: scheduled backups were removed in v1.20.0 and nothing
 * creates one any more. The value stays in the union (and in the DB CHECK
 * constraint) so snapshots taken before then still load and render.
 */
export interface BackupMeta {
  id: string;
  kind: "manual" | "auto" | "pre_restore";
  created_at: string;
}

/** A table the schema doesn't have (the demo project trails production). */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist/i.test(error.message ?? "");
}

/**
 * Snapshot every mutable app table as raw rows (1:1 with the DB schema).
 *
 * Always runs as the signed-in admin (RLS-scoped). Backups are manual only —
 * there is no unattended path that would need a service-role client.
 */
export async function captureSnapshot(): Promise<BackupData> {
  const client = await createClient();
  const snapshot = {} as BackupData;
  for (const table of DELETE_ORDER) {
    const { data, error } = await client.from(table).select("*");
    if (error) {
      if (isMissingTable(error)) {
        snapshot[table] = [];
        continue;
      }
      throw new Error(`Gagal membaca tabel ${table}: ${error.message}`);
    }
    snapshot[table] = data ?? [];
  }
  return snapshot;
}

export async function createBackup(
  kind: Exclude<BackupMeta["kind"], "auto">,
  userId?: string,
): Promise<string> {
  const db = await createClient();
  const data = await captureSnapshot();

  // A snapshot with nothing in it is the signature of a read that RLS filtered
  // away (it returns zero rows rather than an error). Storing it would put a
  // useless entry in the list and, worse, offer it for restore.
  const totalRows = Object.values(data).reduce((n, rows) => n + rows.length, 0);
  if (totalRows === 0) {
    throw new Error(
      "Snapshot kosong — backup dibatalkan. Biasanya ini berarti sesi tidak punya izin baca (RLS).",
    );
  }

  const { data: row, error } = await db
    .from("backups")
    .insert({ kind, data, created_by: userId ?? null })
    .select("id")
    .single();
  if (error) throw new Error(`Gagal menyimpan backup: ${error.message}`);
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
  const { error } = await client.from("backups").delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus backup: ${error.message}`);
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
    if (error) {
      if (isMissingTable(error)) continue;
      throw new Error(`Gagal menghapus data lama di ${table}: ${error.message}`);
    }
  }
  for (const table of INSERT_ORDER) {
    const rows = data[table];
    if (!rows?.length) continue;
    const { error } = await client.from(table).insert(rows);
    if (error) {
      if (isMissingTable(error)) continue;
      throw new Error(`Gagal memulihkan data ${table}: ${error.message}`);
    }
  }
}
