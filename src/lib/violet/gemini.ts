import "server-only";
import { classifyHttp } from "./errors";
import { classifyThrow, PROVIDER_TIMEOUT_MS, type LlmProvider, type LlmResult, type Turn } from "./provider";

// ============================================================
// Minimal Google Gemini client. Violet's primary provider.
//
// Hand-rolled rather than pulling in @google/generative-ai: this app makes ONE
// kind of call, and a fetch is smaller than the dependency and its transitive
// tree.
//
// THE KEY NEVER LEAVES THE SERVER. `GEMINI_API_KEY` has no NEXT_PUBLIC_ prefix,
// so Next will not inline it into the browser bundle, and this module is
// "server-only" so importing it from a client component is a build error rather
// than a silent leak. That matters especially here: the repository is public.
//
// Failures are returned as a CODE, not as Google's English prose. ./errors owns
// the wording the user sees, and ./llm decides whether to fall back to Groq.
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

const configured = () => !!process.env.GEMINI_API_KEY;

async function generate(system: string, history: Turn[], question: string): Promise<LlmResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: { code: "not_configured" } };
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
          maxOutputTokens: 1200,
        },
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (e) {
    return { ok: false, error: classifyThrow(e) };
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const detail =
      (body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, error: { code: classifyHttp(res.status, detail), detail } };
  }

  const candidate = (body as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  } | null)?.candidates?.[0];

  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) {
    // A blocked candidate is not an outage, and must not fail over: the next
    // provider would refuse the same question, just more slowly.
    return {
      ok: false,
      error: {
        code: candidate?.finishReason === "SAFETY" ? "safety" : "empty",
        detail: candidate?.finishReason,
      },
    };
  }
  return { ok: true, text };
}

export const gemini: LlmProvider = {
  name: "gemini",
  label: "Google Gemini",
  configured,
  generate,
};
