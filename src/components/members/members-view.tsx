"use client";
import * as React from "react";
import { Search, Users2, IdCard, Plus, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DivisionBadge } from "@/components/division-badge";
import { EmptyState } from "@/components/ui/empty";
import {
  MemberFormDialog, MemberActions, MemberBulkBar, TeamFormDialog, TeamActions,
} from "./member-manage";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { Division, Member, OVEvent, Team } from "@/lib/types";

type SortCol = "name" | "nrp" | "division" | "type" | "year";

export function MembersView({
  members,
  teams,
  divisions,
  events,
  eventId,
  eventTitle,
  canManageMembers,
  canManageTeams,
}: {
  members: Member[];
  teams: Team[];
  divisions: Division[];
  events: OVEvent[];
  eventId: string;
  eventTitle: string;
  canManageMembers: boolean;
  canManageTeams: boolean;
}) {
  const tr = useT();
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"all" | "fungsionaris" | "intern">("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [sort, setSort] = React.useState<{ col: SortCol; dir: 1 | -1 }>({ col: "name", dir: 1 });
  const divMap = React.useMemo(() => new Map(divisions.map((d) => [d.key, d])), [divisions]);

  const filtered = React.useMemo(() => {
    const list = members.filter((m) => {
      if (type !== "all" && m.type !== type) return false;
      if (q && !`${m.name} ${m.nickname} ${m.nrp}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    const val = (m: Member): string | number => {
      switch (sort.col) {
        case "nrp": return m.nrp ?? "";
        case "division": return divMap.get(m.division ?? "")?.name ?? "";
        case "type": return m.type;
        case "year": return m.year ?? 0;
        default: return (m.name ?? "").toLowerCase();
      }
    };
    return [...list].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [members, type, q, sort, divMap]);

  function toggleSort(col: SortCol) {
    setSort((prev) => (prev.col === col ? { col, dir: (prev.dir === 1 ? -1 : 1) as 1 | -1 } : { col, dir: 1 }));
  }

  // Only ever act on selections that are still visible under the current filter
  // (ids selected then filtered away, or deleted, are simply ignored — no effect
  // needed to prune state).
  const filteredIds = filtered.map((m) => m.id);
  const selectedInView = filteredIds.filter((id) => selected.has(id));
  const allChecked = filtered.length > 0 && selectedInView.length === filtered.length;
  const someChecked = selectedInView.length > 0 && !allChecked;
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(filteredIds));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const fungCount = members.filter((m) => m.type === "fungsionaris").length;
  const internCount = members.filter((m) => m.type === "intern").length;

  return (
    <Tabs defaultValue="anggota">
      <TabsList>
        <TabsTrigger value="anggota">
          <IdCard /> {tr("Anggota EA")}
        </TabsTrigger>
        <TabsTrigger value="tim">
          <Users2 /> {tr("Struktur Tim")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="anggota">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Cari nama / NRP…")} className="pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
              {([
                ["all", `${tr("Semua")} ${members.length}`],
                ["fungsionaris", `${tr("Fungsionaris")} ${fungCount}`],
                ["intern", `${tr("Intern")} ${internCount}`],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setType(k as typeof type)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 font-medium transition",
                    type === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {canManageMembers && (
              <MemberFormDialog mode="create" divisions={divisions} events={events} defaultEventId={eventId} trigger={
                <DialogTrigger asChild>
                  <Button><Plus className="size-4" /> <span className="hidden sm:inline">{tr("Tambah")}</span></Button>
                </DialogTrigger>
              } />
            )}
          </div>
        </div>

        {canManageMembers && selectedInView.length > 0 && (
          <MemberBulkBar ids={selectedInView} divisions={divisions} onClear={() => setSelected(new Set())} />
        )}

        {filtered.length ? (
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {canManageMembers && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allChecked ? true : someChecked ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                        aria-label={tr("Pilih semua")}
                      />
                    </TableHead>
                  )}
                  <SortHead col="name" label={tr("Nama")} sort={sort} onSort={toggleSort} />
                  <SortHead col="nrp" label="NRP" sort={sort} onSort={toggleSort} />
                  <SortHead col="division" label={tr("Divisi")} sort={sort} onSort={toggleSort} />
                  <SortHead col="type" label={tr("Tipe")} sort={sort} onSort={toggleSort} />
                  <SortHead col="year" label={tr("Angkatan")} sort={sort} onSort={toggleSort} />
                  {canManageMembers && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  const div = m.division ? divMap.get(m.division) : undefined;
                  return (
                    <TableRow key={m.id} data-state={selected.has(m.id) ? "selected" : undefined}>
                      {canManageMembers && (
                        <TableCell>
                          <Checkbox
                            checked={selected.has(m.id)}
                            onCheckedChange={() => toggleOne(m.id)}
                            aria-label={tr("Pilih")}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.nickname || m.name} size={32} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{m.name}</p>
                            {m.nickname && <p className="truncate text-xs text-muted-foreground">{m.nickname}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.nrp || "-"}</TableCell>
                      <TableCell>{div ? <DivisionBadge division={div} /> : <span className="text-sm text-muted-foreground">-</span>}</TableCell>
                      <TableCell>
                        <Badge variant={m.type === "fungsionaris" ? "primary" : "info"}>
                          {m.type === "fungsionaris" ? tr("Fungsio") : tr("Intern")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.year}</TableCell>
                      {canManageMembers && (
                        <TableCell>
                          <MemberActions member={m} divisions={divisions} events={events} defaultEventId={eventId} />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState icon={<IdCard />} title={tr("Tidak ditemukan")} description={tr("Tidak ada anggota yang cocok.")} />
        )}
      </TabsContent>

      <TabsContent value="tim">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{tr("Struktur tim untuk")} {eventTitle}</p>
          {canManageTeams && (
            <TeamFormDialog mode="create" divisions={divisions} members={members} eventId={eventId} trigger={
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="size-4" /> {tr("Tambah Tim")}</Button>
              </DialogTrigger>
            } />
          )}
        </div>
        {teams.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {teams.map((t) => {
              const div = divMap.get(t.division);
              return (
                <Card key={t.id} className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: div?.color ?? "#888" }}
                    >
                      {div?.short ?? "?"}
                    </span>
                    <h4 className="font-semibold">{div?.name ?? t.division}</h4>
                    {canManageTeams && (
                      <div className="ml-auto">
                        <TeamActions team={t} divisions={divisions} members={members} eventId={eventId} />
                      </div>
                    )}
                  </div>
                  {t.coordinator && t.coordinator !== "-" && (
                    <div className="mb-2">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{tr("Koordinator")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {t.coordinator.split(/\s{2,}|,|·/).filter(Boolean).map((n, i) => (
                          <span key={i} className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/25">{n.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {t.fungsionaris && (
                    <div className="mb-2">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{tr("Fungsionaris")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {t.fungsionaris.split(/\s{2,}|,|·/).filter(Boolean).map((n, i) => (
                          <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">{n.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {t.intern && t.intern !== "-" && (
                    <div>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Intern</p>
                      <div className="flex flex-wrap gap-1.5">
                        {t.intern.split(/\s{2,}|,|·/).filter(Boolean).map((n, i) => (
                          <span key={i} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{n.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Users2 />} title={tr("Belum ada struktur tim")} description={tr("Struktur tim untuk Ormawa Visit ini belum diisi.")} />
        )}
      </TabsContent>
    </Tabs>
  );
}

function SortHead({
  col, label, sort, onSort,
}: {
  col: SortCol;
  label: string;
  sort: { col: SortCol; dir: 1 | -1 };
  onSort: (c: SortCol) => void;
}) {
  const active = sort.col === col;
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center gap-1 transition hover:text-foreground",
          active ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (
          sort.dir === 1 ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
        ) : (
          <ChevronsUpDown className="size-3.5 opacity-50" />
        )}
      </button>
    </TableHead>
  );
}
