"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Pencil, Trash2, Check, ChevronsUpDown, X, LayoutGrid, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  createMemberAction, updateMemberAction, deleteMemberAction,
  bulkDeleteMembersAction, bulkUpdateMembersAction,
  createTeamAction, updateTeamAction, deleteTeamAction,
} from "@/lib/actions/manage";
import { useT } from "@/lib/i18n/provider";
import { angkatanFromNrp } from "@/lib/format";
import type { Division, Member, OVEvent, Team } from "@/lib/types";

// ---------------- Member ----------------
export function MemberFormDialog({
  mode, member, divisions, events, defaultEventId, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  member?: Member;
  divisions: Division[];
  events: OVEvent[];
  defaultEventId: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const t = useT();
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();
  const nameRef = React.useRef<HTMLInputElement>(null);
  const emptyForm = (base?: Partial<typeof f>) => ({
    name: "",
    nickname: "",
    nrp: "",
    type: (base?.type ?? "fungsionaris") as Member["type"],
    year: base?.year ?? new Date().getFullYear(),
    division: base?.division ?? divisions[0]?.key ?? "",
    event_id: base?.event_id ?? defaultEventId,
  });
  const [f, setF] = React.useState(() => ({
    name: member?.name ?? "",
    nickname: member?.nickname ?? "",
    nrp: member?.nrp ?? "",
    type: member?.type ?? "fungsionaris",
    year: member?.year ?? new Date().getFullYear(),
    division: member?.division ?? divisions[0]?.key ?? "",
    event_id: member?.event_id ?? defaultEventId,
  }));
  React.useEffect(() => {
    if (isOpen && member) {
      setF({
        name: member.name, nickname: member.nickname, nrp: member.nrp, type: member.type,
        year: member.year, division: member.division ?? divisions[0]?.key ?? "", event_id: member.event_id ?? defaultEventId,
      });
    }
  }, [isOpen, member, divisions, defaultEventId]);

  function submit() {
    start(async () => {
      const res = mode === "create" ? await createMemberAction(f) : await updateMemberAction(member!.id, f);
      if (!res.ok) { toast.error(res.error); return; }
      if (mode === "create") {
        // Bulk-entry friendly: keep type/division/event, clear only identity
        // fields, and keep the dialog open so the user can add the next person.
        toast.success(`${f.name} ${t("ditambahkan — lanjut menambahkan anggota lain")}`);
        setF((prev) => emptyForm(prev));
        nameRef.current?.focus();
      } else {
        toast.success(t("Anggota diperbarui"));
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Tambah Anggota") : t("Edit Anggota")}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? t("Dialog tetap terbuka setelah menambah, cocok untuk mengisi banyak anggota sekaligus.")
              : t("Anggota External Affairs (fungsionaris atau intern).")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Nama lengkap")} <span className="text-danger">*</span></Label>
              <Input ref={nameRef} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Nama panggilan")}</Label>
              <Input value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>NRP</Label>
              <Input
                value={f.nrp}
                onChange={(e) => {
                  const nrp = e.target.value;
                  const derived = angkatanFromNrp(nrp);
                  setF({ ...f, nrp, year: derived ?? f.year });
                }}
                placeholder="5026231128"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Angkatan (tahun)")}</Label>
              <Input
                type="number"
                value={f.year}
                onChange={(e) => setF({ ...f, year: Number(e.target.value) })}
                readOnly={angkatanFromNrp(f.nrp) !== null}
                className={angkatanFromNrp(f.nrp) !== null ? "bg-muted/50 text-muted-foreground" : undefined}
              />
              <p className="text-[11px] text-muted-foreground">
                {angkatanFromNrp(f.nrp) !== null ? t("Otomatis dari NRP") : t("Isi manual jika NRP kosong")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tipe")} <span className="text-danger">*</span></Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as Member["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fungsionaris">{t("Fungsionaris")}</SelectItem>
                  <SelectItem value="intern">{t("Intern")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Divisi")} <span className="text-danger">*</span></Label>
              <Select value={f.division} onValueChange={(v) => setF({ ...f, division: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {divisions.map((d) => (
                    <SelectItem key={d.key} value={d.key}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Ormawa Visit")} <span className="text-danger">*</span></Label>
            <Select value={f.event_id} onValueChange={(v) => setF({ ...f, event_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{mode === "create" ? t("Selesai") : t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.name.trim() || !f.division}>
            {pending && <Loader2 className="size-4 animate-spin" />}{mode === "create" ? t("Tambah") : t("Simpan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MemberActions({
  member, divisions, events, defaultEventId,
}: { member: Member; divisions: Division[]; events: OVEvent[]; defaultEventId: string }) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> {t("Edit")}</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => start(async () => {
            const res = await deleteMemberAction(member.id);
            if (res.ok) toast.success(t("Anggota dihapus")); else toast.error(res.error);
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />} {t("Hapus")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MemberFormDialog
        mode="edit" member={member} divisions={divisions} events={events} defaultEventId={defaultEventId}
        open={editOpen} onOpenChange={setEditOpen}
      />
    </>
  );
}

// ---------------- Bulk actions bar (multi-select) ----------------
export function MemberBulkBar({
  ids, divisions, onClear,
}: { ids: string[]; divisions: Division[]; onClear: () => void }) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const [delOpen, setDelOpen] = React.useState(false);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) { toast.success(ok); onClear(); setDelOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="text-sm font-medium">{ids.length} {t("dipilih")}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* Bulk change division */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              <LayoutGrid className="size-4" /> {t("Ubah Divisi")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
            {divisions.map((d) => (
              <DropdownMenuItem
                key={d.key}
                onSelect={() => run(() => bulkUpdateMembersAction(ids, { division: d.key }), t("Divisi anggota diperbarui"))}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} /> {d.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Bulk change type */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              <Users className="size-4" /> {t("Ubah Tipe")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => run(() => bulkUpdateMembersAction(ids, { type: "fungsionaris" }), t("Tipe anggota diperbarui"))}>
              {t("Fungsionaris")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run(() => bulkUpdateMembersAction(ids, { type: "intern" }), t("Tipe anggota diperbarui"))}>
              {t("Intern")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Bulk delete */}
        <Button variant="destructive" size="sm" disabled={pending} onClick={() => setDelOpen(true)}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} {t("Hapus")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={pending}>
          <X className="size-4" /> {t("Batal")}
        </Button>
      </div>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Hapus anggota terpilih?")}</DialogTitle>
            <DialogDescription>
              {ids.length} {t("anggota akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button variant="destructive" disabled={pending}
              onClick={() => run(() => bulkDeleteMembersAction(ids), t("Anggota dihapus"))}>
              {pending && <Loader2 className="size-4 animate-spin" />}{t("Hapus")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Multi-select for team roster fields ----------------
function MemberMultiSelect({
  members, value, onChange, placeholder,
}: {
  members: Member[];
  value: string; // comma-joined display names
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const t = useT();
  const label = (m: Member) => m.nickname || m.name;
  const tokens = React.useMemo(() => value.split(",").map((s) => s.trim()).filter(Boolean), [value]);
  const matchedIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const t of tokens) {
      const m = members.find((mm) => label(mm).toLowerCase() === t.toLowerCase());
      if (m) set.add(m.id);
    }
    return set;
  }, [tokens, members]);
  // Free-text tokens that didn't match any known member (preserved so data isn't lost).
  const extras = tokens.filter((t) => !members.some((mm) => label(mm).toLowerCase() === t.toLowerCase()));

  function toggle(m: Member) {
    const isOn = matchedIds.has(m.id);
    const names = isOn
      ? tokens.filter((t) => t.toLowerCase() !== label(m).toLowerCase())
      : [...tokens, label(m)];
    onChange(names.join(", "));
  }
  function removeExtra(t: string) {
    onChange(tokens.filter((x) => x !== t).join(", "));
  }

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-card px-3 text-sm shadow-sm transition hover:bg-muted"
          >
            <span className="text-muted-foreground">{placeholder ?? t("Pilih anggota…")}</span>
            <ChevronsUpDown className="size-3.5 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-72 w-72 overflow-y-auto p-1.5">
          {members.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">{t("Belum ada anggota untuk Ormawa Visit ini.")}</p>
          ) : (
            members.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox checked={matchedIds.has(m.id)} onCheckedChange={() => toggle(m)} />
                <span className="flex-1 truncate">{label(m)}</span>
                {matchedIds.has(m.id) && <Check className="size-3.5 text-primary" />}
              </label>
            ))
          )}
        </PopoverContent>
      </Popover>

      {(matchedIds.size > 0 || extras.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {[...matchedIds].map((id) => {
            const m = members.find((mm) => mm.id === id)!;
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pl-2.5 pr-1 text-xs text-accent-foreground">
                {label(m)}
                <button type="button" onClick={() => toggle(m)} className="rounded-full p-0.5 hover:bg-black/10">
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
          {extras.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-2.5 pr-1 text-xs text-muted-foreground">
              {t}
              <button type="button" onClick={() => removeExtra(t)} className="rounded-full p-0.5 hover:bg-black/10">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Team ----------------
export function TeamFormDialog({
  mode, team, divisions, members, eventId, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  team?: Team;
  divisions: Division[];
  members: Member[];
  eventId: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const t = useT();
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState(() => ({
    division: team?.division ?? divisions[0]?.key ?? "EVENT",
    coordinator: team?.coordinator ?? "",
    fungsionaris: team?.fungsionaris ?? "",
    intern: team?.intern ?? "",
  }));
  React.useEffect(() => {
    if (isOpen && team) setF({ division: team.division, coordinator: team.coordinator, fungsionaris: team.fungsionaris, intern: team.intern });
  }, [isOpen, team]);

  const fungsionarisPool = React.useMemo(() => members.filter((m) => m.type === "fungsionaris"), [members]);
  const internPool = React.useMemo(() => members.filter((m) => m.type === "intern"), [members]);

  function submit() {
    start(async () => {
      const payload = { ...f, event_id: eventId };
      const res = mode === "create" ? await createTeamAction(payload) : await updateTeamAction(team!.id, payload);
      if (res.ok) { toast.success(mode === "create" ? t("Tim ditambahkan") : t("Tim diperbarui")); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Tambah Tim Divisi") : t("Edit Tim Divisi")}</DialogTitle>
          <DialogDescription>{t("Susunan anggota per divisi untuk Ormawa Visit ini.")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>{t("Divisi")}</Label>
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
            <Label>{t("Koordinator")} <span className="text-[10px] text-muted-foreground">({t("atasan divisi")})</span></Label>
            <MemberMultiSelect
              members={fungsionarisPool}
              value={f.coordinator}
              onChange={(v) => setF({ ...f, coordinator: v })}
              placeholder={t("Pilih koordinator…")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Fungsionaris")}</Label>
            <MemberMultiSelect
              members={fungsionarisPool}
              value={f.fungsionaris}
              onChange={(v) => setF({ ...f, fungsionaris: v })}
              placeholder={t("Pilih fungsionaris…")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Intern")}</Label>
            <MemberMultiSelect
              members={internPool}
              value={f.intern}
              onChange={(v) => setF({ ...f, intern: v })}
              placeholder={t("Pilih intern…")}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}{mode === "create" ? t("Tambah") : t("Simpan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeamActions({
  team, divisions, members, eventId,
}: { team: Team; divisions: Division[]; members: Member[]; eventId: string }) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> {t("Edit")}</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => start(async () => {
            const res = await deleteTeamAction(team.id);
            if (res.ok) toast.success(t("Tim dihapus")); else toast.error(res.error);
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />} {t("Hapus")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TeamFormDialog
        mode="edit" team={team} divisions={divisions} members={members} eventId={eventId}
        open={editOpen} onOpenChange={setEditOpen}
      />
    </>
  );
}
