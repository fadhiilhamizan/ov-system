import "server-only";

// ============================================================
// Minimal Google Gemini client.
//
// Hand-rolled rather than pulling in @google/generative-ai: this app makes ONE
// kind of call, and a fetch is smaller than the dependency and its transitive
// tree.
//
// THE KEY NEVER LEAVES THE SERVER. `GEMINI_API_KEY` has no NEXT_PUBLIC_ prefix,
// so Next will not inline it into the browser bundle, and this module is
// "server-only" so importing it from a client component is a build error rather
// than a silent leak. That matters especially here: the repository is public.
// ============================================================

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
/**
 * A rolling ALIAS, not a pinned version, and deliberately so.
 *
 * Pinning bit us immediately: `gemini-2.0-flash` was already retired, and the
 * only symptom was every question failing with "this model is no longer
 * available". The alias tracks whatever the current flash model is, which is
 * the right trade for a support chatbot. Pin it via GEMINI_MODEL if a specific
 * version is ever needed.
 */
const DEFAULT_MODEL = "gemini-flash-latest";

export const violetConfigured = () => !!process.env.GEMINI_API_KEY;

export interface Turn {
  role: "user" | "model";
  text: string;
}

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/**
 * One completion. `history` is the prior conversation so follow-up questions
 * ("and the deadline?") make sense; `system` carries the grounding rules.
 */
export async function generate(
  system: string,
  history: Turn[],
  question: string,
): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "Violet belum dikonfigurasi (GEMINI_API_KEY kosong)." };
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          ...history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
          { role: "user", parts: [{ text: question }] },
        ],
        generationConfig: {
          // Low but not zero: answers should stick to the context, while still
          // reading like a sentence rather than a copy-paste of the passage.
          temperature: 0.2,
          maxOutputTokens: 800,
        },
      }),
      // Never leave the user staring at a spinner because Google is slow.
      // A warm call is ~5s; the ceiling is generous because the very first
      // request of a session pays connection setup on top and tripped a
      // tighter 25s limit during testing.
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      error: aborted
        ? "Violet tidak menjawab tepat waktu. Coba lagi sebentar lagi."
        : "Tidak bisa menghubungi layanan Violet. Periksa koneksi internet.",
    };
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    // Surface Google's own wording: "API key not valid" is far more actionable
    // than a generic failure, and this key format is easy to get wrong.
    const detail =
      (body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, error: `Layanan Violet menolak permintaan: ${detail}` };
  }

  const candidate = (body as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  } | null)?.candidates?.[0];

  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) {
    // A blocked or empty candidate is not an outage; say so plainly.
    return {
      ok: false,
      error: candidate?.finishReason === "SAFETY"
        ? "Violet tidak bisa menjawab pertanyaan itu."
        : "Violet tidak mengembalikan jawaban. Coba ulangi pertanyaannya.",
    };
  }
  return { ok: true, text };
}
