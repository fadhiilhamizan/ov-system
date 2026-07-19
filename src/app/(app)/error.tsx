"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

/**
 * Segment-level error boundary for every page under (app).
 * Catches render/data errors so a single broken page can't take the whole
 * app shell down — the sidebar/topbar stay usable and the user can retry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  React.useEffect(() => {
    // Surface for logging/monitoring; the message itself is never shown raw.
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center animate-fade-in">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {t("Terjadi kesalahan")}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("Halaman ini gagal dimuat. Coba muat ulang, atau kembali ke dashboard.")}
        </p>
        {error.digest && (
          <p className="pt-1 font-mono text-xs text-muted-foreground/70">
            {t("Kode")}: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
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
