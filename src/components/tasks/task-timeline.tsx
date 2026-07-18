"use client";
import * as React from "react";
import { CalendarRange } from "lucide-react";
import { DivisionBadge } from "@/components/division-badge";
import { TaskDetailDialog } from "./task-detail-dialog";
import { StatusDot } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDate } from "@/lib/format";
import { STATUS_META } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import type { AppUser, Division, OVEvent, Task } from "@/lib/types";

const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

export function TaskTimeline({
  tasks,
  divisions,
  events,
  user,
}: {
  tasks: Task[];
  divisions: Division[];
  events: OVEvent[];
  user: AppUser;
}) {
  const tr = useT();
  const divMap = new Map(divisions.map((d) => [d.key, d]));
  const evMap = new Map(events.map((e) => [e.id, e]));

  const dated = tasks
    .map((t) => {
      const s = t.start_date ?? t.end_date;
      const e = t.end_date ?? t.start_date;
      return s && e ? { task: t, start: new Date(s).getTime(), end: new Date(e).getTime() } : null;
    })
    .filter((x): x is { task: Task; start: number; end: number } => !!x)
    .sort((a, b) => a.start - b.start);

  const undated = tasks.filter((t) => !t.start_date && !t.end_date);

  if (!dated.length) {
    return (
      <EmptyState
        icon={<CalendarRange />}
        title={tr("Belum ada tugas berjadwal")}
        description={tr("Tambahkan tanggal mulai/deadline pada tugas untuk melihat timeline.")}
      />
    );
  }

  const min = Math.min(...dated.map((d) => d.start));
  const max = Math.max(...dated.map((d) => d.end));
  const span = Math.max(1, max - min);

  // month ticks
  const ticks: { label: string; pos: number }[] = [];
  const cur = new Date(min);
  cur.setDate(1);
  while (cur.getTime() <= max) {
    ticks.push({
      label: `${tr(ID_MONTHS[cur.getMonth()])} ${String(cur.getFullYear()).slice(2)}`,
      pos: ((cur.getTime() - min) / span) * 100,
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        {/* month axis */}
        <div className="relative mb-2 ml-[42%] h-5 border-b border-border">
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute top-0 -translate-x-1/2 text-[10px] font-medium text-muted-foreground"
              style={{ left: `${t.pos}%` }}
            >
              {t.label}
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          {dated.map(({ task, start, end }) => {
            const div = divMap.get(task.division);
            const left = ((start - min) / span) * 100;
            const width = Math.max(2, ((end - start) / span) * 100);
            const color = div?.color ?? "var(--primary)";
            return (
              <div key={task.id} className="flex items-center gap-2">
                <div className="w-[40%] shrink-0">
                  <TaskDetailDialog task={task} division={div} event={evMap.get(task.event_id)} user={user}>
                    <button className="flex items-center gap-1.5 text-left">
                      <StatusDot status={task.status} />
                      <span className="line-clamp-1 text-xs font-medium hover:text-primary">
                        {task.title}
                      </span>
                    </button>
                  </TaskDetailDialog>
                </div>
                <div className="relative h-6 flex-1">
                  {ticks.map((t, i) => (
                    <div
                      key={i}
                      className="absolute inset-y-0 w-px bg-border/60"
                      style={{ left: `${t.pos}%` }}
                    />
                  ))}
                  <TaskDetailDialog task={task} division={div} event={evMap.get(task.event_id)} user={user}>
                    <button
                      className="absolute top-1/2 flex h-4 -translate-y-1/2 items-center overflow-hidden rounded-full text-[10px] font-medium text-white transition hover:brightness-110"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: color,
                        opacity: task.status === "done" ? 1 : 0.75,
                      }}
                      title={`${task.title} - ${formatDate(task.start_date) ?? ""} s/d ${formatDate(task.end_date) ?? ""}`}
                    />
                  </TaskDetailDialog>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {tr("Tanpa tanggal")} ({undated.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {undated.slice(0, 40).map((t) => {
              const div = divMap.get(t.division);
              return (
                <TaskDetailDialog key={t.id} task={t} division={div} event={evMap.get(t.event_id)} user={user}>
                  <button className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-xs transition hover:border-primary/40">
                    <StatusDot status={t.status} />
                    <span className="truncate">{t.title}</span>
                  </button>
                </TaskDetailDialog>
              );
            })}
          </div>
        </div>
      )}

      {/* legend */}
      <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${m.dot}`} /> {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
