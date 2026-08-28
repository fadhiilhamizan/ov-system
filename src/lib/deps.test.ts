import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================
// Every runtime dependency must actually be imported somewhere.
//
// `date-fns`, `@radix-ui/react-avatar` and `@radix-ui/react-tooltip` all sat in
// `dependencies` with ZERO imports across the whole codebase - two of them had
// never been used at all, and the third outlived the component that used it.
// Nothing catches that: an unused package type-checks, lints and tests clean,
// it just gets installed, audited, and dragged through every `npm ci`.
//
// devDependencies are deliberately NOT checked: build tooling (tailwind,
// postcss, eslint configs, type packages) is used through config files and
// plugin resolution rather than by importing it.
// ============================================================
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Packages that are legitimately present without a direct import.
 * Keep this SHORT and say why - it is the escape hatch that makes the check
 * useless if it fills up.
 */
const USED_WITHOUT_IMPORT: Record<string, string> = {
  // Peer of @supabase/ssr: it is where the client and its types actually come
  // from, and `ssr` re-exports them. Removing it breaks the type surface.
  "@supabase/supabase-js": "peer of @supabase/ssr, supplies the client types",
};

const SCAN_DIRS = ["src", "scripts"];
const SCAN_FILES = ["next.config.ts", "proxy.ts", "postcss.config.mjs", "vitest.config.ts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".js"]);

/**
 * Runtime source only: test files are skipped.
 *
 * Two reasons, and the second one bit immediately. A package imported ONLY by a
 * test is a devDependency, not a runtime one, so counting tests would let a
 * misplaced dependency pass. And this file names packages in string literals -
 * scanning itself made every exemption look "imported" and made the
 * not-vacuous check pass against its own fake package name.
 */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (EXTENSIONS.has(extname(entry.name)) && !/\.(test|spec)\.[tj]sx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function allSource(): string {
  const files = SCAN_DIRS.flatMap((d) => sourceFiles(join(ROOT, d)));
  for (const f of SCAN_FILES) files.push(join(ROOT, f));
  return files.map((f) => readFileSync(f, "utf8")).join("\n");
}

/** Does `source` import `pkg`, either bare or as a subpath? */
function isImported(source: string, pkg: string): boolean {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // from "pkg" | from "pkg/sub" | require("pkg") | import("pkg")
  return new RegExp(`["'\`]${escaped}(/[^"'\`]*)?["'\`]`).test(source);
}

describe("dependencies", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const source = allSource();

  it("every runtime dependency is imported somewhere", () => {
    const unused = Object.keys(pkg.dependencies)
      .filter((name) => !(name in USED_WITHOUT_IMPORT))
      .filter((name) => !isImported(source, name));
    expect(unused, `Dependencies with no import (remove them, or explain them in USED_WITHOUT_IMPORT): ${unused.join(", ")}`).toEqual([]);
  });

  it("the escape hatch does not list packages that ARE imported", () => {
    // A stale exemption hides a real one. If a package here starts being
    // imported normally, drop it from the list.
    const stale = Object.keys(USED_WITHOUT_IMPORT).filter((name) => isImported(source, name));
    expect(stale).toEqual([]);
  });

  it("every exempted package is actually still a dependency", () => {
    const orphan = Object.keys(USED_WITHOUT_IMPORT).filter((n) => !(n in pkg.dependencies));
    expect(orphan).toEqual([]);
  });

  it("detects an unimported package (the check is not vacuous)", () => {
    // A guard that cannot fail is worse than no guard.
    expect(isImported(source, "a-package-nobody-installed")).toBe(false);
    expect(isImported(source, "next")).toBe(true);
  });
});
