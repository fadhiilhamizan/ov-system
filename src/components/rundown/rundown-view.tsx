"use client";
import * as React from "react";
import { toast } from "sonner";
import { Clock, Plus, Trash2, StickyNote, Copy, ExternalLink, ChevronsDownUp, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createRundownAction, updateRundownAction, deleteRundownAction, duplicateRundownAction } from "@/lib/actions/schedule";
import { cn } from "@/lib/utils";
import { isUrl } from "@/lib/format";
import {
  MERGE_MC, MERGE_OPERATOR, columnRoles, canMergeDown, mergedDown, splitCell,
} from "@/lib/rundown-merge";
import { useT } from "@/lib/i18n/provider";
import { useAutosave } from "@/lib/use-autosave";
import { SaveIndicator } from "@/components/ui/save-indicator";
import { DivisionColumnFilter } from "./division-column-filter";
import type { Division, RundownItem } from "@/lib/types";

/** Keep local input state in sync when the server value changes (no effect). */
function useSynced(value: string): [string, React.Dispatch<React.SetStateAction<string>>] {
  const [v, setV] = React.useState(value);
  const [prev, setPrev] = React.useState(value);
  if (prev !== value) {
    setPrev(value);
    setV(value);
  }
  return [v, setV];
}

/** Parse a clock string ("07.30", "07:30", "0730", "7") to minutes-of-day. */
function parseTime(s: string): number | null {
  const str = (s ?? "").trim();
  if (!str) return null;
  const m = str.match(/^(\d{1,2})\s*[.:h ]?\s*(\d{2})$/);
  if (m) {
    const h = +m[1], min = +m[2];
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }
  const only = str.match(/^(\d{1,2})$/);
  if (only && +only[1] <= 23) return +only[1] * 60;
  return null;
}

/** Format a minute count to "45'", "1j", or "1j 30'". */
function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}j ${m}'`;
  if (h) return `${h}j`;
  return `${m}'`;
}

/** Duration between two clock strings, or null if not derivable. */
function computeDuration(start: string, end: string): string | null {
  const a = parseTime(start), b = parseTime(end);
  if (a === null || b === null) return null;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60; // crosses midnight
  return formatDuration(diff);
}

function EditCell({
  value, onSave, placeholder, readOnly, className, multiline,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  multiline?: boolean;
}) {
  const [v, setV] = useSynced(value);
  if (readOnly) {
    return <div className={cn("whitespace-pre-line px-2 py-1.5 text-xs", className)}>{value || <span className="text-muted-foreground/50">–</span>}</div>;
  }
  const commit = () => {
    if (v !== value) onSave(v);
  };
  const cls = cn(
    "w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs outline-none transition hover:border-border focus:border-primary focus:bg-card",
    className,
  );
  return multiline ? (
    <textarea rows={1} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} className={cn(cls, "autosize min-h-[2rem] leading-snug")} />
  ) : (
    <input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} className={cls} />
  );
}

function NoteCell({ value, onSave, readOnly }: { value: string; onSave: (v: string) => void; readOnly?: boolean }) {
  const t = useT();
  const [v, setV] = useSynced(value);
  const [min, setMin] = React.useState(5);
  const [open, setOpen] = React.useState(false);
  if (readOnly) {
    return <div className="whitespace-pre-line px-2 py-1.5 text-xs">{value || <span className="text-muted-foreground/50">–</span>}</div>;
  }
  function quick(kind: "cepat" | "lama") {
    const s = `${kind === "cepat" ? t("Terlalu cepat") : t("Terlalu lama")} ${min} ${t("menit")}`;
    setV(s);
    onSave(s);
    setOpen(false);
  }
  return (
    <div className="flex items-start gap-1">
      <textarea
        rows={1}
        value={v}
        placeholder={t("Catatan…")}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onSave(v)}
        className="autosize min-h-[2rem] w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs leading-snug outline-none transition hover:border-border focus:border-primary focus:bg-card"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="mt-1 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" title={t("Catatan cepat")}>
            <StickyNote className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 space-y-2 p-3">
          <p className="text-xs font-medium">{t("Catatan cepat evaluasi")}</p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">{t("Menit")}</label>
            <input
              type="number"
              min={0}
              value={min}
              onChange={(e) => setMin(Math.max(0, Number(e.target.value)))}
              className="h-8 w-16 rounded-md border border-input bg-card px-2 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => quick("cepat")}>{t("Terlalu cepat")}</Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => quick("lama")}>{t("Terlalu lama")}</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function RundownView({
  items,
  divisions,
  eventId,
  canManage,
  canDelete,
}: {
  items: RundownItem[];
  divisions: Division[];
  eventId: string;
  /** "limited" access and up: add rows, edit cells, duplicate. */
  canManage: boolean;
  /** "full" access only: remove rows. */
  canDelete: boolean;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();

  // Division columns = the event's divisions not excluded from the rundown.
  // Divisions marked "tidak diikutsertakan pada rundown" (Sekretaris,
  // Bendahara, …) never have a column, so they are not offered in the filter
  // either — there would be nothing to show or hide.
  const allCols = React.useMemo(
    () => divisions.filter((d) => !d.exclude_from_rundown).sort((a, b) => a.order - b.order),
    [divisions],
  );
  /** Ticked divisions. Empty = show them all, which is the default. */
  const [focus, setFocus] = React.useState<Set<string>>(new Set());
  // Everything below renders from `cols`, so narrowing it here is all the
  // filter has to do — including the merge bookkeeping.
  const cols = React.useMemo(
    () => (focus.size ? allCols.filter((d) => focus.has(d.key)) : allCols),
    [allCols, focus],
  );

  // Single rundown (versions were removed) — show every row, ordered by no.
  const activeVariant = "A";
  const list = React.useMemo(() => [...items].sort((a, b) => a.no - b.no), [items]);

  // Inline cell edits autosave on blur; the SaveIndicator shows "Tersimpan".
  const autosave = useAutosave();
  function save(id: string, patch: Partial<RundownItem>) {
    autosave.run(async () => {
      const res = await updateRundownAction(id, patch);
      if (!res.ok) toast.error(res.error);
      return res;
    });
  }
  /** Save a time field and auto-recompute the duration when both ends parse. */
  function saveTime(item: RundownItem, field: "time_start" | "time_end", value: string) {
    const patch: Partial<RundownItem> = { [field]: value };
    const start = field === "time_start" ? value : item.time_start;
    const end = field === "time_end" ? value : item.time_end;
    const dur = computeDuration(start, end);
    if (dur !== null) patch.duration = dur;
    save(item.id, patch);
  }
  function addRow() {
    start(async () => {
      // New activity starts where the last one ended (chain the schedule).
      const prevEnd = list.length ? list[list.length - 1].time_end : "";
      const res = await createRundownAction({ event_id: eventId, variant: activeVariant, activity: "", time_start: prevEnd });
      if (!res.ok) toast.error(res.error);
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteRundownAction(id);
      if (res.ok) toast.success(t("Agenda dihapus")); else toast.error(res.error);
    });
  }
  function duplicate(id: string) {
    start(async () => {
      const res = await duplicateRundownAction(id);
      if (res.ok) toast.success(t("Agenda diduplikat")); else toast.error(res.error);
    });
  }

  if (!items.length && !canManage) {
    return <EmptyState icon={<Clock />} title={t("Belum ada rundown")} description={t("Rundown acara belum tersedia untuk Ormawa Visit ini.")} />;
  }

  const th = "border-b border-border bg-muted/40 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const td = "border-b border-border/60 align-top";

  // Merged cells: one value spanning several time slots, so "one activity that
  // runs for three slots" reads differently from "three identical activities".
  // Catatan is excluded on purpose — it is per-row commentary.
  const mergeCols = [MERGE_MC, MERGE_OPERATOR, ...cols.map((d) => d.key)];
  const roles = Object.fromEntries(mergeCols.map((c) => [c, columnRoles(list, c)]));

  /** Grow this column's run by one row, or split it back into single rows. */
  function setMerge(index: number, col: string, mode: "merge" | "split") {
    const item = list[index];
    if (!item) return;
    save(item.id, { merges: mode === "merge" ? mergedDown(item, col) : splitCell(item, col) });
  }

  /**
   * Renders one mergeable cell, or nothing when another row's run covers it.
   * Returns `null` so the caller omits the <td> entirely — that is what makes
   * the rowSpan above actually occupy the space.
   */
  function MergeableCell({
    index,
    col,
    children,
    className,
  }: {
    index: number;
    col: string;
    children: React.ReactNode;
    className?: string;
  }) {
    const role = roles[col][index];
    if (role.kind === "covered") return null;
    const span = role.kind === "origin" ? role.span : 1;
    const canGrow = canMergeDown(list, col, index);
    return (
      <td
        className={cn(td, "group/cell relative", span > 1 && "bg-muted/25", className)}
        rowSpan={span > 1 ? span : undefined}
      >
        {children}
        {canManage && (span > 1 || canGrow) && (
          <div className="absolute bottom-0.5 right-0.5 flex gap-0.5 opacity-0 transition group-hover/cell:opacity-100 focus-within:opacity-100">
            {span > 1 && (
              <button
                type="button"
                onClick={() => setMerge(index, col, "split")}
                title={t("Pisahkan sel")}
                className="rounded bg-card/90 p-0.5 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
              >
                <Unlink className="size-3" />
              </button>
            )}
            {canGrow && (
              <button
                type="button"
                onClick={() => setMerge(index, col, "merge")}
                title={t("Gabung dengan baris di bawah")}
                className="rounded bg-card/90 p-0.5 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
              >
                <ChevronsDownUp className="size-3" />
              </button>
            )}
          </div>
        )}
      </td>
    );
  }

  // Frozen (sticky) leftmost columns: No, Waktu, Durasi, Kegiatan.
  //
  // The sticky `left` offsets MUST equal the real rendered column widths, so
  // the widths are pinned by a <colgroup> + `table-fixed` rather than left to
  // the automatic table algorithm. (With `table-layout: auto` the browser sizes
  // columns by content, the offsets drifted out of alignment, and the gaps let
  // scrolled-under content show through the frozen block — the "hollow" look.)
  const W = { no: 44, time: 96, dur: 72, act: 220, mc: 140, opr: 160, div: 150, note: 180, actions: 44 };
  const noL = { left: 0 } as const;
  const timeL = { left: W.no } as const;
  const durL = { left: W.no + W.time } as const;
  const actL = { left: W.no + W.time + W.dur } as const;
  // Below the minimum the table scrolls horizontally; above it the unsized
  // Catatan column absorbs the slack, so the frozen offsets never shift.
  const minTableWidth =
    W.no + W.time + W.dur + W.act + W.mc + W.opr + cols.length * W.div + W.note +
    (canManage ? W.actions : 0);

  const FZ = "sticky !bg-card"; // opaque so scrolled content doesn't bleed through
  const lastFrozen = "shadow-[2px_0_4px_-1px_rgba(0,0,0,0.12)]"; // edge of the frozen block

  return (
    <div className="space-y-3">
      {/* Autosave (inline cell edits) and structural ops (add/remove/duplicate)
          each get their own cue: the badge for the former, toasts for the latter. */}
      <div className="flex flex-wrap items-center gap-2">
        <DivisionColumnFilter options={allCols} focus={focus} onChange={setFocus} />
        {focus.size > 0 && (
          <span className="text-xs text-muted-foreground">
            {cols.length} {t("dari")} {allCols.length} {t("kolom divisi")}
          </span>
        )}
        <div className="ml-auto flex h-4 items-center">
          <SaveIndicator status={autosave.status} />
          {pending && autosave.status === "idle" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {t("Menyimpan…")}
            </span>
          )}
        </div>
      </div>

      {/* border-separate (not collapse): sticky/frozen columns don't paint their
          background reliably under border-collapse, which made them look hollow. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-sm"
          style={{ minWidth: minTableWidth }}
        >
          {/* Pins every column width so the sticky offsets above stay exact.
              Catatan is deliberately unsized: it soaks up any leftover space. */}
          <colgroup>
            <col style={{ width: W.no }} />
            <col style={{ width: W.time }} />
            <col style={{ width: W.dur }} />
            <col style={{ width: W.act }} />
            <col style={{ width: W.mc }} />
            <col style={{ width: W.opr }} />
            {cols.map((d) => (
              <col key={d.key} style={{ width: W.div }} />
            ))}
            <col />
            {canManage && <col style={{ width: W.actions }} />}
          </colgroup>
          <thead>
            <tr>
              <th className={cn(th, FZ, "z-20 text-center")} style={noL}>{t("No")}</th>
              <th className={cn(th, FZ, "z-20")} style={timeL}>{t("Waktu")}</th>
              <th className={cn(th, FZ, "z-20")} style={durL}>{t("Durasi")}</th>
              <th className={cn(th, FZ, lastFrozen, "z-20")} style={actL}>{t("Kegiatan")}</th>
              <th className={th}>MC</th>
              <th className={th}>{t("Kebutuhan Operator")}</th>
              {cols.map((d) => (
                <th key={d.key} className={th}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="truncate">{d.short || d.name}</span>
                  </span>
                </th>
              ))}
              <th className={th}>{t("Catatan")}</th>
              {canManage && <th className={th} />}
            </tr>
          </thead>
          <tbody>
            {list.map((item, rowIndex) => {
              // Derive at RENDER time, not only on blur: rows that already had
              // a start+end (seeded, imported, or edited before auto-duration
              // existed) never got a stored value and showed an empty cell.
              const duration = computeDuration(item.time_start, item.time_end) ?? item.duration;
              return (
              <tr key={item.id} className="hover:bg-muted/20">
                <td className={cn(td, FZ, "z-10 text-center text-xs font-medium text-muted-foreground")} style={noL}>{item.no}</td>
                <td className={cn(td, FZ, "z-10")} style={timeL}>
                  <div className="flex flex-col">
                    <EditCell value={item.time_start} onSave={(v) => saveTime(item, "time_start", v)} placeholder="08.00" readOnly={!canManage} className="tabular-nums" />
                    <EditCell value={item.time_end} onSave={(v) => saveTime(item, "time_end", v)} placeholder="08.30" readOnly={!canManage} className="tabular-nums text-muted-foreground" />
                  </div>
                </td>
                <td className={cn(td, FZ, "z-10 px-2 py-1.5 text-xs text-muted-foreground tabular-nums")} style={durL} title={t("Otomatis dari waktu")}>
                  {duration || <span className="text-muted-foreground/50">–</span>}
                </td>
                <td className={cn(td, FZ, lastFrozen, "z-10")} style={actL}><EditCell value={item.activity} onSave={(v) => save(item.id, { activity: v })} placeholder={t("Kegiatan")} readOnly={!canManage} multiline className="font-medium" /></td>
                <MergeableCell index={rowIndex} col={MERGE_MC}>
                  <EditCell value={item.mc} onSave={(v) => save(item.id, { mc: v })} readOnly={!canManage} multiline />
                </MergeableCell>
                <MergeableCell index={rowIndex} col={MERGE_OPERATOR}>
                  <div className="flex items-start gap-1">
                    <EditCell value={item.operator ?? ""} onSave={(v) => save(item.id, { operator: v })} readOnly={!canManage} multiline className="flex-1" />
                    {isUrl(item.operator ?? "") && (
                      <a
                        href={(item.operator ?? "").trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t("Buka tautan")}
                        className="mt-1 shrink-0 rounded p-1 text-primary transition hover:bg-muted"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </MergeableCell>
                {cols.map((d) => (
                  <MergeableCell key={d.key} index={rowIndex} col={d.key}>
                    <EditCell
                      value={item.division_jobs?.[d.key] ?? ""}
                      onSave={(v) => save(item.id, { division_jobs: { ...(item.division_jobs ?? {}), [d.key]: v } })}
                      readOnly={!canManage}
                      multiline
                    />
                  </MergeableCell>
                ))}
                <td className={td}><NoteCell value={item.keterangan} onSave={(v) => save(item.id, { keterangan: v })} readOnly={!canManage} /></td>
                {canManage && (
                  <td className={cn(td, "text-center")}>
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => duplicate(item.id)}
                        className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title={t("Duplikat")}
                      >
                        <Copy className="size-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => remove(item.id)}
                          className="rounded p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                          title={t("Hapus")}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={7 + cols.length + (canManage ? 1 : 0)} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("Belum ada baris rundown.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <Button variant="outline" size="sm" onClick={addRow} disabled={pending}>
          <Plus className="size-4" /> {t("Tambah baris")}
        </Button>
      )}
    </div>
  );
}
