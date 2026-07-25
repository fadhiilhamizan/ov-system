"use client";
import * as React from "react";
import { toast } from "sonner";
import { Check, X, Loader2, Clock, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { DivisionBadge } from "@/components/division-badge";
import { approveRoleRequestAction, ignoreRoleRequestAction } from "@/lib/actions/roles";
import { ROLE_META } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { Division, OVEvent, RoleRequest } from "@/lib/types";

const STATUS_VARIANT = {
  pending: "warning",
  approved: "success",
  ignored: "outline",
} as const;

export function RoleRequestsView({
  requests,
  events,
  divisions,
}: {
  requests: RoleRequest[];
  events: OVEvent[];
  divisions: Division[];
}) {
  const t = useT();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [, start] = React.useTransition();

  const eventMap = React.useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  function decide(req: RoleRequest, approve: boolean) {
    setPendingId(req.id);
    start(async () => {
      const res = approve
        ? await approveRoleRequestAction(req.id)
        : await ignoreRoleRequestAction(req.id);
      setPendingId(null);
      if (res.ok) {
        toast.success(
          approve
            ? `${req.name} ${t("sekarang berperan sebagai")} ${t(ROLE_META[req.requested_role].label)}`
            : t("Permintaan diabaikan"),
        );
      } else toast.error(res.error);
    });
  }

  function Row({ req }: { req: RoleRequest }) {
    const division = divisions.find((d) => d.key === req.division) ?? null;
    const event = req.event_id ? eventMap.get(req.event_id) : null;
    const busy = pendingId === req.id;
    const isPending = req.status === "pending";

    return (
      <Card className={cn(!isPending && "opacity-70")}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Avatar name={req.name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{req.name}</p>
              <Badge variant="primary">{t(ROLE_META[req.requested_role].label)}</Badge>
              {division && <DivisionBadge division={division} />}
              {event && <Badge variant="outline">{event.title}</Badge>}
              <Badge variant={STATUS_VARIANT[req.status]}>
                {t(
                  req.status === "pending"
                    ? "Menunggu"
                    : req.status === "approved"
                      ? "Disetujui"
                      : "Diabaikan",
                )}
              </Badge>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Mail className="size-3 shrink-0" /> {req.email || "-"}
            </p>
            {req.message && (
              <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{req.message}</p>
            )}
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="size-3 shrink-0" />
              {t("Diajukan")} {formatDate(req.created_at.slice(0, 10), { long: true })}
            </p>
          </div>

          {isPending && (
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" disabled={busy} onClick={() => decide(req, true)}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {t("Setujui")}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(req, false)}>
                <X className="size-4" /> {t("Abaikan")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold">
          {t("Menunggu keputusan")}{" "}
          <span className="text-muted-foreground">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t("Tidak ada permintaan yang menunggu.")}
          </p>
        ) : (
          pending.map((r) => <Row key={r.id} req={r} />)
        )}
      </section>

      {decided.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold">
            {t("Riwayat")} <span className="text-muted-foreground">({decided.length})</span>
          </h2>
          {decided.map((r) => (
            <Row key={r.id} req={r} />
          ))}
        </section>
      )}
    </div>
  );
}
