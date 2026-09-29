"use client";
import { Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { LocalStatus } from "@/lib/use-local-first";

/**
 * Ambient save state for local-first lists (see use-local-first.ts).
 * Deliberately calm: "pending" is plain muted text with no spinner, because
 * nothing on the page waits for it - the person can keep working.
 */
export function LocalSaveStatus({ status, className }: { status: LocalStatus; className?: string }) {
  const t = useT();
  if (status === "idle") return null;
  const map = {
    pending: { icon: <span className="size-1.5 rounded-full bg-muted-foreground/60" />, text: t("Perubahan disimpan otomatis"), tone: "text-muted-foreground" },
    saved: { icon: <Check className="size-3" />, text: t("Tersimpan"), tone: "text-emerald-600 dark:text-emerald-400" },
    error: { icon: <CircleAlert className="size-3" />, text: t("Gagal menyimpan"), tone: "text-danger" },
  } as const;
  const m = map[status];
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-1.5 text-xs", m.tone, className)}>
      {m.icon}
      {m.text}
    </span>
  );
}
