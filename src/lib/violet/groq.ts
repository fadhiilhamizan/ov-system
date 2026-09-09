import "server-only";
import { classifyHttp } from "./errors";
import {
  cleanAnswer, classifyThrow, PROVIDER_TIMEOUT_MS,
  type LlmProvider, type LlmResult, type Turn,
} from "./provider";
import { DEFAULT_MODEL } from "./models";

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
 * Groq retires model ids often, and the symptom is a 404 on every question -
 * which is precisely what happened to the old default, `llama-3.3-70b-versatile`
 * (see ./models.ts). GROQ_MODEL still overrides without a deploy, which is the
 * point of keeping the env var.
 */
const modelFor = (pinned?: string) =>
  pinned || process.env.GROQ_MODEL || DEFAULT_MODEL.groq;

const configured = () => !!process.env.GROQ_API_KEY;

async function generate(
  system: string,
  history: Turn[],
  question: string,
  timeoutMs: number = PROVIDER_TIMEOUT_MS,
  pinned?: string,
): Promise<LlmResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, error: { code: "not_configured" } };
  const model = modelFor(pinned);

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
        // Zero, for the same reason as Gemini: the same factual question must
        // not come back with a different answer on a second asking.
        temperature: 0,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(timeoutMs),
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

  // `cleanAnswer` matters more here than on Gemini: the open-weight models Groq
  // serves are a mixed bag about where reasoning goes. GPT-OSS puts it in a
  // separate `reasoning` field (which we simply never read), but Qwen 3.6 writes
  // it into `content` inside <think> tags.
  const text = cleanAnswer(choice?.message?.content ?? "");
  if (!text) {
    // Same three-way split as Gemini: a length stop with nothing to show is a
    // model that reasoned past its own allowance, not a model with nothing to
    // say, and the two need opposite advice.
    const reason = choice?.finish_reason;
    const code =
      reason === "content_filter" ? "safety" : reason === "length" ? "no_output" : "empty";
    return { ok: false, error: { code, detail: reason } };
  }
  return { ok: true, text };
}

export const groq: LlmProvider = {
  name: "groq",
  label: "Groq",
  configured,
  defaultModel: () => modelFor(),
  generate,
};
