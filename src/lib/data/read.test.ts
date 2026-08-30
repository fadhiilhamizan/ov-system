import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isSchemaGap, readRows } from "./read";

// ============================================================
// The read policy: a missing table degrades, everything else is surfaced.
//
// This is the guard against the shape of bug that reads used to have. A getter
// that returns [] on any error tells the page there is no data, and the page
// believes it - there is no way, anywhere downstream, to tell "this edition has
// no tasks" from "the query failed". Both halves matter, so both are pinned:
// that a schema gap really does still degrade (the demo project depends on it),
// and that nothing else does.
// ============================================================

/** A resolved Supabase-shaped result. */
const ok = <T,>(data: T) => Promise.resolve({ data, error: null });
const fails = (error: { code?: string; message?: string }) =>
  Promise.resolve({ data: null, error });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe("isSchemaGap", () => {
  it("recognises a missing table or column", () => {
    expect(isSchemaGap({ code: "42P01", message: 'relation "fgd_plans" does not exist' })).toBe(true);
    expect(isSchemaGap({ code: "42703", message: 'column "merges" does not exist' })).toBe(true);
  });

  it("recognises PostgREST's own schema-cache miss", () => {
    expect(isSchemaGap({ code: "PGRST205", message: "Could not find the table in the schema cache" })).toBe(true);
  });

  it("falls back to the message when the code is absent", () => {
    expect(isSchemaGap({ message: "Could not find the 'merges' column in the schema cache" })).toBe(true);
  });

  it("does not treat an operational failure as a gap", () => {
    expect(isSchemaGap({ code: "42501", message: "permission denied for table members" })).toBe(false);
    expect(isSchemaGap({ code: "PGRST301", message: "JWT expired" })).toBe(false);
    expect(isSchemaGap({ message: "TypeError: fetch failed" })).toBe(false);
    expect(isSchemaGap(null)).toBe(false);
  });
});

describe("readRows", () => {
  it("returns the rows on success", async () => {
    await expect(readRows("tasks", ok([{ id: "t1" }]), [])).resolves.toEqual([{ id: "t1" }]);
  });

  it("returns the fallback when the query succeeded with no rows", async () => {
    await expect(readRows("tasks", ok(null), [])).resolves.toEqual([]);
  });

  it("degrades to the fallback for a table this database does not have", async () => {
    // The demo project is pinned below 0040, so Himpunan's tables are absent
    // there and the page still has to render.
    await expect(
      readRows("fgd plans", fails({ code: "42P01", message: 'relation "fgd_plans" does not exist' }), []),
    ).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("THROWS on a revoked grant instead of reporting an empty table", async () => {
    // REGRESSION: this used to come back as [] and render as "no members".
    await expect(
      readRows("members", fails({ code: "42501", message: "permission denied for table members" }), []),
    ).rejects.toThrow(/members.*permission denied/);
  });

  it("throws on a lost connection", async () => {
    await expect(
      readRows("events", fails({ message: "TypeError: fetch failed" }), []),
    ).rejects.toThrow(/fetch failed/);
    expect(warn).not.toHaveBeenCalled();
  });

  it("names the read in the error, so the log points at the query", async () => {
    await expect(
      readRows("budget plans", fails({ code: "PGRST301", message: "JWT expired" }), []),
    ).rejects.toThrow("budget plans: JWT expired");
  });
});
