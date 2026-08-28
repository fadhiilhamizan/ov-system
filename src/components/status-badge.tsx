import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";

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
