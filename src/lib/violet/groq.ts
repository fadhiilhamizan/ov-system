import "server-only";
import { classifyHttp } from "./errors";
import { classifyThrow, PROVIDER_TIMEOUT_MS, type LlmProvider, type LlmResult, type Turn } from "./provider";

// ============================================================
// Groq. Violet's BACKUP provider.
//
// Why a second one at all: Gemini's free tier is generous per minute but small
// per day, and Violet is used in bursts (a meeting, a deadline week). Once the
// daily allowance is gone every question fails for the rest of the day, which
// is the failure mode users actually reported. Groq has a separate free tier
// with its own counter, so an exhausted Gemini quota stops being an outage.
//
// Same rules as Gemini: `GROQ_API_KEY` has NO NEXT_PUBLIC_ prefix and this
// module is "server-only", so the key cannot reach the browser bundle.
//
// The API is OpenAI-compatible, which is why the message shape differs from
// Gemini's: roles are system/user/assistant, and the system prompt is just the
// first message rather than a separate field.
// ============================================================

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Groq retires model ids fairly often and the symptom is a 404 on every
 * question, so this is overridable via GROQ_MODEL without a deploy. The
 * default is their general-purpose instruct model, which is more than enough
 * for grounded question answering over a small context.
 */
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const configured = () => !!process.env.GROQ_API_KEY;

async function generate(system: string, history: Turn[], question: string): Promise<LlmResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, error: { code: "not_configured" } };
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          ...history.map((t) => ({
            // Gemini calls it "model", OpenAI-compatible APIs call it
            // "assistant". The app speaks Gemini's dialect internally.
            role: t.role === "model" ? "assistant" : "user",
            content: t.text,
          })),
          { role: "user", content: question },
        ],
        temperature: 0.2,
        max_tokens: 1200,
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

  const choice = (body as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  } | null)?.choices?.[0];

  const text = (choice?.message?.content ?? "").trim();
  if (!text) {
    return {
      ok: false,
      error: {
        code: choice?.finish_reason === "content_filter" ? "safety" : "empty",
        detail: choice?.finish_reason,
      },
    };
  }
  return { ok: true, text };
}

export const groq: LlmProvider = {
  name: "groq",
  label: "Groq",
  configured,
  generate,
};
