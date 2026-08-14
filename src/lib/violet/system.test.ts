import { describe, it, expect } from "vitest";
import { systemPassages } from "./system";
import { resolveHref } from "./links";
import { retrieve } from "./retrieve";

// The point of these passages is that a question about how the system BEHAVES
// finds them. A passage nobody can retrieve is the same as a missing one, and
// "Violet only knows about Work Breakdown" is exactly what that feels like.

const corpus = systemPassages();

describe("systemPassages", () => {
  it("has unique ids", () => {
    const ids = corpus.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hangs every detail passage off the overview", () => {
    // Retrieval pulls a matched row's parent in with it, so a question that
    // hits one field also gets the shape of the whole system beside it.
    const overview = corpus.find((p) => p.id === "system-overview");
    expect(overview).toBeDefined();
    for (const p of corpus) {
      if (p.id === "system-overview") continue;
      expect(p.parent, `${p.id} has no parent`).toBe("system-overview");
    }
  });

  it("never points at a page that does not exist", () => {
    // The /violet incident: a dead shortcut reads as an authoritative answer
    // and ends in a 404.
    for (const p of corpus) {
      if (!p.href) continue;
      expect(resolveHref(p.href), `${p.id} -> ${p.href}`).toBe(p.href);
    }
  });

  it("gives every passage real content", () => {
    for (const p of corpus) expect(p.text.length, p.id).toBeGreaterThan(120);
  });
});

describe("retrieval of system knowledge", () => {
  /** The best-scoring passage id for a question, ignoring the pulled-in parent. */
  const best = (q: string) =>
    retrieve(corpus, q).filter((h) => h.id !== "system-overview")[0]?.id;

  it.each([
    ["kenapa tugas jadi overtime sendiri", "system-overtime"],
    ["apa bedanya tautan hasil dan referensi tugas", "system-task-links"],
    ["bisa tidak satu prospek punya beberapa tautan", "system-prospect-links"],
    ["apa itu data utama Ormawa Visit", "system-prospect-primary"],
    ["kolom apa saja yang ada di rundown", "system-rundown"],
    ["bagaimana angkatan anggota dihitung dari NRP", "system-member"],
    ["kenapa tombol simpan hilang setelah diarsipkan", "system-archive"],
    ["bagaimana cara filter dua status sekaligus", "system-filters"],
    ["catatan di tabel terpotong, bagaimana melihat semuanya", "system-notes"],
    ["warna kategori anggaran berlaku untuk apa", "system-budget"],
    ["apa itu LPJ", "system-glossary"],
  ])("%s -> %s", (question, expected) => {
    expect(best(question)).toBe(expected);
  });

  it("says which editions Violet can describe in detail", () => {
    // The honest half of the cross-edition answer: rows for the active edition,
    // a summary for the rest.
    const hit = retrieve(corpus, "apakah Violet tahu data Ormawa Visit yang lain");
    expect(hit.some((h) => h.id === "system-violet-limits")).toBe(true);
  });
});
