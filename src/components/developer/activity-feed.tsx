"use client";
import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, Download, Loader2, Search, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { EmptyState } from "@/components/ui/empty";
import { pruneActivityAction } from "@/lib/actions/developer";
import { ago, full, verb } from "./developer-view";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/types";

// ============================================================
// "Who changed what, and when."
//
// The rows come from a database TRIGGER, not from the app, so this shows writes
// that bypassed the UI entirely - which is the whole point, given the anon key
// is public and PostgREST can be called directly.
//
// An UPDATE row carries only the columns that actually changed, so the diff is
// the record rather than a reconstruction. INSERT and DELETE carry the whole
// row, because for those "what changed" is "all of it" and a deleted row is
// otherwise gone for good.
// ============================================================

const ACTION_META: Record<string, { label: string; className: string }> = {
  insert: { label: "Tambah", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  update: { label: "Ubah", className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  delete: { label: "Hapus", className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
};

/** Columns nobody needs to see diffed - they change on every single write. */
const NOISE = new Set(["updated_at", "created_at"]);

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  const [q, setQ] = React.useState("");
  const [tables, setTables] = React.useState<Set<string>>(new Set());
  const [actions, setActions] = React.useState<Set<string>>(new Set());
  const [actors, setActors] = React.useState<Set<string>>(new Set());
  const [pending, start] = React.useTransition();

  // Options are derived from what is loaded, so the filters only ever offer
  // values that would actually match something.
  const tableOptions = React.useMemo(() => countBy(entries, (e) => e.table_name), [entries]);
  const actorOptions = React.useMemo(
    () => countBy(entries, (e) => e.actor_email || "(tanpa email)"),
    [entries],
  );

  const rows = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    return entries.filter((e) => {
      if (tables.size && !tables.has(e.table_name)) return false;
      if (actions.size && !actions.has(e.action)) return false;
      if (actors.size && !actors.has(e.actor_email || "(tanpa email)")) return false;
      if (!query) return true;
      return `${e.label} ${e.actor_email} ${e.table_name} ${e.row_id}`.toLowerCase().includes(query);
    });
  }, [entries, q, tables, actions, actors]);

  const hasFilters = q || tables.size || actions.size || actors.size;

  function exportJson() {
    // Straight to a file rather than a report screen: when you are chasing
    // something across days, the useful next step is grep, not more UI.
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function prune() {
    if (!confirm("Hapus jejak audit yang lebih tua dari 90 hari?")) return;
    start(async () => {
      const res = await pruneActivityAction(90);
      if (res.ok) toast.success(`${res.count} baris jejak dihapus`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul, email, id…" className="pl-9" />
        </div>
        <FilterMultiSelect
          label="Tabel" allLabel="Semua tabel" unit="tabel"
          options={tableOptions} picked={tables} onChange={setTables}
        />
        <FilterMultiSelect
          label="Aksi" allLabel="Semua aksi" unit="aksi"
          options={["insert", "update", "delete"].map((a) => ({
            value: a,
            label: ACTION_META[a].label,
            count: entries.filter((e) => e.action === a).length,
          }))}
          picked={actions} onChange={setActions}
        />
        <FilterMultiSelect
          label="Akun" allLabel="Semua akun" unit="akun"
          options={actorOptions} picked={actors} onChange={setActors}
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); setTables(new Set()); setActions(new Set()); setActors(new Set()); }}>
            <X className="size-4" /> Reset
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportJson} disabled={!rows.length}>
            <Download className="size-4" /> Ekspor
          </Button>
          <Button variant="outline" size="sm" onClick={prune} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Pangkas 90 hari
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{rows.length} dari {entries.length} catatan</p>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Tidak ada catatan"
          description="Belum ada perubahan yang cocok. Jejak audit mulai terisi begitu migrasi 0039 dijalankan dan ada data yang diubah."
        />
      ) : (
        <div className="space-y-1.5">
          {rows.map((e) => <Row key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  );
}

function Row({ entry }: { entry: ActivityEntry }) {
  const [open, setOpen] = React.useState(false);
  const meta = ACTION_META[entry.action] ?? ACTION_META.update;
  const changedKeys = Object.keys(entry.changed ?? {}).filter((k) => !NOISE.has(k));
  const detail = entry.changed ?? entry.snapshot;

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-muted/50"
      >
        <span className={cn("mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase", meta.className)}>
          {meta.label}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">
            <span className="font-medium">{entry.actor_email || "(tanpa email)"}</span>{" "}
            <span className="text-muted-foreground">{verb(entry.action)}</span>{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{entry.table_name}</code>
            {entry.label && <> &ldquo;{entry.label}&rdquo;</>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <time dateTime={entry.at} title={full(entry.at)}>{ago(entry.at)}</time>
            {entry.actor_role && <Badge variant="outline" className="px-1 py-0 text-[10px]">{entry.actor_role}</Badge>}
            {changedKeys.length > 0 && <span>{changedKeys.length} kolom berubah: {changedKeys.slice(0, 4).join(", ")}{changedKeys.length > 4 ? "…" : ""}</span>}
            {entry.event_id && <span className="font-mono">{entry.event_id}</span>}
          </span>
        </span>
        {detail && (
          <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
        )}
      </button>

      {open && detail && (
        <div className="border-t border-border bg-muted/30 px-3 py-2.5">
          {entry.changed ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-1 pr-3 font-medium">Kolom</th>
                  <th className="pb-1 pr-3 font-medium">Dari</th>
                  <th className="pb-1 font-medium">Jadi</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {Object.entries(entry.changed).map(([key, v]) => (
                  <tr key={key} className="border-t border-border/60">
                    <td className="py-1 pr-3 font-mono text-[11px]">{key}</td>
                    <td className="max-w-[240px] break-words py-1 pr-3 text-muted-foreground line-through decoration-muted-foreground/40">{render(v.dari)}</td>
                    <td className="max-w-[240px] break-words py-1">{render(v.jadi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
              {JSON.stringify(entry.snapshot, null, 2)}
            </pre>
          )}
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            id {entry.row_id || "-"} · {full(entry.at)}
          </p>
        </div>
      )}
    </Card>
  );
}

/** Values come back as JSON, so a string arrives quoted and null is a real
 *  value worth naming rather than rendering as an empty cell. */
function render(v: unknown): string {
  if (v === null) return "(kosong)";
  if (v === undefined) return "-";
  if (typeof v === "string") return v || "(kosong)";
  return JSON.stringify(v);
}

function countBy(entries: ActivityEntry[], key: (e: ActivityEntry) => string) {
  const map = new Map<string, number>();
  for (const e of entries) {
    const k = key(e);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: value, count }));
}
