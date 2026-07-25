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
import { requestRoleAction } from "@/lib/actions/roles";
import { ROLE_META } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import type { OVEvent, RequestableRole } from "@/lib/types";

const REQUESTABLE: RequestableRole[] = ["coordinator", "staff", "intern"];
const NO_EVENT = "__none__";

/**
 * Lets a signed-up but role-less account ask an admin for a real role. Opened
 * from the user menu; the admin decides in the "Role Request" menu.
 */
export function RoleRequestDialog({
  events,
  open,
  onOpenChange,
}: {
  events: OVEvent[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const [role, setRole] = React.useState<RequestableRole>("staff");
  const [eventId, setEventId] = React.useState<string>(NO_EVENT);
  const [message, setMessage] = React.useState("");
  const [pending, start] = React.useTransition();

  function submit() {
    start(async () => {
      const res = await requestRoleAction({
        requested_role: role,
        event_id: eventId === NO_EVENT ? undefined : eventId,
        message,
      });
      if (res.ok) {
        toast.success(t("Permintaan peran terkirim. Tunggu persetujuan admin."));
        onOpenChange(false);
        setMessage("");
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCheck className="size-4 text-primary" /> {t("Ajukan Peran")}
          </DialogTitle>
          <DialogDescription>
            {t("Akun barumu belum punya peran (masih setara Tamu). Pilih peran yang kamu inginkan — admin akan menyetujui atau mengabaikannya.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label>{t("Peran yang diminta")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RequestableRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REQUESTABLE.map((r) => (
                  <SelectItem key={r} value={r}>{t(ROLE_META[r].label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(ROLE_META[role].description)}</p>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Ormawa Visit")}</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_EVENT}>{t("Belum ditentukan")}</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rr-message">{t("Catatan untuk admin")}</Label>
            <Textarea
              id="rr-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("Contoh: staff divisi Event OV1 2026")}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} {t("Kirim permintaan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
