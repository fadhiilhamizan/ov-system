"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { reportErrorAction } from "@/lib/actions/developer";
import { isStaleBuildError } from "@/lib/stale-build";

const RELOAD_KEY = "ov_stale_reload_at";

/**
 * Segment-level error boundary for every page under (app).
 * Catches render/data errors so a single broken page can't take the whole
 * app shell down - the sidebar/topbar stay usable and the user can retry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  const stale = isStaleBuildError(error);
  React.useEffect(() => {
    // The tab is older than the server (a deploy happened): a reload IS the
    // fix, so do it once, quietly. The timestamp stops a loop if the reload
    // somehow lands on the same error again.
    if (!stale) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last > 60_000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      /* storage blocked: the button below still works */
    }
  }, [stale]);

  React.useEffect(() => {
    // Surface for logging/monitoring; the message itself is never shown raw.
    console.error("App error boundary:", error);
    // Also file it, so a crash somebody else hit shows up in the Developer
    // menu instead of only in a console nobody was watching. Fire and forget:
    // a failed report must not turn one error into two.
    reportErrorAction({
      kind: "boundary",
      message: error.message || "Unknown error",
      stack: error.stack ?? "",
      path: typeof window === "undefined" ? "" : window.location.pathname,
      // The digest is the whole report for a server-side failure: production
      // replaces the real message with one fixed sentence, and this hash is
      // what matches the row to the platform log entry that has the cause.
      digest: error.digest,
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center animate-fade-in">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {stale ? t("Aplikasi baru saja diperbarui") : t("Terjadi kesalahan")}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {stale
            ? t("Muat ulang halaman untuk melanjutkan. Perubahan yang belum tersimpan perlu diulang setelah dimuat ulang.")
            : t("Halaman ini gagal dimuat. Coba muat ulang, atau kembali ke dashboard.")}
        </p>
        {error.digest && (
          <p className="pt-1 font-mono text-xs text-muted-foreground/70">
            {t("Kode")}: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={stale ? () => window.location.reload() : reset}>
          <RotateCcw />
          {t("Coba lagi")}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <LayoutDashboard />
            {t("Ke Dashboard")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
