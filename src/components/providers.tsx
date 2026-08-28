"use client";
import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Lang } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";

export function Providers({ lang, dict, children }: { lang: Lang; dict?: Dict | null; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <I18nProvider lang={lang} dict={dict}>
        {/* No TooltipProvider: this app renders no Radix tooltips at all. It
            used to wrap the whole tree and pulled @radix-ui/react-tooltip into
            every page's client bundle to serve zero tooltips. Hover hints here
            are plain `title` attributes. If a real tooltip is ever needed,
            bring the provider back with it, not before. */}
        {children}
        <Toaster />
      </I18nProvider>
    </ThemeProvider>
  );
}
