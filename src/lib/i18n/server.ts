import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, DEFAULT_LANG, type Lang } from "./config";
import { translate, type Dict } from "./dict";

export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const v = store.get(LANG_COOKIE)?.value;
  return v === "en" ? "en" : DEFAULT_LANG;
}

/** Loads the English map. Server-only (this module is "server-only"), so the
 *  33KB dictionary never enters the client graph - the root layout calls this
 *  and passes the result down to the client provider as a prop. */
export async function loadDict(lang: Lang): Promise<Dict | null> {
  if (lang !== "en") return null;
  return (await import("./dict.en")).EN;
}

/** Server-side translator. Usage: const t = await getT(); t("Tambah")
 *  The EN map is loaded server-side only (never in the client bundle). */
export async function getT() {
  const lang = await getLang();
  const dict = await loadDict(lang);
  return (s: string) => translate(lang, s, dict);
}
