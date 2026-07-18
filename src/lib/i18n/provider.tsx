"use client";
import * as React from "react";
import { translate } from "./dict";
import type { Lang } from "./config";

type Ctx = { lang: Lang; t: (s: string) => string };
const I18nCtx = React.createContext<Ctx>({ lang: "id", t: (s) => s });

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = React.useMemo<Ctx>(() => ({ lang, t: (s: string) => translate(lang, s) }), [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  return React.useContext(I18nCtx).t;
}
export function useLang() {
  return React.useContext(I18nCtx).lang;
}
