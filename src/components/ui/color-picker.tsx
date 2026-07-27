"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Shared colour picker — used by the division form (division colour) and the
// budget item dialog (the category dot). One palette, one behaviour, so the
// two never drift apart.
// ============================================================

/** Ordered by hue (warm → cool → violet/pink), neutral gray last. */
export const COLOR_PRESET = [
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#14b8a6", // teal
  "#0ea5e9", // sky
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
  "#64748b", // slate (neutral)
];

/** Lighten a hex colour by mixing it toward white. */
export function lighten(hex: string, amount = 0.55): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return "#" + [mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export const COLOR_PRESET_LIGHT = COLOR_PRESET.map((c) => lighten(c));

export function ColorPicker({
  value,
  onChange,
  size = "md",
  className,
}: {
  value: string;
  onChange: (color: string) => void;
  /** "sm" for inline use inside a dense dialog row. */
  size?: "sm" | "md";
  className?: string;
}) {
  const dot = size === "sm" ? "size-6" : "size-7";
  const swatch = (c: string) => (
    <button
      key={c}
      type="button"
      aria-label={c}
      onClick={() => onChange(c)}
      className={cn(
        dot,
        "rounded-full ring-2 ring-offset-2 ring-offset-background transition",
        value.toLowerCase() === c.toLowerCase() ? "ring-foreground" : "ring-transparent",
      )}
      style={{ backgroundColor: c }}
    />
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">{COLOR_PRESET.map(swatch)}</div>
      <div className="flex flex-wrap items-center gap-2">{COLOR_PRESET_LIGHT.map(swatch)}</div>
      <input
        type="color"
        aria-label="Warna khusus"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("cursor-pointer rounded", size === "sm" ? "size-7" : "size-8")}
      />
    </div>
  );
}
