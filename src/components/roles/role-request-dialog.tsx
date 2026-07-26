"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, UserRoundCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestRoleAction, updateRoleRequestAction } from "@/lib/actions/roles";
import { ROLE_META } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import type { RequestableRole, RoleRequest } from "@/lib/types";

/**
 * Ask an admin for a role. Used both for a first request and for changing an
 * existing role later. A role applies to EVERY Ormawa Visit, so there is no
 * edition picker here.
 *
 * Pass `existing` to edit a still-pending request instead of filing a new one.
 */
export function RoleRequestDialog({
  options,
  existing,
  open,
  onOpenChange,
}: {
  /** Roles this account may ask for — already excludes admin and its own role. */
  options: RequestableRole[];
  existing?: RoleRequest | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const editing = !!existing;
  const initialRole = (existing?.requested_role ?? options[0]) as RequestableRole;
  const [role, setRole] = React.useState<RequestableRole>(initialRole);
  const [message, setMessage] = React.useState(existing?.message ?? "");
  const [pending, start] = React.useTransition();

  // Re-seed the form each time the dialog opens so a cancelled edit doesn't
  // leave stale values behind.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setRole(initialRole);
      setMessage(existing?.message ?? "");
    }
  }

  function submit() {
    start(async () => {
      const payload = { requested_role: role, message };
      const res = editing
        ? await updateRoleRequestAction(existing!.id, payload)
        : await requestRoleAction(payload);
      if (res.ok) {
        toast.success(
          editing
            ? t("Pengajuan peran diperbarui.")
            : t("Permintaan peran terkirim. Tunggu persetujuan admin."),
        );
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCheck className="size-4 text-primary" />
            {editing ? t("Ubah Pengajuan Peran") : t("Ajukan Peran")}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? t("Pengajuanmu belum diputuskan admin, jadi masih bisa diperbaiki.")
              : t("Pilih peran yang kamu inginkan — admin akan menyetujui atau mengabaikannya. Peran berlaku untuk semua Ormawa Visit.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label>{t("Peran yang diminta")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RequestableRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map((r) => (
                  <SelectItem key={r} value={r}>{t(ROLE_META[r].label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(ROLE_META[role].description)}</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rr-message">{t("Catatan untuk admin")}</Label>
            <Textarea
              id="rr-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("Contoh: staff divisi Event")}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {editing ? t("Simpan Perubahan") : t("Kirim permintaan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
