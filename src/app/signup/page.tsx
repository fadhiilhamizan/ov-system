"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, MailCheck } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { checkNewPassword, MIN_PASSWORD } from "@/lib/password";
import { GoogleButton } from "@/components/auth/google-button";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";


export default function SignUpPage() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [checkEmail, setCheckEmail] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  // Client-side throttle. Supabase GoTrue rate-limits sign-ups server-side too,
  // but this stops the form itself being hammered: at most MAX attempts per
  // WINDOW, then a visible cooldown. Defence in depth, not the only line.
  const attempts = React.useRef<number[]>([]);
  const [cooldown, setCooldown] = React.useState(0);
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 60_000;
  const COOLDOWN_S = 30;

  React.useEffect(() => {
    if (!isSupabaseConfigured) router.replace("/dashboard");
  }, [router]);

  // Tick the cooldown down once a second while it is active.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (cooldown > 0) return;
    // Shared with Ubah Kata Sandi so the two cannot drift apart.
    const check = checkNewPassword(password, confirm);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    // Prune old attempts, then enforce the per-window cap.
    const now = Date.now();
    attempts.current = attempts.current.filter((ts) => now - ts < WINDOW_MS);
    if (attempts.current.length >= MAX_ATTEMPTS) {
      setCooldown(COOLDOWN_S);
      setError(t("Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi."));
      return;
    }
    attempts.current.push(now);
    setPending(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Read by the handle_new_user trigger for profiles.name.
        data: { name: name.trim() || email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    // No session back means Supabase requires email confirmation first.
    if (!data.session) {
      setCheckEmail(true);
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
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
          {checkEmail ? (
            <div className="space-y-3 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <MailCheck className="size-6" />
              </span>
              <p className="text-sm font-semibold">{t("Cek email kamu")}</p>
              <p className="text-sm text-muted-foreground">
                {t("Kami mengirim tautan konfirmasi ke")} <span className="font-medium text-foreground">{email}</span>.{" "}
                {t("Buka tautan itu untuk mengaktifkan akun.")}
              </p>
              <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
                {t("Kembali ke halaman masuk")}
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="name">{t("Nama lengkap")}</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama kamu"
                  />
                </div>
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
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <p className="text-[11px] text-muted-foreground">{t("Minimal 8 karakter.")}</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="confirm">{t("Ulangi kata sandi")}</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={pending || cooldown > 0}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  {cooldown > 0 ? `${t("Tunggu")} ${cooldown}s` : t("Daftar")}
                </Button>
              </form>

              <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> {t("atau")} <span className="h-px flex-1 bg-border" />
              </div>

              <GoogleButton label={t("Daftar dengan Google")} onError={setError} />

              <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {t("Akun baru belum punya peran — kamu bisa melihat data, lalu ajukan peran (Koordinator / Staff / Intern) lewat menu akun untuk disetujui admin.")}
              </p>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                {t("Dengan mendaftar, kamu menyetujui")}{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  {t("Ketentuan Layanan")}
                </Link>{" "}
                {t("dan")}{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  {t("Kebijakan Privasi")}
                </Link>
                .
              </p>
            </>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("Sudah punya akun?")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("Masuk")}
          </Link>
        </p>
      </div>
    </div>
  );
}
