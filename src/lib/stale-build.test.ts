import { describe, it, expect } from "vitest";
import { isStaleBuildError, withOneRetry } from "./stale-build";

describe("isStaleBuildError", () => {
  it("recognises an outdated tab after a deploy", () => {
    expect(isStaleBuildError(new Error('Server Action "7f3a" was not found on the server.'))).toBe(true);
    expect(isStaleBuildError(new Error("Failed to find Server Action \"abc\". This request might be from an older or newer deployment."))).toBe(true);
    expect(isStaleBuildError({ name: "ChunkLoadError", message: "Loading chunk 123 failed." })).toBe(true);
    expect(isStaleBuildError(new TypeError("Failed to fetch dynamically imported module: /x.js"))).toBe(true);
  });

  it("does not mistake ordinary failures for one", () => {
    expect(isStaleBuildError(new Error("Gagal menyimpan: duplicate key"))).toBe(false);
    expect(isStaleBuildError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isStaleBuildError(null)).toBe(false);
  });
});

describe("withOneRetry", () => {
  it("returns a verdict as-is, without retrying", async () => {
    let n = 0;
    const r = await withOneRetry(async () => { n++; return { ok: false }; }, 1);
    expect(r).toEqual({ ok: false });
    expect(n).toBe(1);
  });

  it("retries a throw once", async () => {
    let n = 0;
    const r = await withOneRetry(async () => { if (++n === 1) throw new Error("blip"); return "ok"; }, 1);
    expect(r).toBe("ok");
    expect(n).toBe(2);
  });

  it("does not retry an outdated build", async () => {
    let n = 0;
    await expect(withOneRetry(async () => { n++; throw new Error("Server Action x was not found"); }, 1)).rejects.toThrow();
    expect(n).toBe(1);
  });
});
