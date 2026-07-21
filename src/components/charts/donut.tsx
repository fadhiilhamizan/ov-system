"use client";
import * as React from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * Donut chart with per-segment hover: the hovered slice thickens, the rest dim,
 * and the centre swaps to that slice's detail (count + share).
 */
export function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centerLabel,
  centerSub,
}: {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: React.ReactNode;
  centerSub?: React.ReactNode;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness - 8) / 2;
  const c = 2 * Math.PI * r;
  const GAP = data.length > 1 ? 3 : 0; // px gap between slices

  // Plain loop (not map+outer accumulator) so nothing is mutated from inside a
  // render callback.
  const arcs: { d: DonutSegment; i: number; len: number; offset: number; pct: number }[] = [];
  for (let i = 0, off = 0; i < data.length; i++) {
    const d = data[i];
    const full = (d.value / total) * c;
    arcs.push({ d, i, len: Math.max(full - GAP, 0.5), offset: off, pct: (d.value / total) * 100 });
    off += full;
  }

  const active = hover !== null ? arcs[hover] : null;

  return (
    <div
      className="relative inline-flex select-none items-center justify-center"
      style={{ width: size, height: size }}
      onMouseLeave={() => setHover(null)}
    >
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        {/* track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={thickness} opacity={0.5} />
        {arcs.map(({ d, i, len, offset: off, pct }) => {
          const isActive = hover === i;
          const dim = hover !== null && !isActive;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={isActive ? thickness + 6 : thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-off}
              strokeLinecap="round"
              className="cursor-pointer transition-all duration-200"
              style={{ opacity: dim ? 0.28 : 1 }}
              onMouseEnter={() => setHover(i)}
            >
              <title>{`${d.label}: ${d.value} (${pct.toFixed(1)}%)`}</title>
            </circle>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        {active ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: active.d.color }} />
              <span className="text-[11px] font-medium text-muted-foreground">{active.d.label}</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{active.d.value}</div>
            <div className="text-[11px] text-muted-foreground">{active.pct.toFixed(1)}%</div>
          </>
        ) : (
          <>
            {centerLabel && <div className="text-2xl font-bold tabular-nums">{centerLabel}</div>}
            {centerSub && <div className="text-[11px] text-muted-foreground">{centerSub}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  thickness = 6,
  color = "var(--primary)",
  label,
}: {
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const len = (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${len} ${c - len}`}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
        {label ?? `${Math.round(value)}%`}
      </div>
    </div>
  );
}
