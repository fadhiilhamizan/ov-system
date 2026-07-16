"use client";
import { ListChecks } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DivisionBadge } from "@/components/division-badge";
import { StatusMenu } from "./status-menu";
import { TaskActions } from "./task-actions";
import { TaskDetailDialog } from "./task-detail-dialog";
import { EmptyState } from "@/components/ui/empty";
import { formatDate, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppUser, Division, OVEvent, Task } from "@/lib/types";

export function TaskTable({
  tasks,
  divisions,
  events,
  activeEventId,
  user,
}: {
  tasks: Task[];
  divisions: Division[];
  events: OVEvent[];
  activeEventId: string;
  user: AppUser;
}) {
  const divMap = new Map(divisions.map((d) => [d.key, d]));
  const evMap = new Map(events.map((e) => [e.id, e]));

  if (!tasks.length) {
    return (
      <EmptyState
        icon={<ListChecks />}
        title="Tidak ada tugas"
        description="Belum ada tugas yang cocok dengan filter saat ini."
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">#</TableHead>
            <TableHead className="min-w-[240px]">Tugas</TableHead>
            <TableHead>Divisi</TableHead>
            <TableHead className="min-w-[120px]">PIC</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => {
            const div = divMap.get(t.division);
            const d = daysUntil(t.end_date);
            const overdue = d !== null && d < 0 && t.status !== "done";
            return (
              <TableRow key={t.id}>
                <TableCell className="text-xs text-muted-foreground">{t.no || "–"}</TableCell>
                <TableCell>
                  <TaskDetailDialog task={t} division={div} event={evMap.get(t.event_id)} user={user}>
                    <button className="group flex flex-col text-left">
                      <span className="line-clamp-2 text-sm font-medium group-hover:text-primary">
                        {t.title}
                      </span>
                      {t.notes && (
                        <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {t.notes}
                        </span>
                      )}
                    </button>
                  </TaskDetailDialog>
                </TableCell>
                <TableCell>{div && <DivisionBadge division={div} />}</TableCell>
                <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                  {t.pic || "—"}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "text-sm",
                      overdue ? "font-medium text-danger" : "text-muted-foreground",
                    )}
                  >
                    {formatDate(t.end_date) ?? t.end_raw ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusMenu task={t} user={user} />
                </TableCell>
                <TableCell>
                  <TaskActions
                    task={t}
                    divisions={divisions}
                    events={events}
                    activeEventId={activeEventId}
                    user={user}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
