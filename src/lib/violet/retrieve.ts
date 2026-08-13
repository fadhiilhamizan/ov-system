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
  /**
   * The id of the summary passage this one is a row of, e.g. every
   * `division-*` points at `live-divisions`.
   *
   * Retrieval pulls a matched row's summary in with it. Without that, "divisi
   * apa saja yang ada" retrieved the three division rows whose wording happened
   * to score, and Violet answered with three divisions out of seven, sounding
   * completely certain. A partial list presented as a whole one is worse than
   * no answer, and the summary is the passage that knows the whole set.
   */
  parent?: string;
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

/** Strip everything but letters, digits and single spaces, for phrase matching. */
const normalise = (s: string) =>
  (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Score one passage against the query terms.
 *
 * Term frequency, damped by a square root so a passage that repeats a word ten
 * times does not bury a passage that answers the question once. Matching more
 * DISTINCT query terms is worth more than repeating one, which is what keeps
 * "deadline rundown" from returning every rundown passage ever written.
 *
 * `raw` is the untokenised question, used only for the phrase bonus below. It
 * is optional so the scorer stays callable with terms alone.
 */
export function score(passage: Passage, queryTerms: string[], raw = ""): number {
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
  let s = (total * (1 + distinct)) / lengthPenalty;

  // Naming a thing outright should beat merely sharing words with it.
  //
  // Rows are indexed one per passage now, and several tasks legitimately share
  // most of their vocabulary ("Buat rundown acara" vs "Susun konsep acara").
  // Without this, asking about one of them by name returned a near-tie and the
  // model answered about whichever passage happened to sort first. The bonus is
  // multiplicative so it re-ranks rather than swamping the term scores.
  if (raw) {
    const phrase = normalise(raw);
    const source = normalise(passage.source);
    if (phrase.length > 3) {
      // The question quotes the row's own name, e.g. "kapan deadline Buat
      // rundown acara" against the passage "Tugas: Buat rundown acara".
      const label = source.replace(/^[a-z& ]+ /, ""); // drop the "tugas: " prefix
      if (label.length > 3 && phrase.includes(label)) s *= 2.5;
      else if (normalise(passage.text).includes(phrase)) s *= 1.6;
    }
  }
  return s;
}

/**
 * How many passages go into the prompt.
 *
 * Raised from 8 when the corpus moved from one passage per MODULE to one per
 * ROW: eight was a generous slice of ~40 paragraphs and a thin one of several
 * hundred short records. A question like "tugas apa saja yang overtime"
 * legitimately needs a dozen rows to answer completely.
 */
const DEFAULT_LIMIT = 14;

/**
 * Ceiling on the context, in characters. Roughly 1,600 tokens.
 *
 * This number is set by the FREE TIER, not by what the model could hold.
 * Measured against the real thing: at a 14,000 character budget one question
 * cost ~6,200 tokens, and Groq's free tier allows 12,000 tokens per MINUTE, so
 * the backup provider ran dry after two questions and the whole point of having
 * a backup was lost. Halving the context roughly doubles how many questions a
 * user gets before either provider starts refusing.
 *
 * Row passages run ~300 characters, so this is still around twenty of them:
 * more than enough to list every overdue task, which is the longest answer
 * anybody actually asks for.
 */
const CONTEXT_BUDGET = 6_500;

/**
 * The top `limit` passages for a question, best first.
 *
 * Returns an empty array when nothing scores at all. That is load-bearing: the
 * caller uses it to make Violet say "I do not know" rather than let the model
 * answer from its own general knowledge, which is exactly the thing a
 * system-scoped assistant must not do.
 */
export function retrieve(corpus: Passage[], query: string, limit = DEFAULT_LIMIT): Scored[] {
  const terms = tokenize(query);
  if (!terms.length) return [];

  const byScore = (a: Scored, b: Scored) =>
    // Ties break on `id`, never on array position. Array.sort is stable, so
    // without this the winner depended on the order the database happened to
    // return rows in, and the same question could be answered from a different
    // passage on a second asking.
    b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const hits = corpus
    .map((p) => ({ ...p, score: score(p, terms, query) }))
    .filter((p) => p.score > 0)
    .sort(byScore)
    .slice(0, limit);

  // Pull in the summary behind any row that matched, so a question about a set
  // is answered from the passage that holds the whole set.
  const have = new Set(hits.map((h) => h.id));
  const wanted = new Map<string, number>();
  for (const h of hits) {
    if (!h.parent || have.has(h.parent)) continue;
    // Scored just under its best child, so it lands beside the rows it
    // summarises rather than at the bottom where the budget might cut it.
    wanted.set(h.parent, Math.max(wanted.get(h.parent) ?? 0, h.score * 0.99));
  }
  if (!wanted.size) return hits;

  const parents = corpus
    .filter((p) => wanted.has(p.id))
    .map((p) => ({ ...p, score: wanted.get(p.id)! }));

  return [...hits, ...parents].sort(byScore);
}

/** Render the retrieved passages as the context block sent to the model. */
export function buildContext(hits: Scored[], budget = CONTEXT_BUDGET): string {
  const parts: string[] = [];
  let used = 0;
  for (const h of hits) {
    const block = `[${parts.length + 1}] ${h.source}${h.href ? ` (${h.href})` : ""}\n${h.text}`;
    // Always take the best-scoring passage, even if it alone exceeds the
    // budget: an empty context makes Violet say "I do not know" about something
    // it was holding in its hand.
    if (parts.length && used + block.length > budget) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n\n");
}
