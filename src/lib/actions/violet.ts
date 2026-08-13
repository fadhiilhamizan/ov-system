"use server";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_META } from "@/lib/constants";
import { buildCorpus } from "@/lib/violet/corpus";
import { retrieve, buildContext } from "@/lib/violet/retrieve";
import { generate, violetConfigured, type Turn } from "@/lib/violet/gemini";
import { violetAskSchema, parse } from "./schemas";

export interface VioletSource {
  source: string;
  href?: string;
}

export type VioletResult =
  | { ok: true; answer: string; sources: VioletSource[] }
  | { ok: false; error: string };

/**
 * The rules that keep Violet inside this system.
 *
 * Stated as hard constraints rather than a personality note, because the whole
 * point of scoping a support bot to one product is that it must NOT answer from
 * the model's general knowledge. An invented menu name is worse than "I do not
 * know": it sends someone hunting for a button that was never built.
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
  if (!user) return { ok: false, error: "Kamu harus masuk dulu untuk memakai Violet." };
  if (!violetConfigured()) {
    return { ok: false, error: "Violet belum dikonfigurasi. Admin perlu mengisi GEMINI_API_KEY." };
  }

  const v = parse(violetAskSchema, { question, history });
  if (!v.ok) return v;

  const corpus = await buildCorpus(user);
  const hits = retrieve(corpus, v.data.question, 8);

  // Nothing matched: answer here rather than paying for a call that can only
  // tempt the model into free-associating.
  if (!hits.length) {
    return {
      ok: true,
      answer:
        "Maaf, aku tidak menemukan itu di dalam sistem Ormawa Visit. " +
        "Aku hanya bisa menjawab soal aplikasi ini: menu, cara pakai, hak akses, dan datanya. " +
        "Coba tanyakan dengan kata lain, atau buka menu Panduan.",
      sources: [],
    };
  }

  const res = await generate(
    systemPrompt(ROLE_META[user.role].label, buildContext(hits)),
    v.data.history,
    v.data.question,
  );
  if (!res.ok) return res;

  // De-duplicate the citations: several passages often share one source page.
  const seen = new Set<string>();
  const sources = hits
    .filter((h) => (seen.has(h.source) ? false : (seen.add(h.source), true)))
    .slice(0, 4)
    .map((h) => ({ source: h.source, href: h.href }));

  return { ok: true, answer: res.text, sources };
}
