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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createDivisionAction, updateDivisionAction, deleteDivisionAction } from "@/lib/actions/manage";
import { cn } from "@/lib/utils";
import type { Division } from "@/lib/types";

// Ordered by hue (warm -> cool -> violet/pink), neutral gray last.
const PRESET = [
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#14b8a6", // teal
  "#0ea5e9", // sky
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
  "#64748b", // slate (neutral)
];

/** Lighten a hex color by mixing it toward white. */
function lighten(hex: string, amount = 0.55): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return "#" + [mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
const PRESET_LIGHT = PRESET.map((c) => lighten(c));

function DivisionFormDialog({
  mode, division, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  division?: Division;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState(() => ({
    key: division?.key ?? "",
    name: division?.name ?? "",
    short: division?.short ?? "",
    color: division?.color ?? PRESET[0],
  }));
  React.useEffect(() => {
    if (isOpen && division) setF({ key: division.key, name: division.name, short: division.short, color: division.color });
  }, [isOpen, division]);

  function submit() {
    start(async () => {
      const payload = {
        name: f.name,
        short: f.short || f.name.slice(0, 3).toUpperCase(),
        color: f.color,
        ...(mode === "create" ? { key: f.key || undefined } : {}),
      };
      const res = mode === "create" ? await createDivisionAction(payload) : await updateDivisionAction(division!.key, payload);
      if (res.ok) { toast.success(mode === "create" ? "Divisi ditambahkan" : "Divisi diperbarui"); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Divisi" : "Edit Divisi"}</DialogTitle>
          <DialogDescription>Divisi bisa berbeda tiap Ormawa Visit.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Nama divisi</Label>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Liaison Officer" />
            </div>
            <div className="grid gap-1.5">
              <Label>Singkatan</Label>
              <Input value={f.short} onChange={(e) => setF({ ...f, short: e.target.value })} placeholder="LO" maxLength={6} />
            </div>
          </div>
          {mode === "create" && (
            <div className="grid gap-1.5">
              <Label>Kode unik (opsional)</Label>
              <Input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value.toUpperCase() })} placeholder="LO" />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Warna</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setF({ ...f, color: c })}
                  className={cn("size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition", f.color === c ? "ring-foreground" : "ring-transparent")}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="size-7 cursor-pointer rounded" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Versi lebih muda</p>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_LIGHT.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setF({ ...f, color: c })}
                  className={cn("size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition", f.color === c ? "ring-foreground" : "ring-transparent")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.name.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}{mode === "create" ? "Tambah" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddDivisionButton() {
  return (
    <DivisionFormDialog mode="create" trigger={
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Tambah Divisi</Button>
      </DialogTrigger>
    } />
  );
}

export function DivisionActions({ division }: { division: Division }) {
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
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> Edit</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => start(async () => {
            const res = await deleteDivisionAction(division.key);
            if (res.ok) toast.success("Divisi dihapus"); else toast.error(res.error);
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />} Hapus</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DivisionFormDialog mode="edit" division={division} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
