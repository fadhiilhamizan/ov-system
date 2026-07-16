import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "var(--primary)",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden p-5", className)}>
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-[0.08] blur-xl"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
        {icon && (
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5"
            style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
