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
    <Card className={cn("relative overflow-hidden p-3.5 sm:p-5", className)}>
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-[0.08] blur-xl"
        style={{ backgroundColor: accent }}
      />
      {/* On a phone two cards share a row, so the icon tucks into the corner
          and the number gets the full width instead of being cut off. */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="pr-8 text-[11px] font-medium leading-tight text-muted-foreground sm:pr-0 sm:text-xs">{label}</p>
          <p className="break-words text-lg font-bold leading-tight tracking-tight tabular-nums sm:text-2xl">{value}</p>
          {sub && <div className="text-[11px] leading-snug text-muted-foreground sm:text-xs">{sub}</div>}
        </div>
        {icon && (
          <div
            className="absolute right-3 top-3 flex size-7 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4 sm:static sm:size-10 sm:rounded-xl sm:[&_svg]:size-5"
            style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
