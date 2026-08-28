import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================
// Every page that mounts TaskLinksProvider must fill in `refs` and `superLink`.
//
// The task dialog reads its reference data from that provider, so a page which
// mounts the provider with result links only gets a dialog that: shows an empty
// Super Link picker, hides the references the task already has, and (before the
// undefined-vs-empty guard in task-links-context.tsx) sent an empty list on
// save, which the server correctly read as "delete them all". Papan Divisi and
// Kalender shipped that way, so editing a task there quietly wiped every
// reference added from Work Breakdown.
//
// The guard in the context now prevents the data loss; this test prevents the
// half-empty dialog, which no type can catch because both props are optional by
// design (the provider predates references).
// ============================================================

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const APP = join(ROOT, "app");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".data", "dist", "build"]);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (extname(entry.name) === ".tsx") acc.push(full);
  }
  return acc;
}

/** The opening tag, up to the first `>`, for each mount in one file. */
function providerTags(text: string): string[] {
  return [...text.matchAll(/<TaskLinksProvider[\s\S]*?>/g)].map((m) => m[0]);
}

describe("TaskLinksProvider mounts", () => {
  it("always pass refs and superLink", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(APP)) {
      const text = readFileSync(file, "utf8");
      for (const tag of providerTags(text)) {
        const missing = ["refs=", "superLink="].filter((p) => !tag.includes(p));
        if (!missing.length) continue;
        const line = text.split("\n").findIndex((l) => l.includes("<TaskLinksProvider")) + 1;
        offenders.push(
          `${relative(ROOT, file).replace(/\\/g, "/")}:${line} (missing ${missing.join(", ")})`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("finds every mount it is supposed to check (the scan is not vacuous)", () => {
    const mounts = sourceFiles(APP).flatMap((f) => providerTags(readFileSync(f, "utf8")));
    // Work Breakdown, Papan Divisi and Kalender. A new one is welcome, but a
    // scan that suddenly matches nothing is a broken test, not a clean repo.
    expect(mounts.length).toBeGreaterThanOrEqual(3);
    expect(providerTags("<TaskLinksProvider value={x}>")).toHaveLength(1);
  });
});
