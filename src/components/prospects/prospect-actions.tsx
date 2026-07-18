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
import { ProspectFormDialog } from "./prospect-form-dialog";
import { deleteProspectAction } from "@/lib/actions/prospects";
import { useT } from "@/lib/i18n/provider";
import type { Prospect } from "@/lib/types";

export function ProspectActions({ prospect, batches, eventId }: { prospect: Prospect; batches: string[]; eventId: string }) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

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
          <DropdownMenuItem destructive onSelect={() => setDelOpen(true)}>
            <Trash2 /> {t("Hapus")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProspectFormDialog mode="edit" prospect={prospect} batches={batches} eventId={eventId} open={editOpen} onOpenChange={setEditOpen} />

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
