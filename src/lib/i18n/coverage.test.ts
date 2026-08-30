import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EN } from "./dict.en";

// ============================================================
// Translation coverage.
//
// `translate()` falls back to the Indonesian source string when a key is
// missing, which is deliberate (a partial dictionary still renders) - but it
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
 * Keep this list short and specific - it is an exemption, not a dumping ground.
 */
const IDENTICAL_IN_BOTH = new Set([
  "Dashboard", "Work Breakdown", "Rundown", "Status", "Email", "Offline", "Online",
  "PIC", "MC", "FAQ", "FGD", "RAB", "Super Link", "Reach & Offer", "Ormawa Visit",
  "Performance Measurement", "Template", "Demo", "Admin", "Intern", "Staff",
]);

/**
 * A single-argument t()/tr() call, in any quote style.
 *
 * The backtick branch deliberately excludes `$` and a backslash: a template
 * WITH an interpolation has no key until runtime, so there is nothing a static
 * scan could look up. Those are reported separately below rather than skipped,
 * because silently ignoring them is how this blind spot stayed open.
 */
const T_CALL =
  /\b(?:t|tr)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`$\\]*)`)\s*\)/g;

/** A t() call whose argument is NOT a checkable literal. */
const T_DYNAMIC = /\b(?:t|tr)\(\s*`[^`]*\$\{/g;

/** Literals with no letters (numbers, arrows, punctuation) need no translation. */
const hasLetters = (s: string) => /[A-Za-z]/.test(s);

function missingTranslations(): { text: string; files: string[] }[] {
  const found = new Map<string, Set<string>>();
  for (const file of sourceFiles(SRC)) {
    if (file.includes("dict.en")) continue;
    const src = readFileSync(file, "utf8");
    // Single-argument calls in any of the three quote styles: t("…"),
    // t('…'), and a backtick literal with nothing interpolated into it. The
    // extractor understood double quotes ONLY, so the other two walked past it.
    for (const m of src.matchAll(T_CALL)) {
      const text = (m[1] ?? m[2] ?? m[3]).replace(/\\(["'])/g, "$1");
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

/**
 * Attributes whose whole purpose is to be read by a person.
 *
 * Deliberately NOT `placeholder`: a placeholder is usually SAMPLE DATA, and
 * "HMTI UB, KBMDSI, …" or "Tower 2 Lt.2 ITS" are Indonesian proper nouns that
 * would be silly to translate. `aria-label` and `title` are never sample data,
 * they are always an instruction to a human, so a raw literal in one is always
 * a missed translation.
 */
const READABLE_ATTR = /\s(aria-label|title)="([^"]{2,})"/g;

/**
 * Files exempt from the attribute rule, with the reason.
 *
 * The Developer menu is hidden behind an email allowlist and read by one
 * person, who wrote it. Translating it would add dictionary entries for a UI
 * that nobody else can reach. Keep this list to whole subtrees with a reason,
 * not to individual strings someone did not feel like translating.
 */
// Paths are relative to src/, the way `rel` below builds them.
const ATTR_EXEMPT: [prefix: string, why: string][] = [
  ["components/developer/", "menu tersembunyi, hanya untuk developer sendiri"],
  ["app/developer/", "menu tersembunyi, hanya untuk developer sendiri"],
];

function untranslatedAttributes(): string[] {
  const out: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, "/");
    if (ATTR_EXEMPT.some(([prefix]) => rel.startsWith(prefix))) continue;
    const src = readFileSync(file, "utf8");
    src.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(READABLE_ATTR)) {
        const text = m[2];
        if (!hasLetters(text)) continue;
        // Same escape as the t() scan: a word spelled the same in both
        // languages needs no wrapper at all.
        if (IDENTICAL_IN_BOTH.has(text)) continue;
        out.push(`${rel}:${i + 1}  ${m[1]}="${text}"`);
      }
    });
  }
  return out.sort();
}

describe("EN translation coverage", () => {

  it("every string passed to t() has an English entry", () => {
    const missing = missingTranslations();
    const report = missing.map((m) => `  ${JSON.stringify(m.text)}\n      ${m.files.join(", ")}`).join("\n");
    expect(missing, `Tanpa terjemahan EN (${missing.length}):\n${report}`).toEqual([]);
  });

  it("no aria-label or title is a raw string", () => {
    // The OTHER blind spot, and the one the t() scan could never see: a string
    // that was never wrapped in t() at all. Four of these shipped in Indonesian
    // only (faq-list, jobs-table, fgd-panel, the language toggle), and one of
    // them was the reverse - an English label hardcoded into an app whose
    // source language is Indonesian.
    //
    // Screen-reader text is exactly where this hides, because nothing on screen
    // looks wrong when it is missing.
    const raw = untranslatedAttributes();
    expect(raw, `Tanpa t() (${raw.length}):\n  ${raw.join("\n  ")}`).toEqual([]);
  });

  it("no t() call is handed a template it cannot check", () => {
    // `t(`Hapus ${n} baris`)` builds its key at runtime, so no static scan can
    // look it up and the dictionary can never contain it. Interpolate around
    // t(), not inside it.
    const bad: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const src = readFileSync(file, "utf8");
      if (T_DYNAMIC.test(src)) bad.push(file.slice(SRC.length + 1).replace(/\\/g, "/"));
      T_DYNAMIC.lastIndex = 0;
    }
    expect(bad).toEqual([]);
  });

  it("no dictionary entry is blank", () => {
    // A value IDENTICAL to its key is fine and common - "Kanban", "Deadline",
    // "Qty", "Backup", "Ormawa Visit" are the same word in both languages, and
    // spelling them out beats leaving them to the fallback (an explicit entry is
    // a decision; a missing one is an oversight). A BLANK value is always a bug:
    // it renders as empty text on screen.
    const blank = Object.entries(EN).filter(([, en]) => !en.trim());
    expect(blank.map(([id]) => id)).toEqual([]);
  });
});
