import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        m.bg,
        m.color,
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

/**
 * `shrink-0` + `aspect-square` are load-bearing: as a flex child next to a long
 * task title the dot was being squashed horizontally, so it rendered as a tiny
 * oval instead of a circle (visible in the timeline's name column).
 */
export function StatusDot({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span
      className={cn("block size-2 aspect-square shrink-0 rounded-full", STATUS_META[status].dot, className)}
    />
  );
}
