import "server-only";
import fs from "node:fs";
import path from "node:path";
import seed from "../seed/seed.json";
import type { Database } from "../types";

// ------------------------------------------------------------------
// Local JSON-backed store (development / demo backend).
// Reads the Excel-derived seed, persists mutations to .data/db.json.
// In production this module is replaced by the Supabase repository.
// ------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

let cache: Database | null = null;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function getDb(): Database {
  if (cache) return cache;
  try {
    if (fs.existsSync(DB_FILE)) {
      cache = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Database;
      return cache;
    }
  } catch {
    // fall through to seed
  }
  cache = clone(seed) as unknown as Database;
  persist();
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch {
    // read-only FS (e.g. some serverless) — keep in-memory only
  }
}

export function mutate<T>(fn: (db: Database) => T): T {
  const db = getDb();
  const result = fn(db);
  persist();
  return result;
}

/** Reset the local store back to the original Excel seed. */
export function resetDb() {
  cache = clone(seed) as unknown as Database;
  persist();
}
