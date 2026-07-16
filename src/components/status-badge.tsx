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
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: TaskStatus; className?: string }) {
  return <span className={cn("size-2 rounded-full", STATUS_META[status].dot, className)} />;
}
