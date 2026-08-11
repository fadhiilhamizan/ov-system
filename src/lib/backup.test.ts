import { describe, it, expect, vi } from "vitest";

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
