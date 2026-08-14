"use client";
import * as React from "react";
import { Search, Plus, Table2, Columns3, GanttChartSquare, X, CircleDot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { TaskTable } from "./task-table";
import { TaskKanban } from "./task-kanban";
import { TaskTimeline } from "./task-timeline";
import { TaskFormDialog } from "./task-form-dialog";
import { STATUS_META, STATUS_ORDER } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { DivisionFilter } from "@/components/layout/division-filter";
import { PicFilter } from "./pic-filter";
import {
  divisionKeySet, hasOrphanTasks, matchesDivision, matchesPics, parseDivisionFocus,
  picOptions, taskPicList,
} from "@/lib/task-filters";
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
  // Empty = no filter. Several statuses at once is the point: "what is still
  // todo OR overtime" is one question, and it used to take two passes.
  const [status, setStatus] = React.useState<Set<string>>(new Set());
  const t = useT();

  // Division focus. Seeded ONCE from the cookie the server read, then owned
  // here: `setActiveDivision` is a server action, so waiting for the cookie to
  // come back before applying the next tick loses selections (see
  // DivisionFilter). The cookie is persistence for the next page load, not the
  // live value.
  const [divisionFocus, setDivisionFocus] = React.useState<Set<string>>(
    () => parseDivisionFocus(initialDivision),
  );
  const division = React.useMemo(
    () => (lockedDivision ? new Set([lockedDivision]) : divisionFocus),
    [lockedDivision, divisionFocus],
  );

  const [pics, setPics] = React.useState<Set<string>>(new Set());

  const divisionKeys = React.useMemo(() => divisionKeySet(divisions), [divisions]);
  // The PIC menu is built from what the DIVISION focus leaves, not from the
  // fully filtered list - otherwise ticking a PIC would remove everyone else
  // from the menu and you could never add a second one.
  const inDivision = React.useMemo(
    () => tasks.filter((t) => matchesDivision(t, division, divisionKeys)),
    [tasks, division, divisionKeys],
  );
  const picChoices = React.useMemo(() => picOptions(inDivision), [inDivision]);
  const someUnassigned = React.useMemo(
    () => inDivision.some((t) => taskPicList(t.pic).length === 0),
    [inDivision],
  );

  const filtered = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    return inDivision.filter((t) => {
      if (!matchesPics(t, pics)) return false;
      if (status.size > 0 && !status.has(t.status)) return false;
      if (
        query &&
        !`${t.title} ${t.pic} ${t.notes} ${t.result}`.toLowerCase().includes(query)
      )
        return false;
      return true;
    });
  }, [inDivision, q, status, pics]);

  const counts = React.useMemo(() => {
    const by: Record<TaskStatus, number> = { todo: 0, ongoing: 0, done: 0, overtime: 0 };
    for (const t of filtered) by[t.status]++;
    return by;
  }, [filtered]);

  // Counts in the status menu come from the division/PIC-filtered list, NOT the
  // fully filtered one: ticking "Selesai" must not zero out every other row's
  // number, or you can never see what else there is to tick.
  const statusCounts = React.useMemo(() => {
    const by: Record<string, number> = { todo: 0, ongoing: 0, done: 0, overtime: 0 };
    for (const t of inDivision) if (matchesPics(t, pics)) by[t.status]++;
    return by;
  }, [inDivision, pics]);

  const hasFilters = q || status.size > 0 || pics.size > 0;

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
              in the topbar - it only ever affected the Work Breakdown. Hidden
              on a per-division board, where the division is already fixed. */}
          {!lockedDivision && (
            <DivisionFilter
              divisions={divisions}
              active={divisionFocus}
              onChange={setDivisionFocus}
              showNoDivision={hasOrphanTasks(tasks, divisionKeys)}
            />
          )}
          <PicFilter
            options={picChoices}
            picked={pics}
            onChange={setPics}
            hasUnassigned={someUnassigned}
          />
          <FilterMultiSelect
            label={t("Status")}
            allLabel={t("Semua Status")}
            unit={t("status")}
            icon={<CircleDot className="size-3.5" />}
            options={STATUS_ORDER.map((s) => ({
              value: s,
              label: STATUS_META[s].label,
              count: statusCounts[s] ?? 0,
            }))}
            picked={status}
            onChange={setStatus}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setStatus(new Set());
                setPics(new Set());
              }}
              // Note: Reset deliberately leaves the division focus alone. It is
              // persisted across pages, so clearing it from here would surprise
              // someone who set it on purpose.
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
          {can.manageTasks(user) && (
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
