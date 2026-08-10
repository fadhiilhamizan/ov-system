"use client";
import * as React from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, Copy, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { EventFormDialog } from "./event-form-dialog";
import { Button } from "@/components/ui/button";
import { DialogTrigger, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteEventAction, duplicateEventAction, setEventLockedAction } from "@/lib/actions/manage";
import { useT } from "@/lib/i18n/provider";
import type { OVEvent } from "@/lib/types";

export function AddEventButton({ events }: { events: OVEvent[] }) {
  const t = useT();
  return (
    <EventFormDialog
      mode="create"
      events={events}
      trigger={
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4" /> {t("Tambah Ormawa Visit")}
          </Button>
        </DialogTrigger>
      }
    />
  );
}

/**
 * Archive toggle. Admin-only (the caller decides whether to render it), because
 * an archived edition is read-only for every other role — see `writable_event()`
 * in migration 0028.
 */
export function EventActions({
  event, events = [], canLock,
}: {
  event: OVEvent;
  /** Other editions, so the edit dialog can offer them as copy sources. */
  events?: OVEvent[];
  canLock?: boolean;
}) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [lockOpen, setLockOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const locked = !!event.locked;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> {t("Edit")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => start(async () => {
            const res = await duplicateEventAction(event.id);
            if (res.ok) toast.success(t("Ormawa Visit diduplikat")); else toast.error(res.error);
          })}><Copy /> {t("Duplikat")}</DropdownMenuItem>
          {canLock && (
            locked ? (
              <DropdownMenuItem onSelect={() => start(async () => {
                const res = await setEventLockedAction(event.id, false);
                if (res.ok) toast.success(t("Arsip dibuka — semua peran bisa mengubah lagi."));
                else toast.error(res.error);
              })}><LockOpen /> {t("Buka kunci arsip")}</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setLockOpen(true)}><Lock /> {t("Kunci sebagai arsip")}</DropdownMenuItem>
            )
          )}
          <DropdownMenuItem destructive onSelect={() => setDelOpen(true)}><Trash2 /> {t("Hapus")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={lockOpen} onOpenChange={setLockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Kunci Ormawa Visit ini sebagai arsip?")}</DialogTitle>
            <DialogDescription>
              “{event.title}” {t("akan jadi hanya-baca. Koordinator, Staff, dan Intern tidak bisa lagi mengubah tugas, rundown, Hari-H, atau tautannya. Hanya admin yang bisa mengubah isinya dan membuka kuncinya kembali.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button disabled={pending} onClick={() => start(async () => {
              const res = await setEventLockedAction(event.id, true);
              if (res.ok) { toast.success(t("Ormawa Visit diarsipkan")); setLockOpen(false); }
              else toast.error(res.error);
            })}>{pending && <Loader2 className="size-4 animate-spin" />}{t("Kunci arsip")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventFormDialog mode="edit" event={event} events={events} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Hapus Ormawa Visit?")}</DialogTitle>
            <DialogDescription>
              “{event.title}” {t("beserta seluruh tugas, rundown, dan datanya akan dihapus permanen.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
              const res = await deleteEventAction(event.id);
              if (res.ok) { toast.success(t("Ormawa Visit dihapus")); setDelOpen(false); } else toast.error(res.error);
            })}>{pending && <Loader2 className="size-4 animate-spin" />}{t("Hapus")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
