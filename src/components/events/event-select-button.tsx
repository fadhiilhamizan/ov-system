"use client";
import * as React from "react";
import { toast } from "sonner";
import { Check, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setActiveEvent } from "@/lib/actions/session";
import { useT } from "@/lib/i18n/provider";

/**
 * Switches which Ormawa Visit the whole app is scoped to — the same effect as
 * the topbar event dropdown, but reachable from the detailed list.
 */
export function EventSelectButton({ eventId, isActive }: { eventId: string; isActive: boolean }) {
  const t = useT();
  const [pending, start] = React.useTransition();

  if (isActive) {
    return (
      <Button variant="outline" size="sm" disabled className="w-full justify-center">
        <Check className="size-4" /> {t("Sedang dilihat")}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-center"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setActiveEvent(eventId);
          toast.success(t("Ormawa Visit aktif diganti"));
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
      {t("Lihat Ormawa Visit ini")}
    </Button>
  );
}
