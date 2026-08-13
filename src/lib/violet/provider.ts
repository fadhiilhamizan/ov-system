import type { VioletError } from "./errors";

// ============================================================
// The shape every Violet backend speaks.
//
// Its own module so `gemini.ts` and `groq.ts` can both depend on it without
// depending on `llm.ts`, which depends on them.
// ============================================================

export interface Turn {
  role: "user" | "model";
  text: string;
}

export type LlmResult =
  | { ok: true; text: string }
  | { ok: false; error: VioletError };

export interface LlmProvider {
  /** Short id used in logs and in the "answered by" note. */
  name: "gemini" | "groq";
  /** Human name for the UI. */
  label: string;
  /** False when its key is missing: the chain skips it silently. */
  configured(): boolean;
  generate(system: string, history: Turn[], question: string): Promise<LlmResult>;
}

/**
 * How long any one provider gets before we give up on it.
 *
 * Generous, because the first request of a session pays connection setup on
 * top of inference and a tighter 25s limit tripped during testing. With a
 * fallback provider behind it, though, the ceiling now costs twice as much in
 * the worst case, so the failover chain uses its own shorter budget below.
 */
export const PROVIDER_TIMEOUT_MS = 30_000;

/** Turn a fetch rejection into a cause. Aborts are timeouts, the rest is network. */
export function classifyThrow(e: unknown): VioletError {
  const name = e instanceof Error ? e.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return { code: "timeout", detail: name };
  }
  return { code: "network", detail: e instanceof Error ? e.message : String(e) };
}
