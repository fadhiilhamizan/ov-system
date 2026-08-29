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
  /** `timeoutMs` is what the CHAIN has left to give, not this provider's own
   *  ceiling - see CHAIN_BUDGET_MS. Defaults to PROVIDER_TIMEOUT_MS. */
  generate(
    system: string,
    history: Turn[],
    question: string,
    timeoutMs?: number,
  ): Promise<LlmResult>;
}

/**
 * How long any one provider gets before we give up on it.
 *
 * Generous, because the first request of a session pays connection setup on
 * top of inference and a tighter 25s limit tripped during testing.
 */
export const PROVIDER_TIMEOUT_MS = 30_000;

/**
 * Wall-clock ceiling for the WHOLE chain, however many providers are in it.
 *
 * This is the budget the comment above used to promise and never had: with two
 * providers each allowed 30s, a question where the first one hung and the
 * second one hung cost the person 60 seconds of a spinner before any message
 * appeared. `generate()` now measures elapsed time and hands each attempt only
 * what is left.
 *
 * 45s rather than 30s so a slow-but-working primary is not cut off just
 * because a fallback exists, while still bounding the worst case well under a
 * minute.
 */
export const CHAIN_BUDGET_MS = 45_000;

/**
 * Below this there is not enough time left to be worth trying.
 *
 * A 2-second attempt at a fallback almost certainly times out too, and it
 * replaces the primary's real error ("quota gone for today", which an admin can
 * act on) with a generic timeout. Better to stop and report the first cause.
 */
export const MIN_ATTEMPT_MS = 5_000;

/** Turn a fetch rejection into a cause. Aborts are timeouts, the rest is network. */
export function classifyThrow(e: unknown): VioletError {
  const name = e instanceof Error ? e.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return { code: "timeout", detail: name };
  }
  return { code: "network", detail: e instanceof Error ? e.message : String(e) };
}
