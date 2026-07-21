"use client";
import * as React from "react";
import { toast } from "sonner";
import { Search, Plus, Table2, Columns3, X, Building2, Phone, UserRound, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogTrigger } from "@/components/ui/dialog";
import { useMultiSelect } from "@/lib/use-multi-select";
import { useMultiSort, sortRows } from "@/lib/use-multi-sort";
import { SortIndicator } from "@/components/ui/sort-indicator";
import { bulkDeleteProspectsAction } from "@/lib/actions/prospects";
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
import { useT } from "@/lib/i18n/provider";
import type { AppUser, Prospect } from "@/lib/types";

const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.key, s]));

type ProspectSortKey = "org_name" | "campus" | "contact" | "pic" | "stage" | "batch";

function StageBadge({ p }: { p: Prospect }) {
  const t = useT();
  const s = STAGE_MAP[prospectStage(p)];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: s.color, backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {t(s.label)}
    </span>
  );
}

export function ProspectsView({
  prospects,
  user,
  activeEventId,
}: {
  prospects: Prospect[];
  user: AppUser;
  activeEventId: string;
}) {
  const t = useT();
  const manage = can.manageProspects(user);
  const batches = React.useMemo(() => [...new Set(prospects.map((p) => p.batch))], [prospects]);
  const [view, setView] = React.useState<"table" | "board">("table");
  const [q, setQ] = React.useState("");
  const [batch, setBatch] = React.useState("all");
  const [stage, setStage] = React.useState("all");
  const sort = useMultiSort<ProspectSortKey>();
  const sel = useMultiSelect();
  React.useEffect(() => sel.clear(), [prospects]); // eslint-disable-line react-hooks/exhaustive-deps
  const [bulkPending, startBulk] = React.useTransition();

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

  const stageOrder = React.useMemo(
    () => Object.fromEntries(PIPELINE_STAGES.map((s, i) => [s.key, i])),
    [],
  );
  const rows = React.useMemo(() => {
    const val = (p: Prospect, key: ProspectSortKey): string | number => {
      switch (key) {
        case "org_name": return p.org_name.toLowerCase();
        case "campus": return p.campus.toLowerCase();
        case "contact": return p.contact.toLowerCase();
        case "pic": return p.pic.toLowerCase();
        case "stage": return stageOrder[prospectStage(p)] ?? 99;
        case "batch": return p.batch.toLowerCase();
      }
    };
    return sortRows(filtered, sort.rules, val);
  }, [filtered, sort.rules, stageOrder]);

  const SortHead = ({ k, children }: { k: ProspectSortKey; children: React.ReactNode }) => (
    <TableHead>
      <button onClick={() => sort.toggle(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        <SortIndicator dir={sort.dirOf(k)} rank={sort.rankOf(k)} showRank={sort.rules.length > 1} />
      </button>
    </TableHead>
  );

  const hasFilters = q || batch !== "all" || stage !== "all";
  const allSelected = rows.length > 0 && rows.every((p) => sel.selected.has(p.id));
  function bulkDelete() {
    startBulk(async () => {
      const res = await bulkDeleteProspectsAction(sel.ids);
      if (res.ok) { toast.success(`${sel.count} ${t("prospek dihapus")}`); sel.clear(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cari himpunan, kampus, PIC…")} className="pl-9" />
          </div>
          <Select value={batch} onValueChange={setBatch}>
            <SelectTrigger className="w-auto min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Semua Batch")}</SelectItem>
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
              <SelectItem value="all">{t("Semua Tahap")}</SelectItem>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {t(s.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setBatch("all"); setStage("all"); }}>
              <X className="size-4" /> {t("Reset")}
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
                <span className="hidden sm:inline">{v === "table" ? t("Tabel") : t("Pipeline")}</span>
              </button>
            ))}
          </div>
          {manage && (
            <ProspectFormDialog
              mode="create"
              batches={batches}
              eventId={activeEventId}
              trigger={
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4" /> <span className="hidden sm:inline">{t("Tambah")}</span>
                  </Button>
                </DialogTrigger>
              }
            />
          )}
        </div>
      </div>

      {manage && sel.count > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{sel.count} {t("dipilih")}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="destructive" size="sm" disabled={bulkPending} onClick={bulkDelete}>
              {bulkPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} {t("Hapus")}
            </Button>
            <Button variant="ghost" size="sm" onClick={sel.clear} disabled={bulkPending}><X className="size-4" /> {t("Batal")}</Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{filtered.length} {t("prospek")}</p>
      )}

      {view === "table" ? (
        filtered.length ? (
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {manage && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(c) => sel.set(rows.map((p) => p.id), c === true)}
                        aria-label={t("Pilih semua")}
                      />
                    </TableHead>
                  )}
                  <SortHead k="org_name">{t("Himpunan")}</SortHead>
                  <SortHead k="campus">{t("Kampus")}</SortHead>
                  <SortHead k="contact">{t("Kontak")}</SortHead>
                  <SortHead k="pic">{t("PIC")}</SortHead>
                  <SortHead k="stage">{t("Tahap")}</SortHead>
                  <SortHead k="batch">{t("Batch")}</SortHead>
                  {manage && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id} data-state={sel.selected.has(p.id) ? "selected" : undefined}>
                    {manage && (
                      <TableCell>
                        <Checkbox checked={sel.selected.has(p.id)} onCheckedChange={() => sel.toggle(p.id)} aria-label={t("Pilih")} />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{p.org_name || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.campus || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{p.contact || "-"}</TableCell>
                    <TableCell className="text-sm">{p.pic || "-"}</TableCell>
                    <TableCell><StageBadge p={p} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.batch}</TableCell>
                    {manage && (
                      <TableCell>
                        <ProspectActions prospect={p} batches={batches} eventId={activeEventId} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState icon={<Building2 />} title={t("Tidak ada prospek")} description={t("Sesuaikan filter atau tambah prospek baru.")} />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {PIPELINE_STAGES.map((s) => {
            const items = filtered.filter((p) => prospectStage(p) === s.key);
            return (
              <div key={s.key} className="rounded-xl border border-border bg-muted/30">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-sm font-semibold">{t(s.label)}</span>
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2 p-2 pt-0">
                  {items.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium">{p.org_name || "-"}</p>
                        {manage && <ProspectActions prospect={p} batches={batches} eventId={activeEventId} />}
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
