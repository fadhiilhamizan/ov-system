"use client";
import * as React from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, LogIn, RotateCcw, Eye } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { openShareAction } from "@/lib/actions/session";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";
import { DEMO_COOKIE } from "@/lib/demo";

/**
 * Opening a share link, with no login page in between.
 *
 * 1. A link into the real database first leaves the demo, if this browser was
 *    in it (the browser Supabase client picks its project from that cookie).
 * 2. No session yet? Start an anonymous one: that IS the Tamu mode, read-only,
 *    and RLS still applies to everything it reads.
 * 3. openShareAction picks the edition, and we go to the menu with a full
 *    navigation so the whole app shell is rendered for the new identity.
 *
 * Runs once on arrival; a failure is shown with a retry and a way to log in.
 */
export function ShareLanding({
  event, module, moduleLabel, demo, query,
}: {
  event: string;
  module: string;
  moduleLabel: string;
  demo: boolean;
  query: Record<string, string>;
}) {
  const t = useT();
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  // One run per attempt. A dev-mode double effect (or a re-render) must not
  // start two anonymous sessions for one visit.
  const started = React.useRef(-1);

  React.useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    (async () => {
      try {
        // Nothing to open: say so before starting any session.
        if (!module) throw new Error(t("Menu di tautan ini tidak bisa dibagikan."));
        let guest = false;
        if (!demo) {
          document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
          if (isSupabaseConfigured) {
            const supabase = createClient();
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
              const { error: anonError } = await supabase.auth.signInAnonymously();
              if (anonError) throw new Error(authErrorMessage(anonError));
              guest = true;
            }
          }
        }
        const res = await openShareAction({ event, module, demo, guest, query });
        if (!res.ok) { setError(res.error); return; }
        window.location.replace(res.href);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Tautan tidak bisa dibuka."));
      }
    })();
  }, [event, module, demo, query, attempt, t]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm space-y-4 p-6 text-center">
        <div className="flex justify-center"><Logo size={44} /></div>
        {!error ? (
          <div role="status" className="space-y-2">
            <p className="inline-flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin text-primary" /> {t("Membuka")} {moduleLabel}…
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="size-3.5" /> {t("Kamu akan melihat sebagai Tamu (hanya baca), tanpa perlu login.")}
            </p>
          </div>
        ) : (
          <div role="alert" className="space-y-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-danger">
              <AlertTriangle className="size-4" /> {t("Tautan tidak bisa dibuka")}
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={() => { setError(null); setAttempt((a) => a + 1); }}>
                <RotateCcw className="size-4" /> {t("Coba lagi")}
              </Button>
              <Button asChild className="flex-1">
                <Link href="/login"><LogIn className="size-4" /> {t("Masuk")}</Link>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
