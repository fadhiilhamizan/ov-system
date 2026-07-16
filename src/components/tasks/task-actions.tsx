"use client";
import * as React from "react";
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "./task-form-dialog";
import { can } from "@/lib/permissions";
import { deleteTaskAction } from "@/lib/actions/tasks";
import type { AppUser, Division, OVEvent, Task } from "@/lib/types";

export function TaskActions({
  task,
  divisions,
  events,
  activeEventId,
  user,
}: {
  task: Task;
  divisions: Division[];
  events: OVEvent[];
  activeEventId: string;
  user: AppUser;
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  const canEditAny = can.editTaskProgress(user, task);
  const canDelete = can.manageTasks(user, task.division);
  if (!canEditAny && !canDelete) return null;

  function doDelete() {
    start(async () => {
      const res = await deleteTaskAction(task.id);
      if (res.ok) {
        toast.success("Tugas dihapus");
        setDelOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEditAny && (
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil /> Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem destructive onSelect={() => setDelOpen(true)}>
              <Trash2 /> Hapus
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskFormDialog
        mode="edit"
        task={task}
        divisions={divisions}
        events={events}
        activeEventId={activeEventId}
        user={user}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus tugas?</DialogTitle>
            <DialogDescription>
              Tugas <span className="font-medium text-foreground">“{task.title}”</span> akan dihapus
              permanen. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button variant="destructive" onClick={doDelete} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
