import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, DEFAULT_LANG, type Lang } from "./config";
import { translate } from "./dict";

export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const v = store.get(LANG_COOKIE)?.value;
  return v === "en" ? "en" : DEFAULT_LANG;
}

/** Server-side translator. Usage: const t = await getT(); t("Tambah") */
export async function getT() {
  const lang = await getLang();
  return (s: string) => translate(lang, s);
}
