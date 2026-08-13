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

// ============================================================
// Row-level retrieval.
//
// These pin the fix for "Violet sometimes knows a fact and sometimes does
// not". Two causes, both reproduced here: a specific question had to win
// against near-identical neighbours, and equal scores were broken by whatever
// order the database returned rows in.
// ============================================================

const ROWS: Passage[] = [
  p("task-a", "Tugas: Susun konsep acara",
    'Tugas "Susun konsep acara" di divisi Event. Status tugas: Overtime. PIC atau penanggung jawab tugas ini: Dewi. Deadline, tenggat, batas waktu, atau tanggal selesai: 10 Agustus 2026.'),
  p("task-b", "Tugas: Buat rundown acara",
    'Tugas "Buat rundown acara" di divisi Event. Status tugas: To Do. PIC atau penanggung jawab tugas ini: Rian. Deadline, tenggat, batas waktu, atau tanggal selesai: 20 Agustus 2026.'),
  p("task-c", "Tugas: Pesan konsumsi peserta",
    'Tugas "Pesan konsumsi peserta" di divisi Consumption. Status tugas: To Do. PIC atau penanggung jawab tugas ini: Sari. Deadline: 19 September 2026.'),
];

describe("retrieving one row out of many", () => {
  it("puts the named task first, not a near-identical sibling", () => {
    // "acara" and "divisi Event" are shared, so term overlap alone leaves
    // these two nearly tied and the answer came down to array order.
    expect(retrieve(ROWS, "kapan deadline Buat rundown acara")[0].id).toBe("task-b");
    expect(retrieve(ROWS, "siapa PIC Susun konsep acara")[0].id).toBe("task-a");
  });

  it("finds a row through any of the words for the same thing", () => {
    // The passage carries the synonyms deliberately: lexical retrieval can
    // only match words that are literally present.
    for (const q of [
      "deadline Pesan konsumsi peserta",
      "tenggat Pesan konsumsi peserta",
      "batas waktu Pesan konsumsi peserta",
      "kapan Pesan konsumsi peserta selesai",
    ]) {
      expect(retrieve(ROWS, q)[0].id, q).toBe("task-c");
    }
  });

  it("gives the same answer to the same question every time", () => {
    const once = retrieve(ROWS, "siapa PIC Buat rundown acara").map((h) => h.id);
    for (let i = 0; i < 5; i++) {
      expect(retrieve(ROWS, "siapa PIC Buat rundown acara").map((h) => h.id)).toEqual(once);
    }
  });

  it("does not depend on the order the rows arrived in", () => {
    // Several getters have no ORDER BY, so this really does vary in production.
    const forwards = retrieve(ROWS, "PIC tugas divisi Event").map((h) => h.id);
    const backwards = retrieve([...ROWS].reverse(), "PIC tugas divisi Event").map((h) => h.id);
    expect(backwards).toEqual(forwards);
  });

  it("still returns nothing for something that is not there", () => {
    // Load-bearing: this is how the action answers "I do not know".
    expect(retrieve(ROWS, "harga saham nvidia")).toEqual([]);
  });
});

describe("buildContext budget", () => {
  it("stops before blowing the character budget", () => {
    const big = Array.from({ length: 40 }, (_, i) =>
      ({ ...p(`x-${i}`, `Sumber ${i}`, "kata ".repeat(200)), score: 40 - i }));
    const ctx = buildContext(big, 2000);
    expect(ctx.length).toBeLessThanOrEqual(2200);
    expect(ctx).toContain("Sumber 0");
  });

  it("always keeps the best passage, even when it alone exceeds the budget", () => {
    // An empty context makes Violet say "I do not know" about something it was
    // holding in its hand.
    const huge = [{ ...p("x", "Sumber besar", "kata ".repeat(5000)), score: 9 }];
    expect(buildContext(huge, 100)).toContain("Sumber besar");
  });
});

describe("pulling in the summary behind a matched row", () => {
  const WITH_PARENT: Passage[] = [
    p("live-divisions", "Data: Divisi",
      "Divisi pada Ormawa Visit Demo: Secretary (SEC), Liaison Officer (LO), Event (EVE), Consumption (CON), Operational (OPR), Creative (CRE), Marketing (MRT)."),
    { ...p("division-CON", "Divisi: Consumption", "Divisi Consumption, disingkat CON. Divisi Consumption belum punya koordinator."), parent: "live-divisions" },
    { ...p("division-OPR", "Divisi: Operational", "Divisi Operational, disingkat OPR. Divisi Operational belum punya koordinator."), parent: "live-divisions" },
    { ...p("division-MRT", "Divisi: Marketing", "Divisi Marketing, disingkat MRT. Koordinator divisi Marketing: Rizky."), parent: "live-divisions" },
  ];

  it("includes the summary when only some rows scored", () => {
    // The bug this pins: three division rows matched, so Violet listed three
    // divisions out of seven and sounded completely sure about it.
    const ids = retrieve(WITH_PARENT, "divisi apa saja yang ada dan siapa koordinatornya").map((h) => h.id);
    expect(ids).toContain("live-divisions");
  });

  it("does not duplicate a summary that already matched on its own", () => {
    const ids = retrieve(WITH_PARENT, "divisi Consumption koordinator").map((h) => h.id);
    expect(ids.filter((id) => id === "live-divisions")).toHaveLength(1);
  });

  it("keeps the summary next to its rows, not at the bottom", () => {
    // It has to survive the context budget, which cuts from the end.
    const hits = retrieve(WITH_PARENT, "divisi apa saja yang ada");
    const summary = hits.findIndex((h) => h.id === "live-divisions");
    expect(summary).toBeGreaterThanOrEqual(0);
    expect(summary).toBeLessThanOrEqual(1);
  });

  it("adds nothing when no row matched", () => {
    expect(retrieve(WITH_PARENT, "harga saham nvidia")).toEqual([]);
  });
});
