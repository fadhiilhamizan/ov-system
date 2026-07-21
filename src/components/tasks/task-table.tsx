"use client";
import * as React from "react";
import { ListChecks, ChevronDown, ExternalLink, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DivisionBadge } from "@/components/division-badge";
import { StatusMenu } from "./status-menu";
import { TaskActions } from "./task-actions";
import { TaskDetailDialog } from "./task-detail-dialog";
import { EmptyState } from "@/components/ui/empty";
import { SortIndicator } from "@/components/ui/sort-indicator";
import { useMultiSort, sortRows } from "@/lib/use-multi-sort";
import { formatDate, daysUntil, isUrl } from "@/lib/format";
import { bulkSetStatusAction, bulkDeleteTasksAction } from "@/lib/actions/tasks";
import { STATUS_ORDER, STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { AppUser, Division, OVEvent, Task, TaskStatus } from "@/lib/types";

type SortKey = "no" | "title" | "division" | "pic" | "deadline" | "status";

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
  const tr = useT();
  const divMap = new Map(divisions.map((d) => [d.key, d]));
  const evMap = new Map(events.map((e) => [e.id, e]));
  const sort = useMultiSort<SortKey>();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, start] = React.useTransition();

  const canSelect = user.role !== "guest";
  const canBulkDelete = user.role === "admin" || user.role === "coordinator";

  // Reset selection whenever the task set changes (filter/revalidate).
  React.useEffect(() => setSelected(new Set()), [tasks]);

  const rows = React.useMemo(() => {
    const val = (t: Task, key: SortKey): string | number => {
      switch (key) {
        case "no": { const n = parseInt(t.no, 10); return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n; }
        case "title": return t.title.toLowerCase();
        case "division": return divMap.get(t.division)?.order ?? 99;
        case "pic": return (t.pic || "").toLowerCase();
        case "deadline": return t.end_date ? new Date(t.end_date).getTime() : Number.MAX_SAFE_INTEGER;
        case "status": return STATUS_ORDER.indexOf(t.status);
      }
    };
    return sortRows(tasks, sort.rules, val);
  }, [tasks, sort.rules, divMap]);

  if (!tasks.length) {
    return (
      <EmptyState icon={<ListChecks />} title={tr("Tidak ada tugas")} description={tr("Belum ada tugas yang cocok dengan filter saat ini.")} />
    );
  }

  const allChecked = selected.size > 0 && selected.size === rows.length;
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rows.map((t) => t.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function bulkStatus(status: TaskStatus) {
    const ids = [...selected];
    start(async () => {
      const res = await bulkSetStatusAction(ids, status);
      if (res.ok) {
        toast.success(`${res.count} ${tr("tugas")} -> ${STATUS_META[status].label}`);
        if (res.skipped > 0) toast.warning(`${res.skipped} ${tr("tugas dilewati (tanpa akses)")}`);
      } else toast.error(res.error);
    });
  }
  function bulkDelete() {
    const ids = [...selected];
    start(async () => {
      const res = await bulkDeleteTasksAction(ids);
      if (res.ok) {
        toast.success(`${res.count} ${tr("tugas dihapus")}`);
        if (res.skipped > 0) toast.warning(`${res.skipped} ${tr("tugas dilewati (tanpa akses)")}`);
      } else toast.error(res.error);
    });
  }

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button onClick={() => sort.toggle(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        <SortIndicator dir={sort.dirOf(k)} rank={sort.rankOf(k)} showRank={sort.rules.length > 1} />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-2">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent/50 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} {tr("terpilih")}</span>
          <span className="mx-1 h-4 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} {tr("Ubah status")}
                <ChevronDown className="size-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {STATUS_ORDER.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => bulkStatus(s)} className="gap-2">
                  <span className={cn("size-2 rounded-full", STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {canBulkDelete && (
            <button
              onClick={bulkDelete}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-danger transition hover:bg-red-50 disabled:opacity-60 dark:hover:bg-red-500/10"
            >
              <Trash2 className="size-3.5" /> {tr("Hapus")}
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" /> {tr("Batal")}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {canSelect && (
                <TableHead className="w-9">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label={tr("Pilih semua")} />
                </TableHead>
              )}
              <SortHead k="no" className="w-10">#</SortHead>
              <SortHead k="title" className="min-w-[220px]">{tr("Tugas")}</SortHead>
              <SortHead k="division">{tr("Divisi")}</SortHead>
              <SortHead k="pic" className="min-w-[110px]">{tr("PIC")}</SortHead>
              <SortHead k="deadline">{tr("Deadline")}</SortHead>
              <SortHead k="status">{tr("Status")}</SortHead>
              <TableHead className="min-w-[180px]">{tr("Hasil")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const div = divMap.get(t.division);
              const d = daysUntil(t.end_date);
              const overdue = d !== null && d < 0 && t.status !== "done";
              const checked = selected.has(t.id);
              return (
                <TableRow key={t.id} className={cn(checked && "bg-accent/40")}>
                  {canSelect && (
                    <TableCell>
                      <Checkbox checked={checked} onCheckedChange={() => toggleOne(t.id)} aria-label={tr("Pilih tugas")} />
                    </TableCell>
                  )}
                  <TableCell className="text-xs text-muted-foreground">{t.no || "-"}</TableCell>
                  <TableCell>
                    <TaskDetailDialog task={t} division={div} event={evMap.get(t.event_id)} user={user}>
                      <button className="group flex flex-col text-left">
                        <span className="line-clamp-2 text-sm font-medium group-hover:text-primary">{t.title}</span>
                        {t.notes && <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.notes}</span>}
                      </button>
                    </TaskDetailDialog>
                  </TableCell>
                  <TableCell>{div && <DivisionBadge division={div} />}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">{t.pic || "-"}</TableCell>
                  <TableCell>
                    <span className={cn("text-sm", overdue ? "font-medium text-danger" : "text-muted-foreground")}>
                      {formatDate(t.end_date) ?? t.end_raw ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell><StatusMenu task={t} user={user} /></TableCell>
                  <TableCell><ResultCell task={t} /></TableCell>
                  <TableCell>
                    <TaskActions task={t} divisions={divisions} events={events} activeEventId={activeEventId} user={user} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Inline result editor - lets assignees drop a link/result without opening Edit. */
/** Read-only result preview. Editing happens in the task dialog only, so a
 *  stray click in the table can't overwrite someone's submitted result. */
function ResultCell({ task }: { task: Task }) {
  const tr = useT();
  if (!task.result) return <span className="text-xs text-muted-foreground">-</span>;
  return isUrl(task.result) ? (
    <a
      href={task.result}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <ExternalLink className="size-3" /> {tr("Lihat hasil")}
    </a>
  ) : (
    <span className="line-clamp-1 text-xs text-muted-foreground">{task.result}</span>
  );
}
