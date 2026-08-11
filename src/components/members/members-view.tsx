"use client";
import * as React from "react";
import { Search, IdCard, Plus, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  MemberFormDialog, MemberActions, MemberBulkBar,
} from "./member-manage";
import { DivisionsGrid, type DivisionStat } from "@/components/divisions/divisions-grid";
import { SortIndicator } from "@/components/ui/sort-indicator";
import { useMultiSort, sortRows } from "@/lib/use-multi-sort";
import { visibleSelection } from "@/lib/use-multi-select";
import { cn } from "@/lib/utils";
import { memberDivisions, primaryDivision } from "@/lib/members";
import { useT } from "@/lib/i18n/provider";
import type { Division, Member, OVEvent, Team } from "@/lib/types";

type SortCol = "name" | "nrp" | "division" | "type" | "year";

export function MembersView({
  members,
  teams,
  divisions,
  divisionStats,
  events,
  eventId,
  canManageMembers,
  canManageTeams,
  canManageDivisions,
}: {
  members: Member[];
  teams: Team[];
  divisions: Division[];
  divisionStats: DivisionStat[];
  events: OVEvent[];
  eventId: string;
  canManageMembers: boolean;
  canManageTeams: boolean;
  canManageDivisions: boolean;
}) {
  const tr = useT();
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"all" | "fungsionaris" | "intern">("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const sort = useMultiSort<SortCol>([{ key: "name", dir: "asc" }]);
  const divMap = React.useMemo(() => new Map(divisions.map((d) => [d.key, d])), [divisions]);

  const filtered = React.useMemo(() => {
    const list = members.filter((m) => {
      if (type !== "all" && m.type !== type) return false;
      if (q && !`${m.name} ${m.nickname} ${m.nrp}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    const val = (m: Member, col: SortCol): string | number => {
      switch (col) {
        case "nrp": return m.nrp ?? "";
        // Sort by the primary division so multi-division members still group.
        case "division": return divMap.get(primaryDivision(m) ?? "")?.name ?? "";
        case "type": return m.type;
        case "year": return m.year ?? 0;
        default: return (m.name ?? "").toLowerCase();
      }
    };
    return sortRows(list, sort.rules, val);
  }, [members, type, q, sort.rules, divMap]);

  // Only ever act on selections that are still visible under the current filter
  // (ids selected then filtered away, or deleted, are simply ignored - no effect
  // needed to prune state).
  const filteredIds = filtered.map((m) => m.id);
  const selectedInView = visibleSelection(selected, filteredIds);
  const allChecked = filtered.length > 0 && selectedInView.length === filtered.length;
  const someChecked = selectedInView.length > 0 && !allChecked;
  /** Adds/removes only the rows on screen - ticks hidden by the current filter
   *  are left alone rather than being thrown away by a "select all". */
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) { if (allChecked) next.delete(id); else next.add(id); }
      return next;
    });
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
    <Tabs defaultValue="divisi">
      <TabsList>
        <TabsTrigger value="divisi">
          <LayoutGrid /> {tr("Divisi")}
        </TabsTrigger>
        <TabsTrigger value="anggota">
          <IdCard /> {tr("Anggota EA")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="divisi">
        {/* Struktur Tim is merged into each division card (Divisi-led UI). */}
        <DivisionsGrid
          divisions={divisions}
          stats={divisionStats}
          teams={teams}
          members={members}
          eventId={eventId}
          canManage={canManageDivisions}
          canManageTeams={canManageTeams}
          canManageMembers={canManageMembers}
        />
      </TabsContent>

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
                  <SortHead col="name" label={tr("Nama")} sort={sort} />
                  <SortHead col="nrp" label="NRP" sort={sort} />
                  <SortHead col="division" label={tr("Divisi")} sort={sort} />
                  <SortHead col="type" label={tr("Tipe")} sort={sort} />
                  <SortHead col="year" label={tr("Angkatan")} sort={sort} />
                  {canManageMembers && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  // A member can sit in several divisions - show them all.
                  const divs = memberDivisions(m).map((k) => divMap.get(k)).filter(Boolean) as Division[];
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
                      <TableCell>
                        {divs.length ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {divs.map((d) => <DivisionBadge key={d.key} division={d} />)}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
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
    </Tabs>
  );
}

function SortHead({
  col, label, sort,
}: {
  col: SortCol;
  label: string;
  sort: ReturnType<typeof useMultiSort<SortCol>>;
}) {
  const dir = sort.dirOf(col);
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => sort.toggle(col)}
        className={cn(
          "inline-flex items-center gap-1 transition hover:text-foreground",
          dir ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <SortIndicator dir={dir} rank={sort.rankOf(col)} showRank={sort.rules.length > 1} />
      </button>
    </TableHead>
  );
}
