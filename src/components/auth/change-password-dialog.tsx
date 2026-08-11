"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { checkNewPassword, MIN_PASSWORD } from "@/lib/password";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";

/**
 * Change the signed-in account's own password.
 *
 * Supabase's `updateUser({ password })` does NOT ask for the current password —
 * a session alone is enough. That is unacceptable here: the default
 * Koordinator/Staff/Intern logins are meant to be shared, so an unattended
 * browser would let anyone lock the rest of the committee out. We therefore
 * re-authenticate with the current password first and only then update.
 *
 * Accounts created through Google have no password to verify, so the dialog
 * detects that and says where to change it instead of failing with a wrong
 * "current password is incorrect".
 */
export function ChangePasswordDialog({
  email, open, onOpenChange,
}: {
  email: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  // Every re-open starts blank, so a half-typed attempt is never left lying
  // around in a shared browser. useResetOn resets during render rather than in
  // an effect, which avoids a second render pass.
  const [f, setF] = useResetOn(open, () => ({ current: "", next: "", confirm: "" }));
  const [error, setError] = useResetOn<string | null>(open, () => null);
  const [pending, setPending] = useResetOn(open, () => false);
  /** null = still checking, true/false = whether this account signs in with a password. */
  const [hasPassword, setHasPassword] = useResetOn<boolean | null>(open, () => null);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    createClient().auth.getUserIdentities().then(({ data }) => {
      if (!alive) return;
      const identities = data?.identities ?? [];
      // No identity list at all → assume password login rather than locking the
      // user out of a feature they may well need.
      setHasPassword(identities.length === 0 || identities.some((i) => i.provider === "email"));
    }).catch(() => { if (alive) setHasPassword(true); });
    return () => { alive = false; };
  }, [open, setHasPassword]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const check = checkNewPassword(f.next, f.confirm, f.current);
    if (!check.ok) { setError(check.error); return; }

    setPending(true);
    const supabase = createClient();

    // 1) Prove the person at the keyboard knows the CURRENT password.
    const { error: reauth } = await supabase.auth.signInWithPassword({
      email,
      password: f.current,
    });
    if (reauth) {
      setPending(false);
      // A 4xx here means the password was wrong; anything stranger is worth
      // showing verbatim (see authErrorMessage for the "{}" case).
      setError(
        reauth.status && reauth.status < 500
          ? t("Kata sandi saat ini salah.")
          : authErrorMessage(reauth),
      );
      return;
    }

    // 2) Only now set the new one.
    const { error: update } = await supabase.auth.updateUser({ password: f.next });
    setPending(false);
    if (update) { setError(authErrorMessage(update)); return; }

    toast.success(t("Kata sandi berhasil diubah"));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> {t("Ubah Kata Sandi")}
          </DialogTitle>
          <DialogDescription>
            {hasPassword === false
              ? t("Akun ini masuk lewat Google, jadi kata sandinya diatur di akun Google-mu — bukan di sini.")
              : t("Masukkan kata sandi saat ini, lalu kata sandi barunya.")}
          </DialogDescription>
        </DialogHeader>

        {hasPassword === false ? (
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Tutup")}</Button></DialogClose>
          </DialogFooter>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            {/* Helps password managers attach the change to the right account. */}
            <input type="hidden" name="username" autoComplete="username" value={email} readOnly />
            <div className="grid gap-1.5">
              <Label htmlFor="cur-pw">{t("Kata sandi saat ini")}</Label>
              <Input
                id="cur-pw"
                type="password"
                autoComplete="current-password"
                required
                value={f.current}
                onChange={(e) => setF({ ...f, current: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-pw">{t("Kata sandi baru")}</Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD}
                value={f.next}
                onChange={(e) => setF({ ...f, next: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">{t("Minimal 8 karakter.")}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-pw">{t("Ulangi kata sandi baru")}</Label>
              <Input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                required
                value={f.confirm}
                onChange={(e) => setF({ ...f, confirm: e.target.value })}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>
            )}

            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">{t("Batal")}</Button></DialogClose>
              <Button type="submit" disabled={pending || hasPassword === null}>
                {pending && <Loader2 className="size-4 animate-spin" />} {t("Simpan")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
