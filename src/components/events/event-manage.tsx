"use client";
import * as React from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EventFormDialog } from "./event-form-dialog";
import { Button } from "@/components/ui/button";
import { DialogTrigger, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteEventAction } from "@/lib/actions/manage";
import { useT } from "@/lib/i18n/provider";
import type { OVEvent } from "@/lib/types";

export function AddEventButton() {
  const t = useT();
  return (
    <EventFormDialog
      mode="create"
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

export function EventActions({ event }: { event: OVEvent }) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> {t("Edit")}</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDelOpen(true)}><Trash2 /> {t("Hapus")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EventFormDialog mode="edit" event={event} open={editOpen} onOpenChange={setEditOpen} />

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
