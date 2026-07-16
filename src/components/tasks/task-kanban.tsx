"use client";
import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { STATUS_META, STATUS_ORDER } from "@/lib/constants";
import { DivisionBadge } from "@/components/division-badge";
import { TaskActions } from "./task-actions";
import { TaskDetailDialog } from "./task-detail-dialog";
import { setTaskStatusAction } from "@/lib/actions/tasks";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppUser, Division, OVEvent, Task, TaskStatus } from "@/lib/types";

export function TaskKanban({
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
  const [items, setItems] = React.useState(tasks);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  React.useEffect(() => setItems(tasks), [tasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const divMap = new Map(divisions.map((d) => [d.key, d]));
  const evMap = new Map(events.map((e) => [e.id, e]));
  const activeTask = items.find((t) => t.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId?.startsWith("col-")) return;
    const newStatus = overId.replace("col-", "") as TaskStatus;
    const task = items.find((t) => t.id === id);
    if (!task || task.status === newStatus) return;
    if (!can.editTaskProgress(user, task)) {
      toast.error("Kamu tidak punya akses mengubah status tugas ini.");
      return;
    }
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    setTaskStatusAction(id, newStatus).then((res) => {
      if (res.ok) toast.success(`Status → ${STATUS_META[newStatus].label}`);
      else {
        toast.error(res.error);
        setItems(tasks);
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const colTasks = items.filter((t) => t.status === status);
          return (
            <Column key={status} status={status} count={colTasks.length}>
              {colTasks.map((t) => (
                <KanbanCard
                  key={t.id}
                  task={t}
                  division={divMap.get(t.division)}
                  event={evMap.get(t.event_id)}
                  divisions={divisions}
                  events={events}
                  activeEventId={activeEventId}
                  user={user}
                  draggable={can.editTaskProgress(user, t)}
                />
              ))}
            </Column>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2 cursor-grabbing rounded-xl border border-primary/40 bg-card p-3 shadow-2xl">
            <p className="line-clamp-3 text-sm font-medium">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  count,
  children,
}: {
  status: TaskStatus;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  const m = STATUS_META[status];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border border-border bg-muted/30 transition-colors",
        isOver && "border-primary/50 bg-accent/40",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={cn("size-2 rounded-full", m.dot)} />
        <span className="text-sm font-semibold">{m.label}</span>
        <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="flex min-h-24 flex-col gap-2 p-2 pt-0">{children}</div>
    </div>
  );
}

function KanbanCard({
  task,
  division,
  event,
  divisions,
  events,
  activeEventId,
  user,
  draggable,
}: {
  task: Task;
  division?: Division;
  event?: OVEvent;
  divisions: Division[];
  events: OVEvent[];
  activeEventId: string;
  user: AppUser;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group rounded-xl border border-border bg-card p-3 shadow-sm transition",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        {draggable && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
            aria-label="Geser"
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <TaskDetailDialog task={task} division={division} event={event} user={user}>
          <button className="min-w-0 flex-1 text-left">
            <p className="line-clamp-3 text-sm font-medium group-hover:text-primary">{task.title}</p>
          </button>
        </TaskDetailDialog>
        <TaskActions
          task={task}
          divisions={divisions}
          events={events}
          activeEventId={activeEventId}
          user={user}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
        {division && <DivisionBadge division={division} />}
        {task.end_date && (
          <span className="text-[11px] text-muted-foreground">{formatDate(task.end_date)}</span>
        )}
      </div>
      {task.pic && <p className="mt-1 truncate pl-6 text-[11px] text-muted-foreground">{task.pic}</p>}
    </div>
  );
}
