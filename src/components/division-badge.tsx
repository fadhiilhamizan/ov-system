import { cn } from "@/lib/utils";
import type { Division, DivisionKey } from "@/lib/types";

export function DivisionBadge({
  division,
  className,
  showDot = true,
}: {
  division: Division | { key: DivisionKey; name: string; short: string; color: string };
  className?: string;
  showDot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color: division.color,
        borderColor: `color-mix(in srgb, ${division.color} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${division.color} 10%, transparent)`,
      }}
    >
      {showDot && (
        <span className="size-1.5 rounded-full" style={{ backgroundColor: division.color }} />
      )}
      {division.short}
    </span>
  );
}
