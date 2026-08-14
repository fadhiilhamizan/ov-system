"use client";
import * as React from "react";
import { toast } from "sonner";
import { Search, Plus, Table2, Columns3, X, Building2, Phone, UserRound, Trash2, Loader2, Star, CheckCircle2, ExternalLink, Share2, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogTrigger } from "@/components/ui/dialog";
import { useMultiSelect } from "@/lib/use-multi-select";
import { useMultiSort, sortRows } from "@/lib/use-multi-sort";
import { SortHead } from "@/components/ui/sort-indicator";
import { bulkDeleteProspectsAction } from "@/lib/actions/prospects";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { ExpandableText } from "@/components/ui/expandable-text";
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
import type { AppUser, Member, Prospect, ProspectLink } from "@/lib/types";

const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.key, s]));

type ProspectSortKey = "org_name" | "campus" | "contact" | "pic" | "stage";

/**
 * Every link attached to a prospect, one chip each.
 *
 * Read-only: links are edited in the prospect dialog. The share icon is the
 * only cue that a link also lives in Super Link, same as on a task result.
 */
function ProspectLinkChips({ links }: { links: ProspectLink[] }) {
  const t = useT();
  if (!links.length) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {links.map((l, i) => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${l.label || l.url}${l.in_super_link ? ` (${t("Super Link")})` : ""}`}
          className="inline-flex max-w-[140px] items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground transition hover:brightness-95"
        >
          <ExternalLink className="size-2.5 shrink-0" />
          <span className="truncate">{l.label?.trim() || `${t("Tautan")} ${i + 1}`}</span>
          {l.in_super_link && <Share2 className="size-2.5 shrink-0 opacity-70" />}
        </a>
      ))}
    </div>
  );
}

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
  prospectLinks,
  members,
  user,
  activeEventId,
}: {
  prospects: Prospect[];
  /** Every prospect's links, keyed by prospect id (fetched once by the page). */
  prospectLinks: Record<string, ProspectLink[]>;
  members: Member[];
  user: AppUser;
  activeEventId: string;
}) {
  const t = useT();
  const manage = can.manageProspects(user);
  const [view, setView] = React.useState<"table" | "board">("table");
  const [q, setQ] = React.useState("");
  // Empty = no filter. Ticking several is the whole point of this control:
  // "show me diterima AND ditolak" was impossible with a single-select.
  const [stage, setStage] = React.useState<Set<string>>(new Set());
  const sort = useMultiSort<ProspectSortKey>();
  const [bulkPending, startBulk] = React.useTransition();

  const filtered = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    return prospects.filter((p) => {
      if (stage.size > 0 && !stage.has(prospectStage(p))) return false;
      if (!query) return true;
      // Link names are searchable too: people look a prospect up by the
      // document they remember ("handbook HMTI"), not only by the org name.
      const linkText = (prospectLinks[p.id] ?? []).map((l) => `${l.label} ${l.url}`).join(" ");
      return `${p.org_name} ${p.campus} ${p.contact} ${p.pic} ${p.notes} ${linkText}`
        .toLowerCase()
        .includes(query);
    });
  }, [prospects, prospectLinks, q, stage]);

  // Counted before the stage filter, so ticking one stage does not blank out
  // the numbers next to the ones you have not ticked yet.
  const stageCounts = React.useMemo(() => {
    const by: Record<string, number> = {};
    for (const p of prospects) {
      const k = prospectStage(p);
      by[k] = (by[k] ?? 0) + 1;
    }
    return by;
  }, [prospects]);

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
      }
    };
    return sortRows(filtered, sort.rules, val);
  }, [filtered, sort.rules, stageOrder]);

  // Selection follows what is on screen; ticks survive a search (see use-multi-select).
  const sel = useMultiSelect(React.useMemo(() => rows.map((p) => p.id), [rows]));
  const hasFilters = q || stage.size > 0;
  const allSelected = sel.allVisibleSelected;
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
          <FilterMultiSelect
            label={t("Tahap")}
            allLabel={t("Semua Tahap")}
            unit={t("tahap")}
            icon={<Filter className="size-3.5" />}
            options={PIPELINE_STAGES.map((s) => ({
              value: s.key,
              label: t(s.label),
              color: s.color,
              count: stageCounts[s.key] ?? 0,
            }))}
            picked={stage}
            onChange={setStage}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStage(new Set()); }}>
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
              members={members}
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
                  <SortHead sort={sort} k="org_name">{t("Himpunan")}</SortHead>
                  <SortHead sort={sort} k="campus">{t("Kampus")}</SortHead>
                  <SortHead sort={sort} k="contact">{t("Kontak")}</SortHead>
                  <SortHead sort={sort} k="pic">{t("PIC")}</SortHead>
                  <SortHead sort={sort} k="stage">{t("Tahap")}</SortHead>
                  <TableHead className="min-w-[140px]">{t("Tautan")}</TableHead>
                  <TableHead className="min-w-[160px]">{t("Catatan")}</TableHead>
                  {manage && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow
                    key={p.id}
                    data-state={sel.selected.has(p.id) ? "selected" : undefined}
                    className={cn(p.done && "bg-emerald-50/40 dark:bg-emerald-500/[0.06]")}
                  >
                    {manage && (
                      <TableCell>
                        <Checkbox checked={sel.selected.has(p.id)} onCheckedChange={() => sel.toggle(p.id)} aria-label={t("Pilih")} />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {p.is_primary && (
                          <span title={t("Data utama Ormawa Visit")} className="text-amber-500">
                            <Star className="size-3.5 fill-amber-400" />
                          </span>
                        )}
                        {p.done && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                        <span className={cn(p.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                          {p.org_name || <span className="text-muted-foreground no-underline">-</span>}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.campus || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{p.contact || "-"}</TableCell>
                    <TableCell className="text-sm">{p.pic || "-"}</TableCell>
                    <TableCell><StageBadge p={p} /></TableCell>
                    <TableCell className="align-top">
                      <ProspectLinkChips links={prospectLinks[p.id] ?? []} />
                    </TableCell>
                    <TableCell className="max-w-[240px] align-top text-sm text-muted-foreground">
                      <ExpandableText text={p.notes} />
                    </TableCell>
                    {manage && (
                      <TableCell>
                        <ProspectActions prospect={p} prospectLinks={prospectLinks[p.id] ?? []} members={members} eventId={activeEventId} />
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
                        {manage && <ProspectActions prospect={p} prospectLinks={prospectLinks[p.id] ?? []} members={members} eventId={activeEventId} />}
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
                      {(prospectLinks[p.id]?.length ?? 0) > 0 && (
                        <div className="mt-2">
                          <ProspectLinkChips links={prospectLinks[p.id] ?? []} />
                        </div>
                      )}
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
