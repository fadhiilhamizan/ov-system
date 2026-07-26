"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ColumnDatum {
  /** Short label under the column (kept to ~4 chars, like a division code). */
  label: string;
  /** Longer name shown in the tooltip. */
  title?: string;
  value: number;
  /** 0–100 — the column height, relative to the tallest column. */
  percent: number;
  color?: string;
}

/**
 * Vertical column chart: one column per entry, height = `percent` of the plot
 * area, value direct-labelled on top and the short code on the axis. Hovering a
 * column dims the others and shows its detail.
 */
export function ColumnChart({
  data,
  height = 180,
  className,
  valueSuffix,
}: {
  data: ColumnDatum[];
  height?: number;
  className?: string;
  valueSuffix?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);

  return (
    <div
      className={cn("w-full select-none overflow-x-auto pb-1", className)}
      onMouseLeave={() => setHover(null)}
    >
      <div className="flex min-w-fit items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const active = hover === i;
          const dim = hover !== null && !active;
          return (
            <div
              key={i}
              className="flex h-full min-w-11 flex-1 cursor-pointer flex-col justify-end gap-1"
              onMouseEnter={() => setHover(i)}
              title={`${d.title ?? d.label}: ${d.value}${valueSuffix ?? ""} (${d.percent}%)`}
            >
              <span
                className="text-center text-[11px] font-semibold tabular-nums transition-colors"
                style={{ color: active ? undefined : "var(--muted-foreground)" }}
              >
                {d.value}
              </span>
              <div
                className="w-full rounded-t-[4px] transition-all duration-200"
                style={{
                  height: `${Math.max(d.percent, d.value > 0 ? 3 : 0)}%`,
                  backgroundColor: d.color ?? "var(--primary)",
                  opacity: dim ? 0.3 : 1,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* axis */}
      <div className="mt-1.5 flex min-w-fit gap-2 border-t border-border pt-1.5">
        {data.map((d, i) => (
          <span
            key={i}
            className={cn(
              "min-w-11 flex-1 truncate text-center text-[10px] font-medium uppercase transition-colors",
              hover === i ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
