"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ColorPicker, COLOR_PRESET } from "@/components/ui/color-picker";
import { createDivisionAction, updateDivisionAction, deleteDivisionAction } from "@/lib/actions/manage";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";
import type { Division } from "@/lib/types";

function DivisionFormDialog({
  mode, division, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  division?: Division;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const t = useT();
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();
  const [f, setF] = useResetOn(`${isOpen}:${division?.key ?? "new"}`, () => ({
    name: division?.name ?? "",
    short: division?.short ?? "",
    color: division?.color ?? COLOR_PRESET[0],
    exclude_from_rundown: division?.exclude_from_rundown ?? false,
  }));

  function submit() {
    start(async () => {
      const payload = {
        name: f.name,
        short: (f.short || f.name.slice(0, 4)).toUpperCase(),
        color: f.color,
        exclude_from_rundown: f.exclude_from_rundown,
      };
      const res = mode === "create" ? await createDivisionAction(payload) : await updateDivisionAction(division!.key, payload);
      if (res.ok) { toast.success(mode === "create" ? t("Divisi ditambahkan") : t("Divisi diperbarui")); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Tambah Divisi") : t("Edit Divisi")}</DialogTitle>
          <DialogDescription>{t("Divisi bisa berbeda tiap Ormawa Visit.")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("Nama divisi")}</Label>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Liaison Officer" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Singkatan")} <span className="text-[10px] text-muted-foreground">({t("maks. 4 huruf")})</span></Label>
              <Input
                value={f.short}
                onChange={(e) => setF({ ...f, short: e.target.value.toUpperCase().slice(0, 4) })}
                placeholder="LO"
                maxLength={4}
              />
            </div>
          </div>
          {/* No "unique code" field: the key is an internal identifier the repo
              generates itself, and nothing in the UI ever shows it. */}
          <div className="grid gap-1.5">
            <Label>{t("Warna")}</Label>
            <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-3 text-sm">
            <Checkbox
              checked={f.exclude_from_rundown}
              onCheckedChange={(v) => setF({ ...f, exclude_from_rundown: v === true })}
            />
            <span>{t("Divisi tidak diikutsertakan pada rundown")}</span>
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.name.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}{mode === "create" ? t("Tambah") : t("Simpan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddDivisionButton() {
  const t = useT();
  return (
    <DivisionFormDialog mode="create" trigger={
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> {t("Tambah Divisi")}</Button>
      </DialogTrigger>
    } />
  );
}

export function DivisionActions({ division }: { division: Division }) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.stopPropagation()}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> {t("Edit")}</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => start(async () => {
            const res = await deleteDivisionAction(division.key);
            if (res.ok) toast.success(t("Divisi dihapus")); else toast.error(res.error);
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />} {t("Hapus")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DivisionFormDialog mode="edit" division={division} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
