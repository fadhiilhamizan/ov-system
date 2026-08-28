import "server-only";
import { createClient } from "./supabase/server";

/**
 * Tables backed up, in FK-safe DELETE order (children before parents).
 *
 * `task_links` MUST stay first and ahead of both `tasks` and `links`: it is a
 * child of tasks (ON DELETE CASCADE) and of links (ON DELETE SET NULL). It was
 * missing from this list until v1.20.0, which meant a restore wiped every task
 * result link permanently - the delete pass cascaded them away with the tasks,
 * and the snapshot had nothing to put back.
 *
 * Deliberately NOT backed up:
 *  - `profiles`  - who is an admin is account state, not project data. Rolling
 *    it back could silently restore a role someone had removed on purpose.
 *  - `role_requests` - administrative workflow, and its `user_id` points at
 *    `auth.users`; restoring a row whose account was since deleted would fail
 *    the whole restore on a foreign key.
 *  - `backups` itself.
 */
const DELETE_ORDER = [
  "task_links",
  // task_refs is a child of tasks (CASCADE) and of links (SET NULL), so it has
  // to be deleted before both, for the same reason task_links does. Leaving it
  // out would mean a restore silently loses every task reference.
  "task_refs",
  // prospect_links (0038) is the same shape again: a child of prospects
  // (CASCADE) and of links (SET NULL), so it goes before both.
  "prospect_links",
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

// No INSERT_ORDER here any more: the restore happens inside
// `restore_snapshot()` (migration 0043), which walks its own copy of this list
// backwards. `backup.test.ts` asserts the two lists are identical - if they
// drift, a restore inserts a child before its parent and fails on a foreign
// key, which is exactly the mid-restore failure the RPC exists to prevent.

export type BackupData = Record<(typeof DELETE_ORDER)[number], Record<string, unknown>[]>;

/**
 * Ceiling on how many rows an uploaded file may claim to hold.
 *
 * A real edition is hundreds of rows; the whole database across every edition
 * is thousands. There was no limit at all, so an uploaded file could ask the
 * server to parse and then ship an arbitrarily large JSON blob to Postgres in
 * one statement. This is a sanity bound on an admin-only path, not a security
 * boundary - it exists so a corrupt or absurd file is refused with a sentence
 * instead of being sent onward.
 */
const MAX_ROWS = 200_000;

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
 * Always runs as the signed-in admin (RLS-scoped). Backups are manual only -
 * there is no unattended path that would need a service-role client.
 */
export async function captureSnapshot(): Promise<BackupData> {
  const client = await createClient();
  // Fifteen independent reads: they were awaited one after another, so a backup
  // cost fifteen sequential round trips for no reason. Nothing here depends on
  // anything else here.
  const results = await Promise.all(
    DELETE_ORDER.map(async (table) => {
      const { data, error } = await client.from(table).select("*");
      if (error) {
        // A table the schema does not have (the demo project trails production)
        // is an empty section, not a failure.
        if (isMissingTable(error)) return { table, rows: [] as Record<string, unknown>[] };
        throw new Error(`Gagal membaca tabel ${table}: ${error.message}`);
      }
      return { table, rows: (data ?? []) as Record<string, unknown>[] };
    }),
  );
  const snapshot = {} as BackupData;
  for (const { table, rows } of results) snapshot[table] = rows;
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
      "Snapshot kosong - backup dibatalkan. Biasanya ini berarti sesi tidak punya izin baca (RLS).",
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
 * Turn an untrusted parsed-JSON blob into a BackupData, or explain why not.
 *
 * This is the ONLY thing standing between an uploaded file and a full-database
 * overwrite, so it is a whitelist, not a sanity check: any key that is not one
 * of the backed-up tables is DROPPED rather than passed through. That matters
 * because `profiles` is deliberately excluded from backups (restoring it could
 * silently hand back an admin role that was removed on purpose) - a
 * hand-edited file naming it must not be able to sneak it back in.
 *
 * Missing tables are tolerated and treated as empty: older snapshots predate
 * `task_links`, and the demo project's schema legitimately lacks tables.
 */
export function parseSnapshot(
  raw: unknown,
): { ok: true; data: BackupData; tables: number; rows: number } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "File tidak dikenali: isinya bukan objek backup." };
  }
  const src = raw as Record<string, unknown>;

  // A backup file has at least one known table. Without this check any random
  // JSON object would "validate" into an all-empty snapshot and wipe the DB.
  if (!DELETE_ORDER.some((tbl) => Array.isArray(src[tbl]))) {
    return {
      ok: false,
      error: "File ini bukan backup Ormawa Visit (tidak ada satu pun tabel yang dikenali).",
    };
  }

  const data = {} as BackupData;
  let tables = 0;
  let rows = 0;
  for (const tbl of DELETE_ORDER) {
    const value = src[tbl];
    if (value === undefined || value === null) { data[tbl] = []; continue; }
    if (!Array.isArray(value)) {
      return { ok: false, error: `Tabel "${tbl}" pada file rusak: seharusnya berupa daftar baris.` };
    }
    const bad = value.findIndex((r) => !r || typeof r !== "object" || Array.isArray(r));
    if (bad >= 0) {
      return { ok: false, error: `Baris ke-${bad + 1} pada tabel "${tbl}" rusak.` };
    }
    data[tbl] = value as Record<string, unknown>[];
    if (value.length) { tables++; rows += value.length; }
    if (rows > MAX_ROWS) {
      return {
        ok: false,
        error: `File terlalu besar: lebih dari ${MAX_ROWS.toLocaleString("id-ID")} baris. Ini jauh di atas ukuran wajar satu backup Ormawa Visit.`,
      };
    }
  }
  return { ok: true, data, tables, rows };
}

/**
 * Replace all current data with a snapshot's contents, ATOMICALLY.
 *
 * One RPC call, one transaction. This used to be thirty statements sent from
 * here - fifteen deletes then fifteen inserts, each its own transaction - so a
 * failure on the ninth left the database half restored: some tables emptied,
 * some refilled, and no way back except the `pre_restore` snapshot and a
 * careful manual retry. `restore_snapshot()` (migration 0043) does the same
 * work inside a plpgsql body, so any failure rolls the whole thing back and the
 * old data is still there.
 *
 * It is SECURITY INVOKER, so RLS still applies exactly as it did: nothing in
 * this app bypasses the policies. The function also refuses a non-admin caller
 * outright, which is why a failure here reads as a sentence rather than as
 * fifteen partial successes.
 *
 * Returns what it did, per table, so the caller can report it.
 */
export type RestoreReport = Record<string, { deleted: number; inserted: number }>;

export async function restoreSnapshot(data: BackupData): Promise<RestoreReport> {
  const client = await createClient();
  const { data: report, error } = await client.rpc("restore_snapshot", { payload: data });
  if (error) {
    // 42501 is the function's own admin check; anything else is a constraint
    // or a column the snapshot cannot satisfy. Either way NOTHING changed.
    throw new Error(
      error.code === "42501"
        ? "Hanya admin yang bisa memulihkan backup."
        : `Gagal memulihkan backup: ${error.message}. Tidak ada data yang berubah.`,
    );
  }
  return (report ?? {}) as RestoreReport;
}
