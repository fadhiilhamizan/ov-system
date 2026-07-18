"use client";
import * as React from "react";
import { Clock, Mic, ExternalLink, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { AddRundownButton, RundownActions } from "./rundown-manage";
import { isUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { RundownItem } from "@/lib/types";

const JOBS: { key: keyof RundownItem; label: string; color: string }[] = [
  { key: "job_lo", label: "LO", color: "#0ea5e9" },
  { key: "job_event", label: "Event", color: "#10b981" },
  { key: "job_consump", label: "Konsumsi", color: "#f97316" },
  { key: "job_creative", label: "Creative", color: "#d946ef" },
  { key: "job_opr", label: "Operational", color: "#64748b" },
];

export function RundownView({
  items,
  eventId,
  canManage,
}: {
  items: RundownItem[];
  eventId: string;
  canManage: boolean;
}) {
  const t = useT();
  const variants = React.useMemo(() => {
    const set = [...new Set(items.map((i) => i.variant))].sort();
    return set.length ? set : ["A"];
  }, [items]);
  const [variant, setVariant] = React.useState(variants[0] ?? "A");
  const list = items.filter((i) => i.variant === variant).sort((a, b) => a.no - b.no);

  if (!items.length) {
    return (
      <div className="space-y-4">
        {canManage && (
          <div className="flex justify-end">
            <AddRundownButton eventId={eventId} variant="A" />
          </div>
        )}
        <EmptyState icon={<Clock />} title={t("Belum ada rundown")} description={t("Rundown acara belum tersedia untuk Ormawa Visit ini.")} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {variants.length > 1 ? (
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {variants.map((v) => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition",
                  variant === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("Versi")} {v}
              </button>
            ))}
          </div>
        ) : <div />}
        {canManage && <AddRundownButton eventId={eventId} variant={variant} />}
      </div>

      <div className="relative space-y-3 before:absolute before:left-[68px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border sm:before:left-[84px]">
        {list.map((item) => (
          <div key={item.id} className="relative flex gap-3">
            <div className="w-16 shrink-0 pt-3 text-right sm:w-20">
              <div className="text-sm font-semibold tabular-nums">{item.time_start}</div>
              <div className="text-[11px] text-muted-foreground">{item.time_end}</div>
            </div>
            <div className="relative mt-4 shrink-0">
              <span className="flex size-4 items-center justify-center rounded-full border-2 border-primary bg-background">
                <span className="size-1.5 rounded-full bg-primary" />
              </span>
            </div>
            <Card className="flex-1 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                      {item.no}
                    </span>
                    <h4 className="font-semibold leading-tight">{item.activity}</h4>
                  </div>
                  {item.keterangan && <p className="mt-1 text-xs text-muted-foreground">{item.keterangan}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  {item.duration && <Badge variant="outline"><Clock className="size-3" /> {item.duration}</Badge>}
                  {canManage && <RundownActions item={item} eventId={eventId} />}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {item.host && (
                  <span className="inline-flex items-center gap-1"><User className="size-3" /> {item.host}</span>
                )}
                {item.mc && (
                  <span className="inline-flex items-center gap-1"><Mic className="size-3" /> {item.mc}</span>
                )}
                {item.opr_link && isUrl(item.opr_link) && (
                  <a href={item.opr_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="size-3" /> {t("Kebutuhan OPR")}
                  </a>
                )}
                {item.opr_link && !isUrl(item.opr_link) && (
                  <span className="inline-flex items-center gap-1"><ExternalLink className="size-3" /> {item.opr_link}</span>
                )}
              </div>

              {JOBS.some((j) => (item[j.key] as string)?.trim()) && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
                  {JOBS.map((j) => {
                    const val = (item[j.key] as string)?.trim();
                    if (!val) return null;
                    return (
                      <span
                        key={j.key}
                        className="inline-flex items-start gap-1 rounded-md px-1.5 py-1 text-[11px]"
                        style={{ backgroundColor: `color-mix(in srgb, ${j.color} 12%, transparent)`, color: j.color }}
                        title={val}
                      >
                        <span className="font-semibold">{t(j.label)}:</span>
                        <span className="line-clamp-2 max-w-[220px] text-foreground/80">{val}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
