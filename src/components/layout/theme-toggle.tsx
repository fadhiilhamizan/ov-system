"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

export function ThemeToggle() {
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();
  // A real effect-based mounted flag, and it has to be.
  //
  // This used to read `resolvedTheme !== undefined` instead, on the theory that
  // next-themes leaves it undefined until it has read the client preference.
  // It does not: it reads localStorage SYNCHRONOUSLY during the first client
  // render, so `resolvedTheme` is already set while the server-rendered HTML
  // still holds the placeholder. React saw <span> from the server and <Moon/>
  // from the client and logged a hydration failure on every single page load,
  // then threw this subtree away and re-rendered it.
  //
  // useSyncExternalStore rather than a setState in an effect: the server
  // snapshot is false and the client snapshot is true, which IS the mounted
  // flag, with no state update and nothing for react-hooks/set-state-in-effect
  // to object to. Same three lines as components/layout/global-search.tsx.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("Ganti tema")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {mounted ? dark ? <Sun /> : <Moon /> : <span className="size-4" />}
    </Button>
  );
}
