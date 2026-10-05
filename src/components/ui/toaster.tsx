"use client";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as "light" | "dark") ?? "system"}
      position="bottom-right"
      // Clear of the bottom tab bar on a phone (it is lg:hidden).
      mobileOffset={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))", left: 12, right: 12 }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-border !bg-card !text-card-foreground !shadow-xl",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
