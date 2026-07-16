"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  Search, Plus, ExternalLink, Link2, FileText, Loader2, MoreHorizontal, Pencil, Trash2, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLinkAction, updateLinkAction, deleteLinkAction } from "@/lib/actions/links";
import { isUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppUser, LinkItem } from "@/lib/types";

function LinkFormDialog({
  mode, link, sections, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  link?: LinkItem;
  sections: string[];
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState(() => ({
    section: link?.section ?? sections[0] ?? "",
    division: link?.division ?? "",
    name: link?.name ?? "",
    url: link?.url ?? "",
    note: link?.note ?? "",
  }));
  React.useEffect(() => {
    if (isOpen && link) setF({ section: link.section, division: link.division, name: link.name, url: link.url, note: link.note });
  }, [isOpen, link]);

  function submit() {
    start(async () => {
      const res = mode === "create" ? await createLinkAction(f) : await updateLinkAction(link!.id, f);
      if (res.ok) { toast.success(mode === "create" ? "Tautan ditambahkan" : "Tautan diperbarui"); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Tautan" : "Edit Tautan"}</DialogTitle>
          <DialogDescription>Dokumen, form, atau drive penting Ormawa Visit.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Nama</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Rundown Panitia OV" />
          </div>
          <div className="grid gap-1.5">
            <Label>URL / Tautan</Label>
            <Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://… atau judul dokumen" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Seksi / Edisi</Label>
              <Input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} list="sections" />
              <datalist id="sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="grid gap-1.5">
              <Label>Divisi (opsional)</Label>
              <Input value={f.division} onChange={(e) => setF({ ...f, division: e.target.value })} placeholder="EVENT, LO…" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Catatan (opsional)</Label>
            <Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="min-h-[56px]" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.name.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Tambah" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkActions({ link, sections }: { link: LinkItem; sections: string[] }) {
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
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> Edit</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDelOpen(true)}><Trash2 /> Hapus</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LinkFormDialog mode="edit" link={link} sections={sections} open={editOpen} onOpenChange={setEditOpen} />
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus tautan?</DialogTitle>
            <DialogDescription>“{link.name}” akan dihapus.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
              const res = await deleteLinkAction(link.id);
              if (res.ok) { toast.success("Tautan dihapus"); setDelOpen(false); } else toast.error(res.error);
            })}>{pending && <Loader2 className="size-4 animate-spin" />}Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LinksView({ links, user, canManage }: { links: LinkItem[]; user: AppUser; canManage: boolean }) {
  const sections = React.useMemo(() => [...new Set(links.map((l) => l.section).filter(Boolean))], [links]);
  const [q, setQ] = React.useState("");
  const [section, setSection] = React.useState("all");

  const filtered = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    return links.filter((l) => {
      if (section !== "all" && l.section !== section) return false;
      if (query && !`${l.name} ${l.division} ${l.note} ${l.url}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [links, q, section]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, LinkItem[]>();
    for (const l of filtered) {
      const key = l.section || "Lainnya";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari tautan…" className="pl-9" />
          </div>
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="w-auto min-w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Seksi</SelectItem>
              {sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {(q || section !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setSection("all"); }}><X className="size-4" /> Reset</Button>
          )}
        </div>
        {canManage && (
          <LinkFormDialog mode="create" sections={sections} trigger={
            <DialogTrigger asChild><Button><Plus className="size-4" /> Tambah</Button></DialogTrigger>
          } />
        )}
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon={<Link2 />} title="Tidak ada tautan" description="Sesuaikan pencarian atau tambah tautan baru." />
      ) : (
        <div className="space-y-4">
          {grouped.map(([sec, items]) => (
            <Card key={sec} className="overflow-hidden">
              <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold">{sec}</div>
              <div className="divide-y divide-border">
                {items.map((l) => {
                  const real = isUrl(l.url);
                  return (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", real ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                        {real ? <Link2 /> : <FileText />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{l.name}</span>
                          {l.division && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{l.division}</span>}
                        </div>
                        {(l.note || (!real && l.url)) && (
                          <p className="truncate text-xs text-muted-foreground">{l.note || l.url}</p>
                        )}
                      </div>
                      {real && (
                        <a href={l.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-muted">
                          Buka <ExternalLink className="size-3" />
                        </a>
                      )}
                      {canManage && <LinkActions link={l} sections={sections} />}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
