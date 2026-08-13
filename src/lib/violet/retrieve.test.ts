import { describe, it, expect } from "vitest";
import { tokenize, score, retrieve, buildContext, type Passage } from "./retrieve";

const p = (id: string, source: string, text: string): Passage => ({ id, source, text });

const CORPUS: Passage[] = [
  p("guide-rundown", "Panduan: Rundown",
    "Susunan acara hari pelaksanaan. Klik Tambah baris untuk menambah sesi; durasi dihitung otomatis dari waktu mulai dan selesai."),
  p("guide-budget", "Panduan: Anggaran",
    "Menyusun rencana anggaran biaya. Ubah Qty dan Harga satuan langsung di tabel, total dihitung otomatis."),
  p("guide-archive", "Panduan: Ormawa Visit",
    "Arsip mengunci Ormawa Visit yang sudah selesai. Setelah dikunci hanya admin yang bisa mengubah isinya."),
  p("faq-1", "FAQ", "Apa itu Ormawa Visit? Program kunjungan ke himpunan lain."),
  p("live-tasks", "Data: Work Breakdown", "Total 12 tugas, 2 selesai, 1 overtime pada Ormawa Visit Demo."),
];

describe("tokenize", () => {
  it("lower-cases and strips punctuation", () => {
    expect(tokenize("Reach & Offer, PIC!")).toEqual(["reach", "offer", "pic"]);
  });

  it("drops stop words so the real signal survives", () => {
    // "apa itu rundown" must retrieve on "rundown" alone; without this the two
    // filler words match nearly every passage in the corpus.
    expect(tokenize("apa itu rundown")).toEqual(["rundown"]);
    expect(tokenize("bagaimana cara mengubah anggaran")).toEqual(["mengubah", "anggaran"]);
  });

  it("drops single characters and returns nothing for an empty query", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("a b ?")).toEqual([]);
  });
});

describe("retrieve", () => {
  it("puts the passage that actually answers the question first", () => {
    expect(retrieve(CORPUS, "apa itu rundown")[0].id).toBe("guide-rundown");
    expect(retrieve(CORPUS, "cara mengubah harga di anggaran")[0].id).toBe("guide-budget");
    expect(retrieve(CORPUS, "kunci arsip ormawa visit")[0].id).toBe("guide-archive");
  });

  it("returns NOTHING when the question is off-topic", () => {
    // Load-bearing: an empty result is how the caller decides to answer
    // "I do not know" instead of letting the model invent something from its
    // own general knowledge. A system-scoped bot must not free-associate.
    expect(retrieve(CORPUS, "resep rendang padang")).toEqual([]);
    expect(retrieve(CORPUS, "siapa presiden pertama indonesia")).toEqual([]);
  });

  it("returns nothing for an empty or stop-word-only question", () => {
    expect(retrieve(CORPUS, "")).toEqual([]);
    expect(retrieve(CORPUS, "apa itu")).toEqual([]);
  });

  it("respects the limit and orders by score", () => {
    const hits = retrieve(CORPUS, "ormawa visit tugas anggaran rundown", 3);
    expect(hits.length).toBe(3);
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score);
    expect(hits[1].score).toBeGreaterThanOrEqual(hits[2].score);
  });

  it("matches on a word stem, so 'tugas' finds 'tugasnya'", () => {
    const corpus = [p("x", "Panduan", "Setiap tugasnya punya PIC dan deadline.")];
    expect(retrieve(corpus, "tugas")).toHaveLength(1);
  });

  it("prefers a passage matching MORE distinct terms over one repeating a word", () => {
    const corpus = [
      p("repeat", "A", "anggaran anggaran anggaran anggaran anggaran"),
      p("both", "B", "anggaran untuk rundown acara"),
    ];
    expect(retrieve(corpus, "anggaran rundown")[0].id).toBe("both");
  });

  it("does not let a long passage win on bulk alone", () => {
    const corpus = [
      p("short", "A", "Cara mengunci arsip."),
      p("long", "B", `arsip ${"kata ".repeat(300)}`),
    ];
    expect(retrieve(corpus, "arsip")[0].id).toBe("short");
  });
});

describe("score", () => {
  it("is zero when nothing matches", () => {
    expect(score(p("x", "A", "halo dunia"), ["rundown"])).toBe(0);
  });
  it("is zero for an empty query", () => {
    expect(score(p("x", "A", "rundown"), [])).toBe(0);
  });
  it("counts the source line, not just the body", () => {
    expect(score(p("x", "Panduan: Rundown", "isi lain"), ["rundown"])).toBeGreaterThan(0);
  });
});

describe("buildContext", () => {
  it("numbers the passages so the model can cite them", () => {
    const ctx = buildContext(retrieve(CORPUS, "rundown", 2));
    expect(ctx).toContain("[1]");
    expect(ctx).toContain("Panduan: Rundown");
  });
  it("includes the href when a passage has one", () => {
    const ctx = buildContext([{ ...p("x", "Panduan", "isi"), href: "/rundown", score: 1 }]);
    expect(ctx).toContain("/rundown");
  });
  it("is empty for no hits", () => {
    expect(buildContext([])).toBe("");
  });
});
