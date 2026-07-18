"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  Search, Plus, ExternalLink, Link2, Loader2, MoreHorizontal, Pencil, Trash2, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DivisionBadge } from "@/components/division-badge";
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
import { useT } from "@/lib/i18n/provider";
import type { Division, LinkItem, OVEvent, Team } from "@/lib/types";

const NO_DIVISION = "__none__";

/** Match a (possibly legacy free-text) division value to a known Division. */
function resolveDivision(raw: string, divisions: Division[]): Division | null {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase();
  return (
    divisions.find((d) => d.key.toLowerCase() === norm) ??
    divisions.find((d) => d.name.toLowerCase() === norm) ??
    null
  );
}

// ---------------- Form ----------------
function LinkFormDialog({
  mode, link, events, divisions, teams, defaultEventId, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  link?: LinkItem;
  events: OVEvent[];
  divisions: Division[];
  teams: Team[];
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
  const [f, setF] = React.useState(() => ({
    event_id: link?.event_id ?? defaultEventId,
    division: link ? resolveDivision(link.division, divisions)?.key ?? NO_DIVISION : NO_DIVISION,
    name: link?.name ?? "",
    url: link?.url ?? "",
    note: link?.note ?? "",
  }));
  React.useEffect(() => {
    if (isOpen && link) {
      setF({
        event_id: link.event_id ?? defaultEventId,
        division: resolveDivision(link.division, divisions)?.key ?? NO_DIVISION,
        name: link.name,
        url: link.url,
        note: link.note,
      });
    }
  }, [isOpen, link, defaultEventId, divisions]);

  // Divisions actually used in the chosen Ormawa Visit (via team structure);
  // falls back to the full division list if that event has no team data yet.
  const availableDivisions = React.useMemo(() => {
    const used = new Set(teams.filter((t) => t.event_id === f.event_id).map((t) => t.division));
    return used.size ? divisions.filter((d) => used.has(d.key)) : divisions;
  }, [teams, divisions, f.event_id]);

  React.useEffect(() => {
    if (f.division !== NO_DIVISION && !availableDivisions.some((d) => d.key === f.division)) {
      setF((prev) => ({ ...prev, division: NO_DIVISION }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.event_id]);

  const urlValid = isUrl(f.url);

  function submit() {
    if (!urlValid) {
      toast.error(t("URL wajib diisi dan berupa tautan yang valid (diawali https://)."));
      return;
    }
    start(async () => {
      const payload = {
        event_id: f.event_id,
        division: f.division === NO_DIVISION ? "" : f.division,
        name: f.name,
        url: f.url,
        note: f.note,
      };
      const res = mode === "create" ? await createLinkAction(payload) : await updateLinkAction(link!.id, payload);
      if (res.ok) { toast.success(mode === "create" ? t("Tautan ditambahkan") : t("Tautan diperbarui")); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Tambah Tautan") : t("Edit Tautan")}</DialogTitle>
          <DialogDescription>{t("Dokumen, form, atau drive penting Ormawa Visit.")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>
              {t("Nama")} <span className="text-danger">*</span>
            </Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Rundown Panitia OV" />
          </div>
          <div className="grid gap-1.5">
            <Label>
              {t("URL / Tautan")} <span className="text-danger">*</span>
            </Label>
            <Input
              value={f.url}
              onChange={(e) => setF({ ...f, url: e.target.value })}
              placeholder="https://docs.google.com/…"
            />
            {f.url && !urlValid && (
              <p className="text-[11px] text-danger">{t("Harus berupa tautan (diawali http:// atau https://).")}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>
                {t("Jenis Ormawa Visit")} <span className="text-danger">*</span>
              </Label>
              <Select value={f.event_id} onValueChange={(v) => setF({ ...f, event_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Divisi")}</Label>
              <Select value={f.division} onValueChange={(v) => setF({ ...f, division: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DIVISION}>{t("Umum (tanpa divisi)")}</SelectItem>
                  {availableDivisions.map((d) => (
                    <SelectItem key={d.key} value={d.key}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Catatan (opsional)")}</Label>
            <Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="min-h-[56px]" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.name.trim() || !urlValid}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? t("Tambah") : t("Simpan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkActions({
  link, events, divisions, teams, defaultEventId,
}: {
  link: LinkItem;
  events: OVEvent[];
  divisions: Division[];
  teams: Team[];
  defaultEventId: string;
}) {
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
      <LinkFormDialog
        mode="edit" link={link} events={events} divisions={divisions} teams={teams}
        defaultEventId={defaultEventId} open={editOpen} onOpenChange={setEditOpen}
      />
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Hapus tautan?")}</DialogTitle>
            <DialogDescription>&ldquo;{link.name}&rdquo; {t("akan dihapus.")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
              const res = await deleteLinkAction(link.id);
              if (res.ok) { toast.success(t("Tautan dihapus")); setDelOpen(false); } else toast.error(res.error);
            })}>{pending && <Loader2 className="size-4 animate-spin" />}{t("Hapus")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------- View ----------------
export function LinksView({
  links,
  events,
  divisions,
  teams,
  defaultEventId,
  canCreate,
  canManage,
}: {
  links: LinkItem[];
  events: OVEvent[];
  divisions: Division[];
  teams: Team[];
  defaultEventId: string;
  canCreate: boolean;
  canManage: boolean;
}) {
  const t = useT();
  const [q, setQ] = React.useState("");
  const [eventFilter, setEventFilter] = React.useState<string>("all");
  const eventMap = React.useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const filtered = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    return links.filter((l) => {
      if (eventFilter !== "all" && l.event_id !== eventFilter) return false;
      if (query && !`${l.name} ${l.division} ${l.note} ${l.url}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [links, q, eventFilter]);

  // Group: Ormawa Visit -> Divisi -> links. When a specific event is
  // selected, the outer level collapses to a single group.
  const grouped = React.useMemo(() => {
    const byEvent = new Map<string, LinkItem[]>();
    for (const l of filtered) {
      const key = l.event_id ?? "__no_event__";
      if (!byEvent.has(key)) byEvent.set(key, []);
      byEvent.get(key)!.push(l);
    }
    return [...byEvent.entries()].map(([eventId, items]) => {
      const byDivision = new Map<string, LinkItem[]>();
      for (const l of items) {
        const div = resolveDivision(l.division, divisions);
        const key = div?.key ?? "__none__";
        if (!byDivision.has(key)) byDivision.set(key, []);
        byDivision.get(key)!.push(l);
      }
      return {
        event: eventMap.get(eventId) ?? null,
        divisionGroups: [...byDivision.entries()].map(([key, items]) => ({
          division: divisions.find((d) => d.key === key) ?? null,
          items,
        })),
      };
    });
  }, [filtered, divisions, eventMap]);

  const hasFilters = q || eventFilter !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cari tautan…")} className="pl-9" />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-auto min-w-[200px]"><SelectValue placeholder={t("Jenis Ormawa Visit")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Semua Ormawa Visit")}</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setEventFilter("all"); }}><X className="size-4" /> {t("Reset")}</Button>
          )}
        </div>
        {canCreate && (
          <LinkFormDialog
            mode="create" events={events} divisions={divisions} teams={teams}
            defaultEventId={eventFilter !== "all" ? eventFilter : defaultEventId}
            trigger={<DialogTrigger asChild><Button><Plus className="size-4" /> {t("Tambah")}</Button></DialogTrigger>}
          />
        )}
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon={<Link2 />} title={t("Tidak ada tautan")} description={t("Sesuaikan pencarian atau tambah tautan baru.")} />
      ) : (
        <div className="space-y-5">
          {grouped.map(({ event, divisionGroups }) => (
            <div key={event?.id ?? "no-event"} className="space-y-3">
              {eventFilter === "all" && (
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{event?.title ?? t("Tanpa Ormawa Visit")}</h3>
                  {event && <Badge variant="outline">{event.cabinet}</Badge>}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {divisionGroups.map(({ division, items }) => (
                  <Card key={division?.key ?? "none"} className="overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                      {division ? (
                        <DivisionBadge division={division} />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">{t("Umum")}</span>
                      )}
                      <span className="ml-auto text-[11px] text-muted-foreground">{items.length} {t("tautan")}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {items.map((l) => (
                        <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                            <Link2 className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{l.name}</span>
                            {l.note && <p className="truncate text-xs text-muted-foreground">{l.note}</p>}
                          </div>
                          <a
                            href={l.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-muted"
                          >
                            {t("Buka")} <ExternalLink className="size-3" />
                          </a>
                          {canManage && (
                            <LinkActions link={l} events={events} divisions={divisions} teams={teams} defaultEventId={defaultEventId} />
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
