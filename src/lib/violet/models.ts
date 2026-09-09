// ============================================================
// The models Violet may be asked to answer with.
//
// NOT server-only, on purpose: the picker in the chat renders these labels in
// the browser. There is nothing secret here - a model id is public, the API
// keys stay in gemini.ts / groq.ts, which are server-only.
//
// WHY A WHITELIST AND NOT A FREE-TEXT FIELD. The chosen id is sent by the
// browser and pasted into a provider URL (`/models/<id>:generateContent`) or a
// request body. Accepting an arbitrary string would let a client aim the app's
// key at any model on the account, including expensive ones, and put attacker
// text into a URL path. `resolveModel` below only ever returns an entry from
// this table, exactly like `resolveHref` in links.ts only ever returns a real
// route.
//
// WHY IT IS CURATED AND NOT FETCHED FROM /models. Both providers LIST models
// their key cannot actually use: `gemini-2.5-flash` and `gemini-2.5-pro` are
// both advertised and both answer 404, and `gemini-pro-latest` answers 429 on
// the free tier. A list built from the API would be full of options that fail
// the moment somebody picks them. Every entry below was verified against a real
// key before being added.
//
// A model that will not answer is worse than one fewer choice, so keep this
// list short and keep it tested by hand when adding to it.
// ============================================================

export type VioletProviderName = "gemini" | "groq";

export interface VioletModel {
  /** The provider's own id, sent verbatim in the request. */
  id: string;
  provider: VioletProviderName;
  /** Shown in the picker. */
  label: string;
  /** One line under the label, saying when to reach for it. */
  note: string;
}

/**
 * THINKING MODELS ARE THE TRAP HERE, and it is why the list reads the way it
 * does. A "thinking" model spends part of its output allowance on hidden
 * reasoning tokens before writing a single character of the answer. With
 * `maxOutputTokens: 900` it can spend the lot and return a candidate with NO
 * text at all - which is not an outage, not a refusal, and not something the
 * old code could describe. Prefer a non-thinking model as the default and let
 * the thinking ones be a deliberate choice.
 */
export const VIOLET_MODELS: VioletModel[] = [
  {
    id: "gemini-flash-lite-latest",
    provider: "gemini",
    label: "Gemini Flash Lite",
    note: "Cepat dan paling jarang gagal. Pilihan bawaan.",
  },
  {
    id: "gemini-flash-latest",
    provider: "gemini",
    label: "Gemini Flash",
    note: "Jawaban lebih dalam, tapi sering penuh dan lebih lambat.",
  },
  {
    id: "openai/gpt-oss-120b",
    provider: "groq",
    label: "GPT-OSS 120B (Groq)",
    note: "Paling teliti di Groq. Dipakai saat kuota Gemini habis.",
  },
  {
    id: "openai/gpt-oss-20b",
    provider: "groq",
    label: "GPT-OSS 20B (Groq)",
    note: "Lebih ringan dan lebih cepat, sedikit kurang teliti.",
  },
  {
    id: "qwen/qwen3.8-27b",
    provider: "groq",
    label: "Qwen 3.8 27B (Groq)",
    note: "Alternatif kalau dua di atas sedang bermasalah.",
  },
];

/**
 * What each provider reaches for when nobody has chosen.
 *
 * Both of these replaced ids that had gone stale, and the outage they caused is
 * the reason this file exists:
 *
 *   - Gemini's default was `gemini-flash-latest`. It is an ALIAS, chosen so a
 *     pinned version could not retire under us - but the alias moved onto a
 *     brand-new thinking model, and that model answered 503 "experiencing high
 *     demand" on four of every six requests. `gemini-flash-lite-latest` is the
 *     same kind of alias one tier down: still never pinned, but pointed at a
 *     model that is not in a launch rush and does not think before answering.
 *   - Groq's default was `llama-3.3-70b-versatile`, which Groq has since
 *     removed entirely: every question came back 404 model_not_found. There is
 *     no Llama chat model on the account any more, so the default moved to the
 *     OpenAI open-weight model, which is what Groq actually serves now.
 *
 * With BOTH defaults dead, the chain failed over from a broken primary to a
 * broken backup and reported the primary's 503 as "the AI service is having
 * problems" - forever, for every question, which is exactly what was reported.
 *
 * An env var still wins over this (GEMINI_MODEL / GROQ_MODEL), so a bad default
 * can be corrected without a deploy. It is deliberately NOT validated against
 * the table above: that variable is set by whoever runs the server, not by a
 * browser, and pinning a model the picker does not list is a legitimate thing
 * for an admin to want.
 */
export const DEFAULT_MODEL: Record<VioletProviderName, string> = {
  gemini: "gemini-flash-lite-latest",
  groq: "openai/gpt-oss-120b",
};

/**
 * The model a client asked for, or null.
 *
 * Null for anything not on the list, including undefined and "auto": the caller
 * treats "no pinned model" as "run the normal chain", so an unknown id degrades
 * to the default behaviour rather than to an error.
 */
export function resolveModel(id: string | null | undefined): VioletModel | null {
  if (!id) return null;
  return VIOLET_MODELS.find((m) => m.id === id) ?? null;
}

/** Label for a model id, for the "answered by" note under a bubble. */
export function modelLabel(id: string | null | undefined): string | null {
  return resolveModel(id)?.label ?? null;
}
