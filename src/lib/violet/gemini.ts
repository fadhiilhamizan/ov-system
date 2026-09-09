import "server-only";
import { classifyHttp } from "./errors";
import {
  cleanAnswer, classifyThrow, PROVIDER_TIMEOUT_MS,
  type LlmProvider, type LlmResult, type Turn,
} from "./provider";
import { DEFAULT_MODEL } from "./models";

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
 * A rolling ALIAS, not a pinned version, and deliberately so - but an alias is
 * not a free lunch, and which one you point at matters. See DEFAULT_MODEL in
 * ./models.ts for what `gemini-flash-latest` did to this app.
 *
 * Order of precedence: the id the caller pinned (validated against the picker's
 * whitelist by the action), then GEMINI_MODEL from the environment, then the
 * default. The env var is last-resort admin control, not a user preference.
 */
const modelFor = (pinned?: string) =>
  pinned || process.env.GEMINI_MODEL || DEFAULT_MODEL.gemini;

const configured = () => !!process.env.GEMINI_API_KEY;

async function generate(
  system: string,
  history: Turn[],
  question: string,
  timeoutMs: number = PROVIDER_TIMEOUT_MS,
  pinned?: string,
): Promise<LlmResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: { code: "not_configured" } };
  const model = modelFor(pinned);

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
          // ZERO on purpose. A support bot answering a factual question about a
          // deadline should give the same answer every time it is asked; at 0.2
          // the same question could come back phrased as "I could not find it"
          // once and with the date the next time, which is what made Violet
          // look unreliable. Nothing here benefits from sampling variety.
          temperature: 0,
          maxOutputTokens: 900,
        },
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

  const candidate = (body as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  } | null)?.candidates?.[0];

  const text = cleanAnswer((candidate?.content?.parts ?? []).map((p) => p.text ?? "").join(""));
  if (!text) {
    // Three different silences, and they must not be reported as one.
    //
    // MAX_TOKENS with nothing to show is the THINKING-MODEL failure: the model
    // spent all 900 tokens reasoning and never started the answer. Measured on
    // the real API - `gemini-flash-latest` now resolves to a thinking model,
    // and a two-word question came back finishReason MAX_TOKENS, empty content,
    // thoughtsTokenCount 32. It used to be reported as "empty", whose advice is
    // to rephrase the question, which cannot possibly help.
    //
    // A blocked candidate is not an outage either, and must not fail over: the
    // next provider would refuse the same question, just more slowly.
    const reason = candidate?.finishReason;
    const code =
      reason === "SAFETY" ? "safety" : reason === "MAX_TOKENS" ? "no_output" : "empty";
    return { ok: false, error: { code, detail: reason } };
  }
  return { ok: true, text };
}

export const gemini: LlmProvider = {
  name: "gemini",
  label: "Google Gemini",
  configured,
  defaultModel: () => modelFor(),
  generate,
};
