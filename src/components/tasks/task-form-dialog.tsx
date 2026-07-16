"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_META, STATUS_ORDER } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { createTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import type { AppUser, Division, DivisionKey, OVEvent, Task, TaskStatus } from "@/lib/types";

export function TaskFormDialog({
  mode,
  task,
  divisions,
  events,
  activeEventId,
  defaultDivision,
  user,
  open,
  onOpenChange,
  trigger,
}: {
  mode: "create" | "edit";
  task?: Task;
  divisions: Division[];
  events: OVEvent[];
  activeEventId: string;
  defaultDivision?: DivisionKey;
  user: AppUser;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [pending, start] = React.useTransition();

  const progressOnly = mode === "edit" && task ? !can.editTask(user, task) : false;

  const [form, setForm] = React.useState(() => ({
    event_id: task?.event_id ?? activeEventId,
    division: (task?.division ?? defaultDivision ?? "EVENT") as DivisionKey,
    no: task?.no ?? "",
    pic: task?.pic ?? "",
    title: task?.title ?? "",
    start_date: task?.start_date ?? "",
    end_date: task?.end_date ?? "",
    notes: task?.notes ?? "",
    result: task?.result ?? "",
    status: (task?.status ?? "todo") as TaskStatus,
  }));

  React.useEffect(() => {
    if (isOpen && task) {
      setForm({
        event_id: task.event_id,
        division: task.division,
        no: task.no,
        pic: task.pic,
        title: task.title,
        start_date: task.start_date ?? "",
        end_date: task.end_date ?? "",
        notes: task.notes,
        result: task.result,
        status: task.status,
      });
    }
  }, [isOpen, task]);

  function submit() {
    start(async () => {
      const payload = {
        ...form,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      const res =
        mode === "create"
          ? await createTaskAction(payload)
          : await updateTaskAction(task!.id, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Tugas ditambahkan" : "Tugas diperbarui");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Tugas" : "Edit Tugas"}</DialogTitle>
          <DialogDescription>
            {progressOnly
              ? "Kamu dapat memperbarui Status & Hasil tugas ini."
              : "Lengkapi detail tugas pada Work Breakdown Structure."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 py-1">
          {!progressOnly && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="title">Judul tugas / Job Description</Label>
                <Textarea
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Pembuatan Rundown Ormawa Visit"
                  className="min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Divisi</Label>
                  <Select
                    value={form.division}
                    onValueChange={(v) => setForm({ ...form, division: v as DivisionKey })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((d) => (
                        <SelectItem key={d.key} value={d.key}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Edisi OV</Label>
                  <Select
                    value={form.event_id}
                    onValueChange={(v) => setForm({ ...form, event_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="pic">PIC / Penanggung Jawab</Label>
                  <Input
                    id="pic"
                    value={form.pic}
                    onChange={(e) => setForm({ ...form, pic: e.target.value })}
                    placeholder="Nama, bisa lebih dari satu"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="no">Nomor</Label>
                  <Input
                    id="no"
                    value={form.no}
                    onChange={(e) => setForm({ ...form, no: e.target.value })}
                    placeholder="Opsional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="start">Mulai</Label>
                  <Input
                    id="start"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="end">Deadline</Label>
                  <Input
                    id="end"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="notes">Important Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Catatan penting, konteks, atau evaluasi dari OV sebelumnya"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="result">Result / Hasil</Label>
            <Textarea
              id="result"
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
              placeholder="Link dokumen hasil, atau keterangan penyelesaian"
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Batal</Button>
          </DialogClose>
          <Button onClick={submit} disabled={pending || !form.title.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Tambah Tugas" : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
