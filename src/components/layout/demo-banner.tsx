"use client";
import * as React from "react";
import { FlaskConical, LogOut, Loader2 } from "lucide-react";
import { exitDemoMode } from "@/lib/actions/session";
import { useT } from "@/lib/i18n/provider";

/** Full-width strip shown while exploring the separate demo database. */
export function DemoBanner() {
  const t = useT();
  const [pending, start] = React.useTransition();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white dark:bg-amber-600">
      <FlaskConical className="size-3.5 shrink-0" />
      <span>{t("Mode Demo — database terpisah, aman untuk coba-coba. Perubahan tidak memengaruhi data asli.")}</span>
      <button
        type="button"
        onClick={() => start(() => exitDemoMode())}
        disabled={pending}
        className="ml-1 inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 transition hover:bg-white/30"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <LogOut className="size-3" />}
        {t("Keluar")}
      </button>
    </div>
  );
}
