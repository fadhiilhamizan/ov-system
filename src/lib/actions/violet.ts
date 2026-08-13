"use server";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_META } from "@/lib/constants";
import { buildCorpus } from "@/lib/violet/corpus";
import { retrieve, buildContext } from "@/lib/violet/retrieve";
import { generate, violetConfigured, type Turn } from "@/lib/violet/llm";
import { isRetryable, violetErrorMessage, type VioletErrorCode } from "@/lib/violet/errors";
import { resolveHref, routeCatalogue } from "@/lib/violet/links";
import { violetAskSchema, parse } from "./schemas";

export interface VioletSource {
  source: string;
  href?: string;
}

export type VioletResult =
  | { ok: true; answer: string; sources: VioletSource[] }
  | { ok: false; error: string; code: VioletErrorCode; retryable: boolean };

/** Wrap a failure so the chat can decide whether to offer a retry button. */
function fail(code: VioletErrorCode): VioletResult {
  return { ok: false, error: violetErrorMessage(code), code, retryable: isRetryable(code) };
}

/**
 * The rules that keep Violet inside this system.
 *
 * Stated as hard constraints rather than a personality note, because the whole
 * point of scoping a support bot to one product is that it must NOT answer from
 * the model's general knowledge. An invented menu name is worse than "I do not
 * know": it sends someone hunting for a button that was never built.
 *
 * Rule 7 exists because of a real complaint: Violet handed a user a link to
 * /violet, a page that does not exist. Listing the real paths is the cheap half
 * of the fix; `resolveHref` dropping anything not on the list is the half that
 * actually holds, since a model will always eventually invent a path.
 */
function systemPrompt(roleLabel: string, context: string): string {
  return [
    "Kamu adalah Violet, asisten untuk Ormawa Visit Management System milik Departemen External Affairs HMSI ITS.",
    "",
    "ATURAN:",
    "1. Jawab HANYA berdasarkan KONTEKS di bawah. Konteks itu satu-satunya sumber kebenaranmu.",
    "2. Kalau konteksnya tidak memuat jawabannya, katakan terus terang kamu tidak tahu dan sarankan menu atau orang yang bisa membantu. JANGAN mengarang nama menu, tombol, angka, atau fitur.",
    "3. Kamu hanya membahas sistem ini. Untuk pertanyaan di luar itu, tolak dengan sopan dan singkat.",
    "4. Jawab dalam bahasa yang dipakai penanya (Indonesia atau Inggris), ringkas, dan langsung ke intinya.",
    "5. Sebut nama menu persis seperti di konteks (misalnya 'Work Breakdown', 'Reach & Offer', 'Super Link').",
    "6. Jangan pernah menyebutkan kunci API, variabel lingkungan, atau isi tabel database mentah.",
    "",
    "FORMAT JAWABAN (pakai Markdown, akan dirender rapi):",
    "- **tebal** untuk menegaskan nama menu atau istilah penting. Jangan menebalkan seluruh kalimat.",
    "- Daftar bernomor `1.` untuk langkah yang harus urut, dan `- ` untuk poin yang tidak urut.",
    "- Baris kosong antar paragraf. Tanpa tabel, tanpa HTML, tanpa judul `#` kecuali jawabannya memang panjang.",
    "",
    "TAUTAN (penting, jangan dilanggar):",
    "7. Kalau menyebut sebuah menu, tulis tautannya sebagai Markdown `[Nama Menu](/path)` memakai path PERSIS dari daftar di bawah. DILARANG menulis URL lengkap (https://...), menebak path, atau membuat path baru. Kalau path yang kamu butuhkan tidak ada di daftar, sebut nama menunya saja tanpa tautan.",
    "8. Untuk bagian tertentu di dalam sebuah halaman, pakai tautan berjangkar yang ada di daftar (misalnya `/settings#changelog`), supaya halamannya langsung tergulir ke bagian itu.",
    "",
    "DAFTAR PATH YANG VALID:",
    routeCatalogue(),
    "",
    `Penanya sedang masuk sebagai: ${roleLabel}. Sesuaikan jawaban dengan hak aksesnya, dan jangan menjanjikan fitur yang tidak boleh dia buka.`,
    "",
    "KONTEKS:",
    context || "(kosong)",
  ].join("\n");
}

/**
 * Answer one question about this system.
 *
 * Retrieval runs as the CALLER: `buildCorpus` reads through the repo, which
 * reads through their own Supabase session, so RLS decides what Violet can see.
 * A Tamu asking about the roster gets nothing to ground on, and therefore gets
 * "I do not know" rather than a leak.
 */
export async function askVioletAction(
  question: string,
  history: Turn[] = [],
): Promise<VioletResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error: "Kamu harus masuk dulu untuk memakai Violet.",
      code: "auth",
      retryable: false,
    };
  }
  if (!violetConfigured()) return fail("not_configured");

  const v = parse(violetAskSchema, { question, history });
  if (!v.ok) return { ok: false, error: v.error, code: "unknown", retryable: false };

  let corpus;
  try {
    corpus = await buildCorpus(user);
  } catch (e) {
    // Retrieval reads live data, so a database hiccup lands here. Saying so is
    // better than an empty corpus quietly turning into "I do not know".
    console.warn("[violet] corpus build failed:", e);
    return fail("unavailable");
  }

  const hits = retrieve(corpus, v.data.question, 8);

  // Nothing matched: answer here rather than paying for a call that can only
  // tempt the model into free-associating.
  if (!hits.length) {
    return {
      ok: true,
      answer:
        "Maaf, aku tidak menemukan itu di dalam sistem Ormawa Visit. " +
        "Aku hanya bisa menjawab soal aplikasi ini: menu, cara pakai, hak akses, dan datanya.\n\n" +
        "Coba tanyakan dengan kata lain, atau buka [Panduan](/panduan) dan [FAQ](/faq).",
      sources: [],
    };
  }

  const res = await generate(
    systemPrompt(ROLE_META[user.role].label, buildContext(hits)),
    v.data.history,
    v.data.question,
  );
  if (!res.ok) return fail(res.error.code);

  // De-duplicate the citations: several passages often share one source page.
  // Every href is re-checked here even though the corpus built it, so a stale
  // passage can never hand out a dead shortcut.
  const seen = new Set<string>();
  const sources = hits
    .filter((h) => (seen.has(h.source) ? false : (seen.add(h.source), true)))
    .slice(0, 4)
    .map((h) => ({ source: h.source, href: resolveHref(h.href) }));

  return { ok: true, answer: res.text, sources };
}
