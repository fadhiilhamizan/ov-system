"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, UserCog, Users } from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHARACTER_KEYS, CHARACTER_LABEL, CharacterAvatar, isCharacterKey,
} from "@/components/ui/character-avatar";
import { updateMyProfileAction } from "@/lib/actions/account";
import { useResetOn } from "@/lib/use-synced";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/lib/types";

/**
 * Edit your own display name and profile picture.
 *
 * Email and role are shown but NOT editable, and that is worth being explicit
 * about rather than silently leaving them out: an account's role is granted by
 * an admin through the role-request flow, and its email is a sign-in
 * credential that cannot change without a confirmation round trip. A form that
 * quietly omits them reads like a form that forgot them.
 */
export function EditAccountDialog({
  user, open, onOpenChange,
}: {
  user: AppUser;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  // Refilled every time it opens, so an abandoned edit is never waiting there
  // the next time somebody opens the menu - the same reason the password
  // dialog does it, and it matters more on a shared login.
  const [name, setName] = useResetOn(open, () => user.name);
  const [avatar, setAvatar] = useResetOn<string | null>(
    open,
    () => (isCharacterKey(user.avatar) ? user.avatar : null),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateMyProfileAction({ name, avatar });
      if (res.ok) {
        toast.success(t("Informasi akun diperbarui"));
        onOpenChange(false);
        // The topbar and sidebar render this name from the server, so the
        // dialog closing is not enough - without a refresh the old name stays
        // on screen until the next navigation.
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-4 text-primary" /> {t("Ubah Informasi Akun")}
          </DialogTitle>
          <DialogDescription>
            {t("Nama dan foto profil ini yang dilihat anggota lain di seluruh sistem.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          {user.isShared && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <Users className="mt-0.5 size-3.5 shrink-0" />
              {t("Akun ini dipakai bersama, jadi perubahan nama dan foto profilnya terlihat oleh semua orang yang memakainya.")}
            </p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="acc-name">
              {t("Nama tampilan")} <span className="text-danger">*</span>
            </Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Foto profil")}</Label>
            <div className="flex flex-wrap items-center gap-2">
              {/* "Inisial" is an option, not the absence of one: without it,
                  picking a character would be a one-way door. */}
              <button
                type="button"
                onClick={() => setAvatar(null)}
                aria-pressed={avatar === null}
                aria-label={t("Pakai inisial nama")}
                className={cn(
                  "rounded-full p-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  avatar === null ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100",
                )}
              >
                <Avatar name={name || user.name} color={user.avatarColor} size={44} />
              </button>
              {CHARACTER_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAvatar(key)}
                  aria-pressed={avatar === key}
                  aria-label={t(CHARACTER_LABEL[key])}
                  className={cn(
                    "relative rounded-full p-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    avatar === key ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100",
                  )}
                >
                  <CharacterAvatar character={key} size={44} />
                  {avatar === key && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-2.5" />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("Pilihan paling kiri memakai inisial namamu.")}
            </p>
          </div>

          {/* Read-only, and said out loud so their absence reads as deliberate. */}
          <div className="grid gap-1.5 rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">{t("Email")}</span>
              <span className="truncate text-xs">{user.email || "-"}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("Email dan peran tidak bisa diubah dari sini. Peran diberikan admin lewat Role Request.")}
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">{t("Batal")}</Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" />} {t("Simpan")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The same dialog, opened from a button.
 *
 * Settings is a Server Component and cannot hold the open/closed state, so the
 * button and the dialog travel together as one client island rather than
 * making the whole page client-side for one piece of local state.
 */
export function EditAccountButton({ user }: { user: AppUser }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserCog className="size-4" /> {t("Ubah")}
      </Button>
      <EditAccountDialog user={user} open={open} onOpenChange={setOpen} />
    </>
  );
}
