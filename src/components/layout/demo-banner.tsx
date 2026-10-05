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
    <div className="flex items-center justify-center gap-x-2 bg-amber-500 px-3 py-1 text-center text-[11px] font-medium text-white sm:flex-wrap sm:px-4 sm:py-1.5 sm:text-xs dark:bg-amber-600">
      <FlaskConical className="size-3.5 shrink-0" />
      {/* One short line on a phone: the full sentence took three. */}
      <span className="truncate sm:hidden">{t("Mode Demo (data terpisah)")}</span>
      <span className="hidden sm:inline">{t("Mode Demo - database terpisah, aman untuk coba-coba. Perubahan tidak memengaruhi data asli.")}</span>
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
