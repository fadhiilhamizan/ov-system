import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EN } from "./dict.en";

// ============================================================
// Translation coverage.
//
// `translate()` falls back to the Indonesian source string when a key is
// missing, which is deliberate (a partial dictionary still renders) — but it
// also means a forgotten entry is INVISIBLE unless someone switches to English
// and reads every screen. Sixty strings had quietly accumulated that way.
//
// This walks the source, pulls out every literal handed to t()/tr(), and fails
// when one has no English entry. Adding a user-facing string now forces adding
// its translation in the same change.
// ============================================================

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

/**
 * Strings that are the same word in both languages, so an entry would be noise.
 * Keep this list short and specific — it is an exemption, not a dumping ground.
 */
const IDENTICAL_IN_BOTH = new Set([
  "Dashboard", "Work Breakdown", "Rundown", "Status", "Email", "Offline", "Online",
  "PIC", "MC", "FGD", "RAB", "Super Link", "Reach & Offer", "Ormawa Visit",
  "Performance Measurement", "Template", "Demo", "Admin", "Intern", "Staff",
]);

/** Literals with no letters (numbers, arrows, punctuation) need no translation. */
const hasLetters = (s: string) => /[A-Za-z]/.test(s);

function missingTranslations(): { text: string; files: string[] }[] {
  const found = new Map<string, Set<string>>();
  for (const file of sourceFiles(SRC)) {
    if (file.includes("dict.en")) continue;
    const src = readFileSync(file, "utf8");
    // Only single-argument, double-quoted calls: t("…") / tr("…").
    for (const m of src.matchAll(/\b(?:t|tr)\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)) {
      const text = m[1].replace(/\\"/g, '"');
      if (!text.trim() || !hasLetters(text)) continue;
      if (IDENTICAL_IN_BOTH.has(text)) continue;
      if (EN[text]) continue;
      const rel = file.slice(SRC.length + 1).replace(/\\/g, "/");
      if (!found.has(text)) found.set(text, new Set());
      found.get(text)!.add(rel);
    }
  }
  return [...found.entries()]
    .map(([text, files]) => ({ text, files: [...files] }))
    .sort((a, b) => a.text.localeCompare(b.text));
}

describe("EN translation coverage", () => {
  it("every string passed to t() has an English entry", () => {
    const missing = missingTranslations();
    const report = missing.map((m) => `  ${JSON.stringify(m.text)}\n      ${m.files.join(", ")}`).join("\n");
    expect(missing, `Tanpa terjemahan EN (${missing.length}):\n${report}`).toEqual([]);
  });

  it("no dictionary entry is blank", () => {
    // A value IDENTICAL to its key is fine and common — "Kanban", "Deadline",
    // "Qty", "Backup", "Ormawa Visit" are the same word in both languages, and
    // spelling them out beats leaving them to the fallback (an explicit entry is
    // a decision; a missing one is an oversight). A BLANK value is always a bug:
    // it renders as empty text on screen.
    const blank = Object.entries(EN).filter(([, en]) => !en.trim());
    expect(blank.map(([id]) => id)).toEqual([]);
  });
});
