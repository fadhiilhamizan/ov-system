import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

// backup.ts is "server-only" and pulls in the Supabase server client; the
// parser under test touches neither, so both are stubbed away.
vi.mock("server-only", () => ({}));
vi.mock("./supabase/server", () => ({ createClient: vi.fn() }));

const { parseSnapshot } = await import("./backup");

// ------------------------------------------------------------------
// parseSnapshot is the ONLY thing between an uploaded file and a full-database
// overwrite, so these tests are written from the attacker's seat rather than
// the happy path.
// ------------------------------------------------------------------
describe("parseSnapshot - accepting a real backup", () => {
  it("accepts a snapshot and counts what it holds", () => {
    const res = parseSnapshot({
      events: [{ id: "ov1", title: "OV" }],
      tasks: [{ id: "t1" }, { id: "t2" }],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.tables).toBe(2);
      expect(res.rows).toBe(3);
      expect(res.data.events).toHaveLength(1);
    }
  });

  it("treats tables the file omits as empty rather than failing", () => {
    // Snapshots taken before task_links existed, and the demo project's schema,
    // both legitimately lack tables.
    const res = parseSnapshot({ events: [{ id: "ov1" }] });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.task_links).toEqual([]);
  });
});

describe("parseSnapshot - refusing everything else", () => {
  it("DROPS tables that are not backed up, so profiles can never ride along", () => {
    // profiles is excluded from backups on purpose: restoring it could hand
    // back an admin role that was removed deliberately. A hand-edited file
    // must not be able to smuggle it in.
    const res = parseSnapshot({
      events: [{ id: "ov1" }],
      profiles: [{ id: "u1", role: "admin" }],
      backups: [{ id: "b1" }],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).not.toHaveProperty("profiles");
      expect(res.data).not.toHaveProperty("backups");
    }
  });

  it("rejects an object with no recognisable table (would wipe everything)", () => {
    // Without this check any random JSON validates into an all-empty snapshot,
    // and restoring an all-empty snapshot deletes the database.
    expect(parseSnapshot({ hello: "world" }).ok).toBe(false);
    expect(parseSnapshot({ profiles: [{ id: "u1" }] }).ok).toBe(false);
  });

  it("rejects non-objects outright", () => {
    for (const bad of [null, undefined, 42, "text", [], true]) {
      expect(parseSnapshot(bad).ok).toBe(false);
    }
  });

  it("rejects a table that is not an array", () => {
    expect(parseSnapshot({ events: [{ id: "ov1" }], tasks: "oops" }).ok).toBe(false);
  });

  it("rejects a table containing something that is not a row", () => {
    const res = parseSnapshot({ events: [{ id: "ov1" }, "not-a-row"] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("Baris ke-2");
  });
});

// ------------------------------------------------------------------
// The restore now happens inside restore_snapshot() (migration 0043), which
// carries its OWN copy of the table order. Two copies of a list that must
// agree is exactly the shape of a bug that shows up months later, as a foreign
// key error halfway through somebody's restore, so pin them together here.
// ------------------------------------------------------------------
describe("DELETE_ORDER is the same list in TypeScript and in SQL", () => {
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

  /** The `del_order constant text[] := array[...]` literal from a SQL file. */
  function sqlOrder(sql: string): string[] {
    const m = sql.match(/del_order\s+constant\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/);
    if (!m) throw new Error("del_order array not found");
    return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  }

  /** The `const DELETE_ORDER = [...]` literal from backup.ts. */
  function tsOrder(): string[] {
    const m = read("src/lib/backup.ts").match(/const DELETE_ORDER = \[([\s\S]*?)\] as const;/);
    if (!m) throw new Error("DELETE_ORDER array not found");
    return [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
  }

  it("setup.sql matches backup.ts, in the same order", () => {
    expect(sqlOrder(read("supabase/setup.sql"))).toEqual(tsOrder());
  });

  it("the 0043 migration matches it too", () => {
    expect(sqlOrder(read("supabase/migrations/0043_restore_snapshot_rpc.sql"))).toEqual(tsOrder());
  });

  it("children really do come before their parents", () => {
    // A restore inserts in reverse, so anything holding a foreign key has to
    // appear BEFORE the table it points at.
    const order = tsOrder();
    const before = (child: string, parent: string) =>
      order.indexOf(child) < order.indexOf(parent);
    expect(before("task_links", "tasks")).toBe(true);
    expect(before("task_refs", "tasks")).toBe(true);
    expect(before("prospect_links", "prospects")).toBe(true);
    expect(before("budget_items", "budget_plans")).toBe(true);
    expect(before("tasks", "events")).toBe(true);
    expect(before("divisions", "events")).toBe(true);
  });

  it("finds the arrays at all (the check is not vacuous)", () => {
    expect(tsOrder().length).toBeGreaterThan(10);
    expect(sqlOrder(read("supabase/setup.sql")).length).toBe(tsOrder().length);
  });
});

describe("parseSnapshot - size ceiling", () => {
  it("accepts a file of ordinary size", () => {
    const events = Array.from({ length: 500 }, (_, i) => ({ id: `ov${i}` }));
    expect(parseSnapshot({ events }).ok).toBe(true);
  });

  it("refuses an absurdly large file instead of passing it to Postgres", () => {
    const tasks = Array.from({ length: 200_001 }, (_, i) => ({ id: `t${i}` }));
    const res = parseSnapshot({ tasks });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("terlalu besar");
  });
});
