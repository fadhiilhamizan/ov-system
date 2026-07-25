"use client";
import * as React from "react";
import { Clock, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleRequestDialog } from "./role-request-dialog";
import { ROLE_META } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import type { OVEvent, RequestableRole } from "@/lib/types";

/**
 * Shown to signed-up accounts that have no role yet — they can see everything
 * a Tamu can, and nothing more, until an admin approves a role request.
 */
export function RoleRequestBanner({
  events,
  pendingRole,
}: {
  events: OVEvent[];
  /** Set when the account already has a request awaiting a decision. */
  pendingRole?: RequestableRole | null;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);

  if (pendingRole) {
    return (
      <div className="flex items-center gap-2 border-b border-sky-300/60 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
        <Clock className="size-3.5 shrink-0" />
        <span>
          {t("Permintaan peran")} <strong>{t(ROLE_META[pendingRole].label)}</strong>{" "}
          {t("sedang menunggu persetujuan admin.")}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <UserRoundCheck className="size-3.5 shrink-0" />
        <span>{t("Akunmu belum punya peran, jadi masih hanya bisa melihat.")}</span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 border-amber-400/60 bg-transparent text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/20"
          onClick={() => setOpen(true)}
        >
          {t("Ajukan Peran")}
        </Button>
      </div>
      <RoleRequestDialog events={events} open={open} onOpenChange={setOpen} />
    </>
  );
}
