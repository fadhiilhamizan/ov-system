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
import { BulkEditDialog } from "./bulk-edit-dialog";
import { useTaskLinks } from "./task-links-context";
import { EmptyState } from "@/components/ui/empty";
import { SortHead } from "@/components/ui/sort-indicator";
import { useMultiSort, sortRows } from "@/lib/use-multi-sort";
import { visibleSelection } from "@/lib/use-multi-select";
import { formatDate, daysUntil, isUrl } from "@/lib/format";
import { bulkSetStatusAction, bulkDeleteTasksAction } from "@/lib/actions/tasks";
import { STATUS_ORDER, STATUS_META } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { AppUser, Division, OVEvent, Task, TaskStatus } from "@/lib/types";

type SortKey = "title" | "division" | "pic" | "deadline" | "status";

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
  const divMap = React.useMemo(() => new Map(divisions.map((d) => [d.key, d])), [divisions]);
  const evMap = React.useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const sort = useMultiSort<SortKey>();
  // `tasks` is the ALREADY-FILTERED list, so this used to reset on every
  // keystroke in the search box - select a few rows, search for the next few,
  // and the first lot was gone. The selection now simply intersects with what
  // is on screen (see use-multi-select).
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, start] = React.useTransition();

  const canSelect = user.role !== "guest";
  const canBulkDelete = can.deleteTask(user);
  // Changing Divisi/PIC/Deadline is a real edit, not a progress update, so it
  // needs the same permission as opening a task's form.
  const canBulkEdit = can.editTask(user);


  const rows = React.useMemo(() => {
    const val = (t: Task, key: SortKey): string | number => {
      switch (key) {
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

  // Only ticks that are currently on screen count. Ones hidden by the search or
  // a division/PIC filter stay in state untouched and come back when the filter
  // is cleared - that is what makes "select some, search, select more" work.
  const visibleIds = rows.map((t) => t.id);
  const selectedInView = visibleSelection(selected, visibleIds);
  const allChecked = rows.length > 0 && selectedInView.length === rows.length;
  /** Select-all adds/removes only the visible rows, leaving hidden ticks alone. */
  function toggleAll() {
    setSelected((prev) => {
      const n = new Set(prev);
      for (const id of visibleIds) { if (allChecked) n.delete(id); else n.add(id); }
      return n;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function bulkStatus(status: TaskStatus) {
    const ids = selectedInView;
    start(async () => {
      const res = await bulkSetStatusAction(ids, status);
      if (res.ok) {
        toast.success(`${res.count} ${tr("tugas")} -> ${STATUS_META[status].label}`);
        if (res.skipped > 0) toast.warning(`${res.skipped} ${tr("tugas dilewati (tanpa akses)")}`);
      } else toast.error(res.error);
    });
  }
  function bulkDelete() {
    const ids = selectedInView;
    start(async () => {
      const res = await bulkDeleteTasksAction(ids);
      if (res.ok) {
        toast.success(`${res.count} ${tr("tugas dihapus")}`);
        if (res.skipped > 0) toast.warning(`${res.skipped} ${tr("tugas dilewati (tanpa akses)")}`);
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-2">
      {/* Bulk action bar */}
      {selectedInView.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent/50 px-3 py-2">
          <span className="text-sm font-medium">{selectedInView.length} {tr("terpilih")}</span>
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
          {canBulkEdit && (
            <BulkEditDialog
              ids={selectedInView}
              divisions={divisions}
              onDone={() => setSelected(new Set())}
            />
          )}
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
              {/* A plain row counter, NOT the stored `no`. That column is
                  numbered per division, so with "Semua Divisi" the table read
                  1,2,3,1,2,1,2,3… Counting the rows instead means it always
                  runs 1..N of whatever is on screen, and there is nothing
                  meaningful to sort by. */}
              <TableHead className="w-10">#</TableHead>
              <SortHead sort={sort} k="title" className="min-w-[220px]">{tr("Tugas")}</SortHead>
              <SortHead sort={sort} k="division">{tr("Divisi")}</SortHead>
              <SortHead sort={sort} k="pic" className="min-w-[110px]">{tr("PIC")}</SortHead>
              <SortHead sort={sort} k="deadline">{tr("Deadline")}</SortHead>
              <SortHead sort={sort} k="status">{tr("Status")}</SortHead>
              <TableHead className="min-w-[180px]">{tr("Hasil")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t, rowIndex) => {
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
                  <TableCell className="text-xs tabular-nums text-muted-foreground">{rowIndex + 1}</TableCell>
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
/** Read-only result preview: description + attached links. Editing happens in
 *  the task dialog only, so a stray click can't overwrite a submitted result. */
function ResultCell({ task }: { task: Task }) {
  const tr = useT();
  const links = useTaskLinks(task.id);
  // Legacy rows stored a bare URL in `result` before links became structured.
  const legacyUrl = !links.length && isUrl(task.result) ? task.result : null;

  if (!task.result && !links.length) return <span className="text-xs text-muted-foreground">-</span>;

  return (
    <div className="space-y-1">
      {task.result && !legacyUrl && (
        <span className="line-clamp-2 text-xs text-muted-foreground">{task.result}</span>
      )}
      {legacyUrl && (
        <a href={legacyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="size-3" /> {tr("Lihat hasil")}
        </a>
      )}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {links.map((l, i) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              title={l.url}
              className="inline-flex max-w-[140px] items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground transition hover:brightness-95"
            >
              <ExternalLink className="size-2.5 shrink-0" />
              <span className="truncate">{l.label?.trim() || `${tr("Tautan")} ${i + 1}`}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
