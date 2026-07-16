import * as React from "react";
import { cn } from "@/lib/utils";

export interface BarDatum {
  label: React.ReactNode;
  value: number;
  max?: number;
  color?: string;
  right?: React.ReactNode;
}

export function BarList({ data, className }: { data: BarDatum[]; className?: string }) {
  const globalMax = Math.max(1, ...data.map((d) => d.max ?? d.value));
  return (
    <div className={cn("space-y-3", className)}>
      {data.map((d, i) => {
        const max = d.max ?? globalMax;
        const w = Math.round((d.value / (max || 1)) * 100);
        return (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-medium">{d.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {d.right ?? d.value}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${w}%`, backgroundColor: d.color ?? "var(--primary)" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Stacked segmented bar (todo/ongoing/done...). */
export function StackedBar({
  segments,
  className,
  height = 8,
}: {
  segments: { value: number; color: string }[];
  className?: string;
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div
      className={cn("flex w-full overflow-hidden rounded-full bg-muted", className)}
      style={{ height }}
    >
      {segments.map((s, i) =>
        s.value > 0 ? (
          <div
            key={i}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ) : null,
      )}
    </div>
  );
}
