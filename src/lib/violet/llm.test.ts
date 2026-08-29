import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LlmResult } from "./provider";

// ------------------------------------------------------------------
// The failover chain's WALL-CLOCK budget.
//
// provider.ts documented one ("the failover chain uses its own shorter budget
// below") that did not exist, so two providers at 30s each meant a question
// could sit for a full minute before showing anything. These pin the budget
// that now backs that sentence.
//
// Time is faked: a test that really waited 45 seconds would never be run.
// ------------------------------------------------------------------
// `llm.ts` freezes its CHAIN at module load, so the provider OBJECTS have to
// exist before the mock factory runs. Hoisted, with swappable behaviour inside.
const H = vi.hoisted(() => {
  const calls: { name: string; timeoutMs: number | undefined }[] = [];
  const behaviour: Record<string, { takesMs: number; result: unknown }> = {
    gemini: { takesMs: 0, result: { ok: true, text: "" } },
    groq: { takesMs: 0, result: { ok: true, text: "" } },
  };
  let advance: (ms: number) => void = () => {};
  const make = (name: "gemini" | "groq") => ({
    name,
    label: name,
    configured: () => true,
    async generate(_s: string, _h: unknown[], _q: string, timeoutMs?: number) {
      calls.push({ name, timeoutMs });
      // A real provider aborts at its signal, so it can never burn more wall
      // clock than the budget it was handed. Modelling that is the point: a
      // stub that ignores `timeoutMs` would measure the stub, not the chain.
      advance(Math.min(behaviour[name].takesMs, timeoutMs ?? Infinity));
      return behaviour[name].result;
    },
  });
  return {
    calls,
    behaviour,
    setAdvance: (fn: (ms: number) => void) => { advance = fn; },
    gemini: make("gemini"),
    groq: make("groq"),
  };
});

vi.mock("./gemini", () => ({ gemini: H.gemini }));
vi.mock("./groq", () => ({ groq: H.groq }));

const calls = H.calls;

/** Point one provider at a behaviour for the current test. */
function stub(name: "gemini" | "groq", b: { takesMs: number; result: LlmResult }) {
  H.behaviour[name] = b;
  return name;
}

const QUOTA: LlmResult = { ok: false, error: { code: "quota", detail: "habis" } };
const TIMEOUT: LlmResult = { ok: false, error: { code: "timeout" } };
const FINE: LlmResult = { ok: true, text: "jawaban" };

const { generate } = await import("./llm");
const { CHAIN_BUDGET_MS, PROVIDER_TIMEOUT_MS, MIN_ATTEMPT_MS } = await import("./provider");

beforeEach(() => {
  calls.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  H.setAdvance((ms) => vi.advanceTimersByTime(ms));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("generate - chain budget", () => {
  it("gives the first provider its full per-provider ceiling", async () => {
    stub("gemini", { takesMs: 100, result: FINE });
    stub("groq", { takesMs: 0, result: FINE });
    const res = await generate("s", [], "q");
    expect(res.ok).toBe(true);
    expect(calls[0].timeoutMs).toBe(PROVIDER_TIMEOUT_MS);
  });

  it("gives the fallback only what the chain has LEFT", async () => {
    // Primary burns 30s and fails with a failover-worthy cause.
    stub("gemini", { takesMs: PROVIDER_TIMEOUT_MS, result: QUOTA });
    stub("groq", { takesMs: 0, result: FINE });
    await generate("s", [], "q");
    expect(calls).toHaveLength(2);
    // 45s budget minus the 30s already spent.
    expect(calls[1].timeoutMs).toBe(CHAIN_BUDGET_MS - PROVIDER_TIMEOUT_MS);
    expect(calls[1].timeoutMs).toBeLessThan(PROVIDER_TIMEOUT_MS);
  });

  it("still gives the fallback a real chance when the primary maxes out", async () => {
    // Worth being precise about, because it constrains the constants: a single
    // provider can never burn more than PROVIDER_TIMEOUT_MS, so with two of
    // them the fallback is guaranteed CHAIN_BUDGET_MS - PROVIDER_TIMEOUT_MS.
    // Keep that difference above MIN_ATTEMPT_MS or the fallback stops being a
    // fallback - this assertion is what fails if someone tightens the budget.
    expect(CHAIN_BUDGET_MS - PROVIDER_TIMEOUT_MS).toBeGreaterThanOrEqual(MIN_ATTEMPT_MS);

    stub("gemini", { takesMs: PROVIDER_TIMEOUT_MS, result: QUOTA });
    stub("groq", { takesMs: 0, result: FINE });
    const res = await generate("s", [], "q");
    expect(calls.map((c) => c.name)).toEqual(["gemini", "groq"]);
    expect(res.ok).toBe(true);
  });

  it("reports the PRIMARY's cause when the whole chain fails", async () => {
    // "Groq is rate limited" is the wrong thing to show when the real story is
    // that the Gemini key ran out of quota.
    stub("gemini", { takesMs: 10, result: QUOTA });
    stub("groq", { takesMs: 10, result: TIMEOUT });
    const res = await generate("s", [], "q");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("quota");
  });

  it("never hands a provider less than the minimum useful slice", async () => {
    stub("gemini", { takesMs: CHAIN_BUDGET_MS - MIN_ATTEMPT_MS - 1, result: QUOTA });
    stub("groq", { takesMs: 0, result: FINE });
    await generate("s", [], "q");
    expect(calls).toHaveLength(2);
    expect(calls[1].timeoutMs).toBeGreaterThanOrEqual(MIN_ATTEMPT_MS);
  });

  it("bounds the whole chain well under a minute", async () => {
    // The behaviour the missing budget cost: 30s + 30s of spinner.
    const started = Date.now();
    stub("gemini", { takesMs: PROVIDER_TIMEOUT_MS, result: TIMEOUT });
    stub("groq", { takesMs: PROVIDER_TIMEOUT_MS, result: TIMEOUT });
    await generate("s", [], "q");
    const elapsed = Date.now() - started;
    // The second attempt is capped at what was left, so the total cannot reach
    // 2 x PROVIDER_TIMEOUT_MS any more.
    expect(elapsed).toBeLessThan(2 * PROVIDER_TIMEOUT_MS);
  });
});

describe("generate - failover rules still hold", () => {
  it("does not fail over on a safety refusal", async () => {
    stub("gemini", { takesMs: 10, result: { ok: false, error: { code: "safety" } } });
    stub("groq", { takesMs: 0, result: FINE });
    const res = await generate("s", [], "q");
    expect(calls.map((c) => c.name)).toEqual(["gemini"]);
    expect(res.ok).toBe(false);
  });

  it("marks an answer from the fallback as such", async () => {
    stub("gemini", { takesMs: 10, result: QUOTA });
    stub("groq", { takesMs: 10, result: FINE });
    const res = await generate("s", [], "q");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.provider).toBe("groq");
      expect(res.fallback).toBe(true);
    }
  });
});
