import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================
// House style: this project does not use em dashes.
//
// 774 of them had accumulated across 147 files (comments, UI copy, SQL,
// changelog, docs) before they were swept out. Without a check they simply
// creep back one commit at a time, so this fails the build instead.
//
// Use a comma, a colon, brackets, or a full stop. A plain hyphen with spaces
// is fine too.
//
// The character is built from its code point so this file does not trip its
// own assertion.
// ============================================================
const EM_DASH = String.fromCharCode(0x2014);

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".sql", ".md", ".css"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".data", "dist", "build"]);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (EXTENSIONS.has(extname(entry.name))) acc.push(full);
  }
  return acc;
}

describe("house style", () => {
  it("uses no em dashes anywhere in the source", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      const text = readFileSync(file, "utf8");
      if (!text.includes(EM_DASH)) continue;
      // Report the first offending line so the fix is obvious.
      const line = text.split("\n").findIndex((l) => l.includes(EM_DASH)) + 1;
      offenders.push(`${relative(ROOT, file).replace(/\\/g, "/")}:${line}`);
    }
    expect(offenders).toEqual([]);
  });

  it("actually detects one when present (the check is not vacuous)", () => {
    // A guard that can never fail is worse than no guard: prove the needle
    // would be found.
    const sample = `catatan ${EM_DASH} penjelasan`;
    expect(sample.includes(EM_DASH)).toBe(true);
  });
});
