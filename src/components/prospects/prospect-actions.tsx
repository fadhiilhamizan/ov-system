"use client";
import * as React from "react";
import { MoreHorizontal, Pencil, Trash2, Star, StarOff } from "lucide-react";
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
import type { Member, Prospect, ProspectLink } from "@/lib/types";
import type { LocalFirst } from "@/lib/use-local-first";

export function ProspectActions({
  prospect, prospectLinks, members, eventId, store,
}: {
  prospect: Prospect;
  prospectLinks: ProspectLink[];
  members: Member[];
  eventId: string;
  /** The page's local-first list: the star and the delete show at once. */
  store: LocalFirst<Prospect>;
}) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);

  function togglePrimary() {
    if (prospect.is_primary) {
      store.patch(prospect.id, { is_primary: false }, () => unsetPrimaryProspectAction(prospect.id), {
        success: t("Data utama dilepas"),
      });
      return;
    }
    // At most one per edition: this one on, every other one off, one write.
    store.change(
      store.rows.map((p) => ({ id: p.id, fields: { is_primary: p.id === prospect.id } })),
      () => setPrimaryProspectAction(prospect.id),
      { success: t("Dijadikan data utama Ormawa Visit") },
    );
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

      <ProspectFormDialog mode="edit" prospect={prospect} prospectLinks={prospectLinks} members={members} eventId={eventId} open={editOpen} onOpenChange={setEditOpen} />

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
              onClick={() => {
                setDelOpen(false);
                store.remove([prospect.id], () => deleteProspectAction(prospect.id), { success: t("Prospek dihapus") });
              }}
            >
              {t("Hapus")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
