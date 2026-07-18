"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  createMemberAction, updateMemberAction, deleteMemberAction,
  createTeamAction, updateTeamAction, deleteTeamAction,
} from "@/lib/actions/manage";
import type { Division, Member, Team } from "@/lib/types";

// ---------------- Member ----------------
export function MemberFormDialog({
  mode, member, divisions, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  member?: Member;
  divisions: Division[];
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState(() => ({
    name: member?.name ?? "",
    nickname: member?.nickname ?? "",
    nrp: member?.nrp ?? "",
    type: member?.type ?? "fungsionaris",
    year: member?.year ?? new Date().getFullYear(),
    division: member?.division ?? "none",
  }));
  React.useEffect(() => {
    if (isOpen && member)
      setF({ name: member.name, nickname: member.nickname, nrp: member.nrp, type: member.type, year: member.year, division: member.division ?? "none" });
  }, [isOpen, member]);

  function submit() {
    start(async () => {
      const payload = { ...f, division: f.division === "none" ? null : f.division };
      const res = mode === "create" ? await createMemberAction(payload) : await updateMemberAction(member!.id, payload);
      if (res.ok) { toast.success(mode === "create" ? "Anggota ditambahkan" : "Anggota diperbarui"); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Anggota" : "Edit Anggota"}</DialogTitle>
          <DialogDescription>Anggota External Affairs (fungsionaris atau intern).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Nama lengkap</Label>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Nama panggilan</Label>
              <Input value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>NRP</Label>
              <Input value={f.nrp} onChange={(e) => setF({ ...f, nrp: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Angkatan (tahun)</Label>
              <Input type="number" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as Member["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fungsionaris">Fungsionaris</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Divisi (opsional)</Label>
              <Select value={f.division} onValueChange={(v) => setF({ ...f, division: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.key} value={d.key}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

export function MemberActions({ member, divisions }: { member: Member; divisions: Division[] }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> Edit</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => start(async () => {
            const res = await deleteMemberAction(member.id);
            if (res.ok) toast.success("Anggota dihapus"); else toast.error(res.error);
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />} Hapus</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MemberFormDialog mode="edit" member={member} divisions={divisions} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

// ---------------- Team ----------------
export function TeamFormDialog({
  mode, team, divisions, eventId, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  team?: Team;
  divisions: Division[];
  eventId: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState(() => ({
    division: team?.division ?? divisions[0]?.key ?? "EVENT",
    fungsionaris: team?.fungsionaris ?? "",
    intern: team?.intern ?? "",
  }));
  React.useEffect(() => {
    if (isOpen && team) setF({ division: team.division, fungsionaris: team.fungsionaris, intern: team.intern });
  }, [isOpen, team]);

  function submit() {
    start(async () => {
      const payload = { ...f, event_id: eventId };
      const res = mode === "create" ? await createTeamAction(payload) : await updateTeamAction(team!.id, payload);
      if (res.ok) { toast.success(mode === "create" ? "Tim ditambahkan" : "Tim diperbarui"); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Tim Divisi" : "Edit Tim Divisi"}</DialogTitle>
          <DialogDescription>Susunan anggota per divisi untuk Ormawa Visit ini.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Divisi</Label>
            <Select value={f.division} onValueChange={(v) => setF({ ...f, division: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {divisions.map((d) => (
                  <SelectItem key={d.key} value={d.key}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Fungsionaris (pisahkan dengan koma)</Label>
            <Input value={f.fungsionaris} onChange={(e) => setF({ ...f, fungsionaris: e.target.value })} placeholder="Nama1, Nama2" />
          </div>
          <div className="grid gap-1.5">
            <Label>Intern (pisahkan dengan koma)</Label>
            <Input value={f.intern} onChange={(e) => setF({ ...f, intern: e.target.value })} placeholder="Nama1, Nama2" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}{mode === "create" ? "Tambah" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeamActions({ team, divisions, eventId }: { team: Team; divisions: Division[]; eventId: string }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> Edit</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => start(async () => {
            const res = await deleteTeamAction(team.id);
            if (res.ok) toast.success("Tim dihapus"); else toast.error(res.error);
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />} Hapus</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TeamFormDialog mode="edit" team={team} divisions={divisions} eventId={eventId} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
