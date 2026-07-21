"use client";
import * as React from "react";
import { Search, Plus, Table2, Columns3, GanttChartSquare, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskTable } from "./task-table";
import { TaskKanban } from "./task-kanban";
import { TaskTimeline } from "./task-timeline";
import { TaskFormDialog } from "./task-form-dialog";
import { STATUS_META, STATUS_ORDER } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { DivisionFilter } from "@/components/layout/division-filter";
import type { AppUser, Division, DivisionKey, OVEvent, Task, TaskStatus } from "@/lib/types";

type View = "table" | "kanban" | "timeline";

const VIEWS: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: "table", label: "Tabel", icon: <Table2 className="size-4" /> },
  { key: "kanban", label: "Kanban", icon: <Columns3 className="size-4" /> },
  { key: "timeline", label: "Timeline", icon: <GanttChartSquare className="size-4" /> },
];

export function TasksView({
  tasks,
  divisions,
  events,
  activeEventId,
  user,
  lockedDivision,
  initialDivision = "all",
}: {
  tasks: Task[];
  divisions: Division[];
  events: OVEvent[];
  activeEventId: string;
  user: AppUser;
  lockedDivision?: DivisionKey;
  initialDivision?: string;
}) {
  const [view, setView] = React.useState<View>("table");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");
  const t = useT();

  // Division follows the global "Fokus divisi" dropdown (or the locked division
  // on a per-division board). No separate dropdown here.
  const division = lockedDivision ?? initialDivision;

  const filtered = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    return tasks.filter((t) => {
      if (division !== "all" && t.division !== division) return false;
      if (status !== "all" && t.status !== status) return false;
      if (
        query &&
        !`${t.title} ${t.pic} ${t.notes} ${t.result}`.toLowerCase().includes(query)
      )
        return false;
      return true;
    });
  }, [tasks, q, division, status]);

  const counts = React.useMemo(() => {
    const by: Record<TaskStatus, number> = { todo: 0, ongoing: 0, done: 0, overtime: 0 };
    for (const t of filtered) by[t.status]++;
    return by;
  }, [filtered]);

  const hasFilters = q || status !== "all";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Cari tugas, PIC, catatan…")}
              className="pl-9"
            />
          </div>
          {/* Division focus lives here (next to the other filters) rather than
              in the topbar — it only ever affected the Work Breakdown. Hidden
              on a per-division board, where the division is already fixed. */}
          {!lockedDivision && <DivisionFilter divisions={divisions} active={division} />}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-auto min-w-[130px]">
              <SelectValue placeholder={t("Status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Semua Status")}</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setStatus("all");
              }}
            >
              <X className="size-4" /> {t("Reset")}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                  view === v.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v.icon}
                <span className="hidden sm:inline">{t(v.label)}</span>
              </button>
            ))}
          </div>
          {can.manageTasks(user, lockedDivision) && (
            <TaskFormDialog
              mode="create"
              divisions={divisions}
              events={events}
              activeEventId={activeEventId}
              defaultDivision={lockedDivision}
              user={user}
              trigger={
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4" /> <span className="hidden sm:inline">{t("Tambah")}</span>
                  </Button>
                </DialogTrigger>
              }
            />
          )}
        </div>
      </div>

      {/* Count chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {filtered.length} {t("tugas")}
        </span>
        {STATUS_ORDER.map((s) => (
          <span
            key={s}
            className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5", STATUS_META[s].bg, STATUS_META[s].color)}
          >
            <span className={cn("size-1.5 rounded-full", STATUS_META[s].dot)} />
            {STATUS_META[s].label} {counts[s]}
          </span>
        ))}
      </div>

      {view === "table" && (
        <TaskTable tasks={filtered} divisions={divisions} events={events} activeEventId={activeEventId} user={user} />
      )}
      {view === "kanban" && (
        <TaskKanban tasks={filtered} divisions={divisions} events={events} activeEventId={activeEventId} user={user} />
      )}
      {view === "timeline" && (
        <TaskTimeline tasks={filtered} divisions={divisions} events={events} user={user} />
      )}
    </div>
  );
}
