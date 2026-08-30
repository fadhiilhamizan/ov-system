"use client";
import * as React from "react";
import { Languages } from "lucide-react";
import { useLang, useT } from "@/lib/i18n/provider";
import { setLang } from "@/lib/actions/session";
import { cn } from "@/lib/utils";

export function LangToggle() {
  const t = useT();
  const lang = useLang();
  const [pending, start] = React.useTransition();
  const next = lang === "id" ? "en" : "id";

  return (
    <button
      onClick={() => start(() => setLang(next))}
      disabled={pending}
      aria-label={t("Ganti bahasa")}
      // The two titles are deliberately NOT translated: each is written in
      // the language it switches TO, which is the whole point of a language
      // toggle. Someone who cannot read the current language still has to be
      // able to read the way out.
      title={lang === "id" ? "Switch to English" : "Ganti ke Bahasa Indonesia"}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pending && "opacity-60",
      )}
    >
      <Languages className="size-4 text-muted-foreground" />
      <span className="tabular-nums uppercase">{lang}</span>
    </button>
  );
}
