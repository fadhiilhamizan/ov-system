"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Eye, FlaskConical } from "lucide-react";
import { createClient, isSupabaseConfigured, isDemoConfigured } from "@/lib/supabase/client";
import { enterGuestMode, enterDemoMode } from "@/lib/actions/session";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [guestPending, startGuest] = React.useTransition();
  const [demoPending, startDemo] = React.useTransition();

  React.useEffect(() => {
    if (!isSupabaseConfigured) router.replace("/dashboard");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setPending(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo size={48} />
          <h1 className="text-xl font-bold">Ormawa Visit Management System</h1>
          <p className="text-sm text-muted-foreground">External Affairs HMSI ITS</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@ormawavisit.id"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">{t("Kata sandi")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              {t("Masuk")}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> {t("atau")} <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={guestPending}
            onClick={() => startGuest(() => enterGuestMode())}
          >
            {guestPending ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            {t("Masuk sebagai Tamu (hanya lihat)")}
          </Button>

          {isDemoConfigured && (
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full border-amber-400/60 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10"
              disabled={demoPending}
              onClick={() => startDemo(() => enterDemoMode())}
            >
              {demoPending ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
              {t("Coba Mode Demo (database terpisah)")}
            </Button>
          )}
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("Belum punya akun? Hubungi PIC Ormawa Visit untuk dibuatkan.")}
        </p>
      </div>
    </div>
  );
}
