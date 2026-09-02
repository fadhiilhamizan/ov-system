import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================
// There is ONE backend, and this is what keeps it that way.
//
// Until v1.42.0 `repo.ts` carried an `if (!USE_SUPABASE) return local.x(...)`
// branch in almost every function - 74 single-line guards, 8 blocks and 3
// ternaries - into `data/local.ts`, a 959-line, 82-function reimplementation of
// the entire product against a JSON file. It ran only when the environment was
// completely empty, had no tests, and had to be kept in lock-step with every
// schema change by hand. It had already drifted: `local.getDivisions` matched
// `event_id` leniently where the Supabase version is strict, so the same call
// returned different rows depending on a variable nobody sets.
//
// A second implementation is not a thing you delete once. It is a thing that
// grows back, one "just for local dev" helper at a time, because reintroducing
// it always looks small. So the deletion is asserted rather than remembered.
//
// This does NOT touch demo mode. That is a SEPARATE Supabase project selected
// by the `ov_demo` cookie in supabase/server.ts, and it is unaffected.
// ============================================================

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

const rel = (file: string) => file.slice(SRC.length + 1).replace(/\\/g, "/");

describe("one backend", () => {
  it("the local JSON store is gone", () => {
    expect(existsSync(join(SRC, "lib/data/local.ts"))).toBe(false);
    expect(existsSync(join(SRC, "lib/data/store.ts"))).toBe(false);
  });

  it("nothing branches on whether a backend is configured", () => {
    // A flag like this is how the second implementation gets its foothold: it
    // starts as one honest "are we set up?" check and ends as a fork in every
    // function. Configuration is checked ONCE, in supabase/server.ts, and a
    // missing value throws there with a message naming the variable.
    const offenders = sourceFiles(SRC)
      .filter((f) => !f.endsWith("single-backend.test.ts"))
      .filter((f) => /\bUSE_SUPABASE\b/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("the repository imports no second data source", () => {
    const repo = readFileSync(join(SRC, "lib/data/repo.ts"), "utf8");
    const imports = [...repo.matchAll(/^import .*? from "(.*?)";$/gm)].map((m) => m[1]);
    expect(imports).not.toContain("./local");
    expect(imports).not.toContain("./store");
  });

  it("a missing configuration fails with a sentence, not a library error", () => {
    // The replacement for "silently fall back to JSON" is "say what is missing".
    // `createServerClient(undefined!, undefined!)` throws "supabaseUrl is
    // required" from inside node_modules, on whichever page happened to read
    // data first, naming none of the four variables involved.
    const server = readFileSync(join(SRC, "lib/supabase/server.ts"), "utf8");
    expect(server).toMatch(/if \(!url \|\| !key\)/);
    expect(server).toMatch(/\.env\.example/);
  });
});
