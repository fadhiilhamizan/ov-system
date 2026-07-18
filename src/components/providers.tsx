"use client";
import * as React from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Lang } from "@/lib/i18n/config";

export function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <I18nProvider lang={lang}>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster />
      </I18nProvider>
    </ThemeProvider>
  );
}
