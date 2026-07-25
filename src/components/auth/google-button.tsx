"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

/** Google's brand mark — inlined so no external request is needed. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden focusable="false">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.56-5.15 3.56-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.87-3a7.2 7.2 0 0 1-10.72-3.78H1.36v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.36 14.3a7.19 7.19 0 0 1 0-4.6V6.62H1.36a12 12 0 0 0 0 10.77l4-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.36 6.62l4 3.09A7.15 7.15 0 0 1 12 4.75Z" />
    </svg>
  );
}

/**
 * Google sign-in / sign-up. Both are the same OAuth call — Supabase creates
 * the account on first use, and the profile trigger gives it no role.
 * Requires the Google provider to be enabled in the Supabase dashboard.
 */
export function GoogleButton({
  label,
  onError,
}: {
  label?: string;
  onError?: (message: string) => void;
}) {
  const t = useT();
  const [pending, setPending] = React.useState(false);

  async function signIn() {
    setPending(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser navigates away, so `pending` only matters here.
    if (error) {
      setPending(false);
      onError?.(error.message);
    }
  }

  return (
    <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={signIn}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
      {label ?? t("Lanjut dengan Google")}
    </Button>
  );
}
