// ============================================================
// The "R" in Violet's RAG: pick the passages worth putting in the prompt.
//
// Lexical, not embeddings, and that is a deliberate choice for this corpus:
//
//   * The knowledge base is small (a few hundred short passages) and almost
//     entirely Indonesian domain vocabulary that the user types back verbatim
//     ("rundown", "Reach & Offer", "arsip", a division name).
//   * Embeddings would mean a second network call per question, an API bill
//     per turn, and somewhere to store vectors that has to be re-indexed every
//     time a task changes. The live data here changes constantly.
//   * This runs offline and is fully unit-testable, so retrieval quality is
//     something we can assert rather than hope for.
//
// If the corpus ever grows past a few thousand passages, swap the scorer for
// embeddings; `retrieve()` is the only seam that would change.
// ============================================================

/** One retrievable passage. */
export interface Passage {
  /** Stable id, used to cite sources back to the user. */
  id: string;
  /** Human-facing origin, e.g. "Panduan: Rundown". */
  source: string;
  /** Where in the app to look, when there is a page for it. */
  href?: string;
  text: string;
}

export interface Scored extends Passage {
  score: number;
}

/**
 * Indonesian + English stop words.
 *
 * Without this, "apa itu rundown" scores every passage containing "apa" and
 * "itu", which is nearly all of them, and the real signal ("rundown") is
 * drowned out.
 */
const STOP = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "pada", "dengan", "itu", "ini",
  "apa", "apakah", "bagaimana", "gimana", "cara", "adalah", "atau", "saya",
  "aku", "kamu", "kita", "bisa", "dapat", "ada", "tidak", "nggak", "sudah",
  "akan", "juga", "saja", "kalau", "jika", "agar", "supaya", "dalam", "oleh",
  "the", "a", "an", "is", "are", "of", "to", "in", "for", "on", "and", "or",
  "how", "what", "do", "i", "you", "can", "it", "this", "that",
]);

/** Split text into comparable tokens: lower-cased, punctuation stripped. */
export function tokenize(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Score one passage against the query terms.
 *
 * Term frequency, damped by a square root so a passage that repeats a word ten
 * times does not bury a passage that answers the question once. Matching more
 * DISTINCT query terms is worth more than repeating one, which is what keeps
 * "deadline rundown" from returning every rundown passage ever written.
 */
export function score(passage: Passage, queryTerms: string[]): number {
  if (!queryTerms.length) return 0;
  const haystack = tokenize(`${passage.source} ${passage.text}`);
  if (!haystack.length) return 0;

  const counts = new Map<string, number>();
  for (const w of haystack) counts.set(w, (counts.get(w) ?? 0) + 1);

  let total = 0;
  let distinct = 0;
  for (const term of new Set(queryTerms)) {
    let hits = counts.get(term) ?? 0;
    // Prefix match so "tugas" finds "tugasnya" and "rundown" finds "rundownnya".
    if (!hits) {
      for (const [w, c] of counts) if (w.startsWith(term) || term.startsWith(w)) hits += c * 0.5;
    }
    if (hits > 0) {
      distinct++;
      total += Math.sqrt(hits);
    }
  }
  if (!distinct) return 0;
  // Normalise by passage length so a long passage does not win on bulk alone.
  const lengthPenalty = 1 + Math.log10(1 + haystack.length / 40);
  return (total * (1 + distinct)) / lengthPenalty;
}

/**
 * The top `limit` passages for a question, best first.
 *
 * Returns an empty array when nothing scores at all. That is load-bearing: the
 * caller uses it to make Violet say "I do not know" rather than let the model
 * answer from its own general knowledge, which is exactly the thing a
 * system-scoped assistant must not do.
 */
export function retrieve(corpus: Passage[], query: string, limit = 8): Scored[] {
  const terms = tokenize(query);
  if (!terms.length) return [];
  return corpus
    .map((p) => ({ ...p, score: score(p, terms) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Render the retrieved passages as the context block sent to the model. */
export function buildContext(hits: Scored[]): string {
  return hits
    .map((h, i) => `[${i + 1}] ${h.source}${h.href ? ` (${h.href})` : ""}\n${h.text}`)
    .join("\n\n");
}
