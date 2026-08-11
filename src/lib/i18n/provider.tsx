"use client";
import * as React from "react";
import { translate, type Dict } from "./dict";
import type { Lang } from "./config";

type Ctx = { lang: Lang; t: (s: string) => string };
const I18nCtx = React.createContext<Ctx>({ lang: "id", t: (s) => s });

/**
 * `dict` is resolved on the SERVER (root layout) and only sent when the active
 * language is English - so Indonesian visitors never download the 33KB map, and
 * English visitors already have it at hydration time (no text mismatch).
 */
export function I18nProvider({
  lang,
  dict,
  children,
}: {
  lang: Lang;
  dict?: Dict | null;
  children: React.ReactNode;
}) {
  const value = React.useMemo<Ctx>(
    () => ({ lang, t: (s: string) => translate(lang, s, dict) }),
    [lang, dict],
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  return React.useContext(I18nCtx).t;
}
export function useLang() {
  return React.useContext(I18nCtx).lang;
}
