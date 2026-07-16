"use client";
import * as React from "react";
import { Search, Plus, Table2, Columns3, X, Building2, Phone, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { ProspectFormDialog } from "./prospect-form-dialog";
import { ProspectActions } from "./prospect-actions";
import { PIPELINE_STAGES, prospectStage } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { AppUser, Prospect } from "@/lib/types";

const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.key, s]));

function StageBadge({ p }: { p: Prospect }) {
  const s = STAGE_MAP[prospectStage(p)];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: s.color, backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
  );
}

export function ProspectsView({ prospects, user }: { prospects: Prospect[]; user: AppUser }) {
  const manage = can.manageProspects(user);
  const batches = React.useMemo(() => [...new Set(prospects.map((p) => p.batch))], [prospects]);
  const [view, setView] = React.useState<"table" | "board">("table");
  const [q, setQ] = React.useState("");
  const [batch, setBatch] = React.useState("all");
  const [stage, setStage] = React.useState("all");

  const filtered = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    return prospects.filter((p) => {
      if (batch !== "all" && p.batch !== batch) return false;
      if (stage !== "all" && prospectStage(p) !== stage) return false;
      if (query && !`${p.org_name} ${p.campus} ${p.contact} ${p.pic}`.toLowerCase().includes(query))
        return false;
      return true;
    });
  }, [prospects, q, batch, stage]);

  const hasFilters = q || batch !== "all" || stage !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari himpunan, kampus, PIC…" className="pl-9" />
          </div>
          <Select value={batch} onValueChange={setBatch}>
            <SelectTrigger className="w-auto min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Batch</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-auto min-w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tahap</SelectItem>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setBatch("all"); setStage("all"); }}>
              <X className="size-4" /> Reset
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {(["table", "board"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                  view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "table" ? <Table2 className="size-4" /> : <Columns3 className="size-4" />}
                <span className="hidden sm:inline">{v === "table" ? "Tabel" : "Pipeline"}</span>
              </button>
            ))}
          </div>
          {manage && (
            <ProspectFormDialog
              mode="create"
              batches={batches}
              trigger={
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4" /> <span className="hidden sm:inline">Tambah</span>
                  </Button>
                </DialogTrigger>
              }
            />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} prospek</p>

      {view === "table" ? (
        filtered.length ? (
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Himpunan</TableHead>
                  <TableHead>Kampus</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>Tahap</TableHead>
                  <TableHead>Batch</TableHead>
                  {manage && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.org_name || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.campus || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{p.contact || "—"}</TableCell>
                    <TableCell className="text-sm">{p.pic || "—"}</TableCell>
                    <TableCell><StageBadge p={p} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.batch}</TableCell>
                    {manage && (
                      <TableCell>
                        <ProspectActions prospect={p} batches={batches} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState icon={<Building2 />} title="Tidak ada prospek" description="Sesuaikan filter atau tambah prospek baru." />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {PIPELINE_STAGES.map((s) => {
            const items = filtered.filter((p) => prospectStage(p) === s.key);
            return (
              <div key={s.key} className="rounded-xl border border-border bg-muted/30">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2 p-2 pt-0">
                  {items.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium">{p.org_name || "—"}</p>
                        {manage && <ProspectActions prospect={p} batches={batches} />}
                      </div>
                      {p.campus && <p className="mt-0.5 text-xs text-muted-foreground">{p.campus}</p>}
                      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                        {p.contact && (
                          <p className="flex items-center gap-1.5"><Phone className="size-3" /> <span className="truncate">{p.contact}</span></p>
                        )}
                        {p.pic && (
                          <p className="flex items-center gap-1.5"><UserRound className="size-3" /> {p.pic}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
