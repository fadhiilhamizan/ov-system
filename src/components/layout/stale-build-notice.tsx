"use client";
import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { STALE_BUILD_EVENT, announceStaleBuild, isStaleBuildError } from "@/lib/stale-build";

/**
 * "The app was updated - reload to continue", shown once when this tab turns
 * out to be running an older build than the server (see lib/stale-build.ts).
 *
 * Listens for the event the save queues fire, and also catches the same error
 * when it escapes as an unhandled rejection (a lazy chunk, a direct action
 * call), so every path ends in the same calm sentence instead of a crash.
 */
export function StaleBuildNotice() {
  const t = useT();
  const [stale, setStale] = React.useState(false);

  React.useEffect(() => {
    const on = () => setStale(true);
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleBuildError(e.reason)) { e.preventDefault(); announceStaleBuild(); }
    };
    const onError = (e: ErrorEvent) => {
      if (isStaleBuildError(e.error ?? e.message)) announceStaleBuild();
    };
    window.addEventListener(STALE_BUILD_EVENT, on);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener(STALE_BUILD_EVENT, on);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  if (!stale) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-card p-3 shadow-2xl sm:bottom-6 lg:bottom-6"
    >
      <RefreshCw className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{t("Aplikasi baru saja diperbarui")}</p>
        <p className="text-xs text-muted-foreground">
          {t("Muat ulang halaman untuk melanjutkan. Perubahan yang belum tersimpan perlu diulang setelah dimuat ulang.")}
        </p>
      </div>
      <Button size="sm" onClick={() => window.location.reload()}>
        <RefreshCw className="size-4" /> {t("Muat ulang")}
      </Button>
    </div>
  );
}
