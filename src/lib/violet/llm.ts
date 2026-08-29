import "server-only";
import { shouldFailover, type VioletError } from "./errors";
import { gemini } from "./gemini";
import { groq } from "./groq";
import {
  CHAIN_BUDGET_MS, MIN_ATTEMPT_MS, PROVIDER_TIMEOUT_MS,
  type LlmProvider, type Turn,
} from "./provider";

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

export interface ProviderStatus {
  name: LlmProvider["name"];
  label: string;
  /** Its key is present in the environment. Never the key itself. */
  configured: boolean;
  /** Position in the chain: the first configured one answers. */
  order: number;
}

/**
 * Which providers are usable right now, for the Pengaturan page.
 *
 * There used to be a `configuredProviders()` here whose docstring said it was
 * "shown to admins in Pengaturan". Nothing rendered it, so when Violet stopped
 * answering an admin had no way to tell whether a key was missing, and the
 * comment quietly lied about it. This one is actually rendered.
 *
 * Names and booleans only. The keys themselves are server-side secrets and
 * this value crosses into a rendered page.
 */
export const providerStatus = (): ProviderStatus[] =>
  CHAIN.map((p, i) => ({
    name: p.name,
    label: p.label,
    configured: p.configured(),
    order: i,
  }));

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
  // The chain's own budget, spent down as attempts are made. Without it two
  // providers at 30s each meant a 60-second spinner in the worst case; the
  // comment in provider.ts promised this and it did not exist.
  const startedAt = Date.now();
  const remaining = () => CHAIN_BUDGET_MS - (Date.now() - startedAt);

  for (const [i, provider] of usable.entries()) {
    const left = remaining();
    if (i > 0 && left < MIN_ATTEMPT_MS) {
      // Not enough time for this attempt to plausibly answer. Report the
      // PRIMARY's cause rather than the timeout this attempt would produce.
      //
      // Unreachable with the CHAIN as it stands: two providers at 30s each
      // against a 45s budget always leave the second one 15s. It is here for
      // the THIRD provider - the chain is documented as extensible, and a third
      // attempt is exactly where the budget would run out. `llm.test.ts` pins
      // the constant relationship that keeps the two-provider case safe.
      console.warn(`[violet] chain budget spent, skipping ${provider.name}`);
      return { ok: false, error: first ?? { code: "timeout" } };
    }
    const budget = Math.min(PROVIDER_TIMEOUT_MS, Math.max(left, MIN_ATTEMPT_MS));

    const res = await provider.generate(system, history, question, budget);
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
