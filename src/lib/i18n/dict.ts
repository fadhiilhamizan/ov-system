import type { Lang } from "./config";

// Translation approach: the Indonesian string is the key. When the language is
// English, look it up in the EN map; unmapped strings gracefully fall back to
// Indonesian. (User-generated content is never translated.)
//
// BUNDLE NOTE: the EN map itself lives in ./dict.en.ts and is NOT imported
// here, so it never reaches the client bundle. It is loaded in two places:
//   * server side — lib/i18n/server.ts imports it directly (server-only);
//   * client side — the root layout resolves it (only when lang === "en") and
//     passes it to I18nProvider, so Indonesian visitors download 0 bytes of it
//     and English visitors get it before hydration (no mismatch).
export type Dict = Record<string, string>;

/** Look `s` up in `dict`, falling back to the Indonesian source string. */
export function translate(lang: Lang, s: string, dict?: Dict | null): string {
  if (lang === "en" && dict) return dict[s] ?? s;
  return s;
}

// NOTE: the loader lives in ./server.ts (server-only), NOT here. This module is
// imported by the client provider, so anything referencing ./dict.en from here
// would make the bundler emit a client chunk for the map.
