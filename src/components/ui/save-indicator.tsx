"use client";
import { Loader2, Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { SaveStatus } from "@/lib/use-autosave";

/**
 * Ambient autosave badge. Shows nothing when idle so it never adds clutter to a
 * table that is not being edited; the detail on failure still comes from the
 * toast - this is only the "it saved" reassurance.
 */
export function SaveIndicator({ status, className }: { status: SaveStatus; className?: string }) {
  const t = useT();
  if (status === "idle") return null;

  const map = {
    saving: { icon: <Loader2 className="size-3 animate-spin" />, text: t("Menyimpan…"), tone: "text-muted-foreground" },
    saved: { icon: <Check className="size-3" />, text: t("Tersimpan"), tone: "text-emerald-600 dark:text-emerald-400" },
    error: { icon: <CircleAlert className="size-3" />, text: t("Gagal menyimpan"), tone: "text-danger" },
  } as const;
  const s = map[status];

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", s.tone, className)}
    >
      {s.icon}
      {s.text}
    </span>
  );
}
