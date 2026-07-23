"use client";
import * as React from "react";
import { MoreHorizontal, Pencil, Trash2, Loader2, Star, StarOff } from "lucide-react";
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
import { ProspectFormDialog } from "./prospect-form-dialog";
import {
  deleteProspectAction, setPrimaryProspectAction, unsetPrimaryProspectAction,
} from "@/lib/actions/prospects";
import { useT } from "@/lib/i18n/provider";
import type { Member, Prospect } from "@/lib/types";

export function ProspectActions({
  prospect, batches, members, eventId,
}: { prospect: Prospect; batches: string[]; members: Member[]; eventId: string }) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  function togglePrimary() {
    start(async () => {
      const res = prospect.is_primary
        ? await unsetPrimaryProspectAction(prospect.id)
        : await setPrimaryProspectAction(prospect.id);
      if (res.ok) {
        toast.success(prospect.is_primary ? t("Data utama dilepas") : t("Dijadikan data utama Ormawa Visit"));
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
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> {t("Edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={togglePrimary}>
            {prospect.is_primary ? <><StarOff /> {t("Lepas data utama")}</> : <><Star /> {t("Jadikan data utama")}</>}
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDelOpen(true)}>
            <Trash2 /> {t("Hapus")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProspectFormDialog mode="edit" prospect={prospect} batches={batches} members={members} eventId={eventId} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Hapus prospek?")}</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{prospect.org_name || prospect.contact}</span> {t("akan dihapus permanen.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("Batal")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteProspectAction(prospect.id);
                  if (res.ok) {
                    toast.success(t("Prospek dihapus"));
                    setDelOpen(false);
                  } else toast.error(res.error);
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {t("Hapus")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
