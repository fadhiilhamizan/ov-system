"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_META, STATUS_ORDER } from "@/lib/constants";
import { setTaskStatusAction } from "@/lib/actions/tasks";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { AppUser, Task, TaskStatus } from "@/lib/types";

export function StatusMenu({ task, user }: { task: Task; user: AppUser }) {
  const [pending, start] = React.useTransition();
  const editable = can.editTaskProgress(user, task);
  const m = STATUS_META[task.status];

  if (!editable) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
          m.bg,
          m.color,
        )}
      >
        <span className={cn("size-1.5 rounded-full", m.dot)} />
        {m.label}
      </span>
    );
  }

  function change(s: TaskStatus) {
    if (s === task.status) return;
    start(async () => {
      const res = await setTaskStatusAction(task.id, s);
      if (res.ok) toast.success(`Status → ${STATUS_META[s].label}`);
      else toast.error(res.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-ring",
          m.bg,
          m.color,
          pending && "opacity-60",
        )}
      >
        <span className={cn("size-1.5 rounded-full", m.dot)} />
        {m.label}
        <ChevronDown className="size-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        {STATUS_ORDER.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => change(s)} className="gap-2">
            <span className={cn("size-2 rounded-full", STATUS_META[s].dot)} />
            {STATUS_META[s].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
