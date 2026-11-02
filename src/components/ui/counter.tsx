"use client";
import * as React from "react";
import { AnimatedCounter } from "@/components/ui/rare/animated-counter";

// The app's two odometer numbers, with Indonesian grouping ("1.250.000") so
// they read exactly like formatNumber/formatRupiah output once they settle.
// Both roll up from 0 when they mount (a page figure never changes while you
// look at it otherwise) and roll again whenever the value changes in place,
// e.g. a budget total after a qty edit.

export function Counter({
  value,
  suffix,
  className,
}: {
  value: number;
  suffix?: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatedCounter
      value={value}
      separator="."
      decimalSeparator=","
      suffix={suffix}
      rollIn
      className={className}
    />
  );
}

/** Same as `formatRupiah`: "Rp" with no space, rounded, dot-grouped. */
export function RupiahCounter({ value, className }: { value: number; className?: string }) {
  return (
    <AnimatedCounter
      value={Math.round(value)}
      prefix="Rp"
      separator="."
      decimalSeparator=","
      rollIn
      className={className}
    />
  );
}
