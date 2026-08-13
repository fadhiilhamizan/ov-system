import "server-only";
import { shouldFailover, type VioletError } from "./errors";
import { gemini } from "./gemini";
import { groq } from "./groq";
import type { LlmProvider, Turn } from "./provider";

// ============================================================
// One question, several providers, first usable answer wins.
//
// Order is deliberate: Gemini first because its grounded answers on this
// corpus are noticeably better, Groq second because it is the one that still
// works when Gemini's daily free quota is gone.
//
// Failover is NOT blanket "any error, try the next one". A safety refusal is
// an answer, and asking a second model the same forbidden question just burns
// its quota to produce the same refusal. `shouldFailover` in ./errors decides.
// ============================================================

const CHAIN: LlmProvider[] = [gemini, groq];

export type GenerateResult =
  | { ok: true; text: string; provider: LlmProvider["name"]; fallback: boolean }
  | { ok: false; error: VioletError };

/** True when at least one provider has a key: the Violet button hangs off this. */
export const violetConfigured = (): boolean => CHAIN.some((p) => p.configured());

/** Which providers are usable right now. Shown to admins in Pengaturan. */
export const configuredProviders = (): string[] =>
  CHAIN.filter((p) => p.configured()).map((p) => p.label);

/**
 * Ask the chain.
 *
 * Returns the FIRST provider's error when every one of them fails, not the
 * last: the primary's reason is the one an admin needs to act on, and "Groq is
 * rate limited" is a confusing thing to read when the real story is that the
 * Gemini key expired.
 */
export async function generate(
  system: string,
  history: Turn[],
  question: string,
): Promise<GenerateResult> {
  const usable = CHAIN.filter((p) => p.configured());
  if (!usable.length) return { ok: false, error: { code: "not_configured" } };

  let first: VioletError | null = null;

  for (const [i, provider] of usable.entries()) {
    const res = await provider.generate(system, history, question);
    if (res.ok) {
      return { ok: true, text: res.text, provider: provider.name, fallback: i > 0 };
    }
    first ??= res.error;
    // Logged, never shown: the provider's own wording routinely contains the
    // model id and the account's quota figures.
    console.warn(`[violet] ${provider.name} failed: ${res.error.code}`, res.error.detail ?? "");
    if (!shouldFailover(res.error.code)) return { ok: false, error: res.error };
  }

  return { ok: false, error: first ?? { code: "unknown" } };
}

export type { Turn } from "./provider";
