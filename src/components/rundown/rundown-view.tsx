"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  Clock, Plus, Trash2, StickyNote, Copy, ExternalLink, ChevronsDownUp, Unlink, GripVertical, X,
} from "lucide-react";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent, type DraggableAttributes, type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { useMultiSelect } from "@/lib/use-multi-select";
import { mergedRowIds } from "@/lib/rundown-reorder";
import { cn } from "@/lib/utils";
import { computeDuration } from "@/lib/rundown-time";
import { useCellDraft } from "@/lib/use-cell-draft";
import { isUrl } from "@/lib/format";
import {
  MERGE_MC, MERGE_OPERATOR, columnRoles, canMergeDownIn, mergedDown, splitCell,
  type CellRole,
} from "@/lib/rundown-merge";
import { useT } from "@/lib/i18n/provider";
import { DivisionColumnFilter } from "./division-column-filter";
import { useRundownQueue } from "./use-rundown-queue";
import { LocalSaveStatus } from "@/components/ui/local-save-status";
import type { Division, RundownItem } from "@/lib/types";

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
  const d = useCellDraft(value, onSave);
  if (readOnly) {
    return <div className={cn("whitespace-pre-line px-2 py-1.5 text-xs", className)}>{value || <span className="text-muted-foreground/50">–</span>}</div>;
  }
  const cls = cn(
    "w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs outline-none transition hover:border-border focus:border-primary focus:bg-card",
    className,
  );
  return multiline ? (
    <textarea rows={1} value={d.v} placeholder={placeholder} onChange={(e) => d.set(e.target.value)} onFocus={d.onFocus} onBlur={d.onBlur} className={cn(cls, "autosize min-h-[2rem] leading-snug")} />
  ) : (
    <input value={d.v} placeholder={placeholder} onChange={(e) => d.set(e.target.value)} onFocus={d.onFocus} onBlur={d.onBlur} className={cls} />
  );
}

function NoteCell({ value, onSave, readOnly }: { value: string; onSave: (v: string) => void; readOnly?: boolean }) {
  const t = useT();
  const d = useCellDraft(value, onSave);
  const [min, setMin] = React.useState(5);
  const [open, setOpen] = React.useState(false);
  if (readOnly) {
    return <div className="whitespace-pre-line px-2 py-1.5 text-xs">{value || <span className="text-muted-foreground/50">–</span>}</div>;
  }
  function quick(kind: "cepat" | "lama") {
    const s = `${kind === "cepat" ? t("Terlalu cepat") : t("Terlalu lama")} ${min} ${t("menit")}`;
    d.replace(s);
    setOpen(false);
  }
  return (
    <div className="flex items-start gap-1">
      <textarea
        rows={1}
        value={d.v}
        placeholder={t("Catatan…")}
        onChange={(e) => d.set(e.target.value)}
        onFocus={d.onFocus}
        onBlur={d.onBlur}
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

/**
 * Renders one mergeable cell, or nothing when another row's run covers it.
 * Returns `null` so the caller omits the <td> entirely - that is what makes
 * the rowSpan above actually occupy the space.
 *
 * MUST stay at module scope. It used to be declared inside RundownView, which
 * made it a BRAND NEW component type on every render: React cannot know the two
 * are the same thing, so it unmounted and remounted every merged cell instead of
 * updating it. Each of those cells holds an <EditCell> with its own input state,
 * so the remount threw away the caret position and any half-typed text - and it
 * fired constantly, because the save status line alone re-renders this component
 * three times per save (idle -> saving -> saved -> idle).
 */
function MergeableCell({
  role,
  canGrow,
  canManage,
  onSplit,
  onMerge,
  tdClass,
  t,
  children,
  className,
}: {
  role: CellRole;
  canGrow: boolean;
  canManage: boolean;
  onSplit: () => void;
  onMerge: () => void;
  tdClass: string;
  t: (s: string) => string;
  children: React.ReactNode;
  className?: string;
}) {
  if (role.kind === "covered") return null;
  const span = role.kind === "origin" ? role.span : 1;
  return (
    <td
      className={cn(tdClass, "group/cell relative", span > 1 && "bg-muted/25", className)}
      rowSpan={span > 1 ? span : undefined}
    >
      {children}
      {canManage && (span > 1 || canGrow) && (
        <div className="absolute bottom-0.5 right-0.5 flex gap-0.5 opacity-0 transition group-hover/cell:opacity-100 focus-within:opacity-100">
          {span > 1 && (
            <button
              type="button"
              onClick={onSplit}
              title={t("Pisahkan sel")}
              className="rounded bg-card/90 p-0.5 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
            >
              <Unlink className="size-3" />
            </button>
          )}
          {canGrow && (
            <button
              type="button"
              onClick={onMerge}
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

interface DragHandle {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
}

/**
 * One draggable row. Module scope for the same reason as MergeableCell: a
 * component declared inside RundownView would be a new type every render and
 * remount every input in the row.
 *
 * A row inside a merged run cannot be picked up (`draggable` false), but it
 * stays a drop target so a free row can still be dropped right above or below
 * a run; dropping one INSIDE a run is refused by checkMove.
 */
function SortableRow({
  id, draggable, children,
}: {
  id: string;
  draggable: boolean;
  children: (handle: DragHandle) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: { draggable: !draggable, droppable: false },
  });
  return (
    <tr
      ref={setNodeRef}
      // Translate only: a scaled <tr> squashes the rowspan cells around it.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("hover:bg-muted/20", isDragging && "relative z-30 bg-card opacity-90 shadow-lg")}
    >
      {children({ attributes, listeners })}
    </tr>
  );
}

export function RundownView({
  items,
  divisions,
  eventId,
  canManage,
  canDelete,
  importButton,
}: {
  items: RundownItem[];
  divisions: Division[];
  eventId: string;
  /** "limited" access and up: add rows, edit cells, duplicate. */
  canManage: boolean;
  /** "full" access only: remove rows. */
  canDelete: boolean;
  /** The "Import XLSX" entry point, shown beside "Tambah baris". */
  importButton?: React.ReactNode;
}) {
  const t = useT();

  // Division columns = the event's divisions not excluded from the rundown.
  // Divisions marked "tidak diikutsertakan pada rundown" (Sekretaris,
  // Bendahara, …) never have a column, so they are not offered in the filter
  // either - there would be nothing to show or hide.
  const allCols = React.useMemo(
    () => divisions.filter((d) => !d.exclude_from_rundown).sort((a, b) => a.order - b.order),
    [divisions],
  );
  /** Ticked divisions. Empty = show them all, which is the default. */
  const [focus, setFocus] = React.useState<Set<string>>(new Set());
  // Everything below renders from `cols`, so narrowing it here is all the
  // filter has to do - including the merge bookkeeping.
  // A ticked key whose division no longer exists matches nothing; ignore it,
  // or a stale tick would hide every division column.
  const liveFocus = React.useMemo(
    () => new Set([...focus].filter((k) => allCols.some((d) => d.key === k))),
    [focus, allCols],
  );
  const cols = React.useMemo(
    () => (liveFocus.size ? allCols.filter((d) => liveFocus.has(d.key)) : allCols),
    [allCols, liveFocus],
  );

  // Single rundown: migration 0035 merged the old A/B versions and deleted
  // every B row, so there is nothing to choose between. The column still
  // exists for older rows and `createRundown` defaults it.
  //
  // Edits are local-first: `list` already includes anything typed, added,
  // merged or removed that the server has not confirmed yet, and the queue
  // saves it in the background (see use-rundown-queue.ts).
  const q = useRundownQueue(items, eventId);
  const list = q.list;

  // Multi-select for deleting several rows at once (full access only).
  const sel = useMultiSelect(React.useMemo(() => list.map((r) => r.id), [list]));
  const [confirmBulk, setConfirmBulk] = React.useState(false);
  function bulkDelete() {
    const ids = sel.ids;
    setConfirmBulk(false);
    sel.clear();
    q.remove(ids);
  }

  // Rows in a merged run (any column, hidden ones included) stay put.
  const locked = React.useMemo(() => mergedRowIds(list), [list]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const res = q.move(String(active.id), String(over.id));
    if (res === "merged-row") toast.error(t("Baris yang digabung tidak bisa dipindahkan. Pisahkan selnya dulu."));
    else if (res === "inside-merge") toast.error(t("Baris tidak bisa disisipkan di tengah sel yang digabung."));
  }

  function save(id: string, patch: Partial<RundownItem>) {
    const { division_jobs: _j, id: _i, ...fields } = patch;
    void _j; void _i;
    q.edit(id, fields);
  }
  /** Save ONE division's cell. Only this key travels; the merge onto
   *  `division_jobs` happens server-side against the live row (see A2 note on
   *  the cell below). */
  function saveDivisionJob(id: string, divisionKey: string, value: string) {
    q.edit(id, {}, { [divisionKey]: value });
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

  if (!items.length && !canManage) {
    return <EmptyState icon={<Clock />} title={t("Belum ada rundown")} description={t("Rundown acara belum tersedia untuk Ormawa Visit ini.")} />;
  }

  const th = "border-b border-border bg-muted/40 px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground";
  const td = "border-b border-border/60 align-top";

  // Merged cells: one value spanning several time slots, so "one activity that
  // runs for three slots" reads differently from "three identical activities".
  // Catatan is excluded on purpose - it is per-row commentary.
  const mergeCols = [MERGE_MC, MERGE_OPERATOR, ...cols.map((d) => d.key)];
  const roles = Object.fromEntries(mergeCols.map((c) => [c, columnRoles(list, c)]));

  /** Grow this column's run by one row, or split it back into single rows. */
  function setMerge(index: number, col: string, mode: "merge" | "split") {
    const item = list[index];
    if (!item) return;
    save(item.id, { merges: mode === "merge" ? mergedDown(item, col) : splitCell(item, col) });
  }

  /** Bound once per render and handed to `MergeableCell`, which lives at module
   *  scope - see the note on that component for why it must not be nested. */
  const cellProps = (index: number, col: string) => ({
    role: roles[col][index],
    canGrow: canMergeDownIn(roles[col], index),
    canManage,
    onSplit: () => setMerge(index, col, "split"),
    onMerge: () => setMerge(index, col, "merge"),
    tdClass: td,
    t,
  });

  // Frozen (sticky) leftmost columns: No, Waktu, Durasi, Kegiatan.
  //
  // The sticky `left` offsets MUST equal the real rendered column widths, so
  // the widths are pinned by a <colgroup> + `table-fixed` rather than left to
  // the automatic table algorithm. (With `table-layout: auto` the browser sizes
  // columns by content, the offsets drifted out of alignment, and the gaps let
  // scrolled-under content show through the frozen block - the "hollow" look.)
  // The first column holds the drag handle and/or the selection tick, and is
  // only there for roles that can use one of them.
  const selW = (canManage ? 24 : 0) + (canDelete ? 24 : 0) + (canManage || canDelete ? 12 : 0);
  const W = { sel: selW, no: 44, time: 96, dur: 72, act: 220, mc: 140, opr: 160, div: 150, note: 180, actions: 44 };
  const selL = { left: 0 } as const;
  const noL = { left: W.sel } as const;
  const timeL = { left: W.sel + W.no } as const;
  const durL = { left: W.sel + W.no + W.time } as const;
  const actL = { left: W.sel + W.no + W.time + W.dur } as const;
  // Below the minimum the table scrolls horizontally; above it the unsized
  // Catatan column absorbs the slack, so the frozen offsets never shift.
  const minTableWidth =
    W.sel + W.no + W.time + W.dur + W.act + W.mc + W.opr + cols.length * W.div + W.note +
    (canManage ? W.actions : 0);

  const FZ = "sticky !bg-card"; // opaque so scrolled content doesn't bleed through
  const lastFrozen = "md:shadow-[2px_0_4px_-1px_rgba(0,0,0,0.12)]"; // edge of the frozen block
  // On a phone the four frozen columns (~430px) are wider than the screen, so
  // only the tick/handle and No stay put there; Waktu/Durasi/Kegiatan freeze
  // from md up. The No column draws the edge shadow on a phone instead.
  const FZ_MD = "md:sticky !bg-card";
  const noEdge = "max-md:shadow-[2px_0_4px_-1px_rgba(0,0,0,0.12)]";

  return (
    <div className="space-y-3">
      {/* Saving is ambient: a quiet line of text, never a spinner, and nothing
          on the table is ever disabled while it happens. */}
      <div className="flex flex-wrap items-center gap-2">
        <DivisionColumnFilter options={allCols} focus={liveFocus} onChange={setFocus} />
        {liveFocus.size > 0 && (
          <span className="text-xs text-muted-foreground">
            {cols.length} {t("dari")} {allCols.length} {t("kolom divisi")}
          </span>
        )}
        {canManage && list.length > 1 && (
          <span className="text-xs text-muted-foreground">
            {t("Seret ikon untuk memindahkan baris; jam menyesuaikan dan durasi tiap baris tetap.")}
          </span>
        )}
        <div className="ml-auto flex h-4 items-center">
          <LocalSaveStatus status={q.status} />
        </div>
      </div>

      {canDelete && sel.count > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{sel.count} {t("dipilih")}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={() => setConfirmBulk(true)} aria-keyshortcuts="Shift+Delete" data-shortcut-label={t("Hapus baris terpilih")}>
              <Trash2 className="size-4" /> {t("Hapus")}
            </Button>
            <Button variant="ghost" size="sm" onClick={sel.clear} aria-keyshortcuts="Escape" data-shortcut-label={t("Batalkan pilihan")}><X className="size-4" /> {t("Batal")}</Button>
          </div>
        </div>
      )}
      <Dialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Hapus baris rundown?")}</DialogTitle>
            <DialogDescription>
              {sel.count} {t("baris akan dihapus permanen. Sel yang digabung ikut menyesuaikan.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button variant="destructive" onClick={bulkDelete}>{t("Hapus")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* border-separate (not collapse): sticky/frozen columns don't paint their
          background reliably under border-collapse, which made them look hollow. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-sm"
          style={{ minWidth: minTableWidth }}
        >
          {/* Pins every column width so the sticky offsets above stay exact.
              Catatan is deliberately unsized: it soaks up any leftover space. */}
          <colgroup>
            {W.sel > 0 && <col style={{ width: W.sel }} />}
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
              {W.sel > 0 && (
                <th className={cn(th, FZ, "z-20")} style={selL}>
                  {canDelete && (
                    <span className={cn("flex", canManage ? "justify-end pr-0.5" : "justify-center")}>
                      <Checkbox
                        checked={sel.allVisibleSelected}
                        onCheckedChange={sel.toggleAll}
                        aria-label={t("Pilih semua")}
                        disabled={!list.length}
                      />
                    </span>
                  )}
                </th>
              )}
              <th className={cn(th, FZ, noEdge, "z-20 text-center")} style={noL}>{t("No")}</th>
              <th className={cn(th, FZ_MD, "z-20")} style={timeL}>{t("Waktu")}</th>
              <th className={cn(th, FZ_MD, "z-20")} style={durL}>{t("Durasi")}</th>
              <th className={cn(th, FZ_MD, lastFrozen, "z-20")} style={actL}>{t("Kegiatan")}</th>
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
          <SortableContext items={list.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <tbody>
            {list.map((item, rowIndex) => {
              // Derive at RENDER time, not only on blur: rows that already had
              // a start+end (seeded, imported, or edited before auto-duration
              // existed) never got a stored value and showed an empty cell.
              const duration = computeDuration(item.time_start, item.time_end) ?? item.duration;
              const merged = locked.has(item.id);
              return (
              <SortableRow key={item.id} id={item.id} draggable={canManage && !merged}>
                {(handle) => (<>
                {W.sel > 0 && (
                  <td className={cn(td, FZ, "z-10", sel.selected.has(item.id) && "!bg-accent")} style={selL}>
                    <div className="flex items-center justify-center gap-1 pt-1.5">
                      {canManage && (merged ? (
                        <span
                          title={t("Baris yang digabung tidak bisa dipindahkan")}
                          className="flex cursor-not-allowed items-center justify-center p-0.5 text-muted-foreground/30"
                        >
                          <GripVertical className="size-4" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          {...handle.attributes}
                          {...handle.listeners}
                          aria-label={t("Geser untuk mengurutkan")}
                          className="flex cursor-grab touch-none items-center justify-center rounded p-0.5 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
                        >
                          <GripVertical className="size-4" />
                        </button>
                      ))}
                      {canDelete && (
                        <Checkbox
                          checked={sel.selected.has(item.id)}
                          onCheckedChange={() => sel.toggle(item.id)}
                          aria-label={t("Pilih baris")}
                        />
                      )}
                    </div>
                  </td>
                )}
                <td className={cn(td, FZ, noEdge, "z-10 text-center text-xs font-medium text-muted-foreground")} style={noL}>{item.no}</td>
                <td className={cn(td, FZ_MD, "z-10")} style={timeL}>
                  <div className="flex flex-col">
                    <EditCell value={item.time_start} onSave={(v) => saveTime(item, "time_start", v)} placeholder="08.00" readOnly={!canManage} className="tabular-nums" />
                    <EditCell value={item.time_end} onSave={(v) => saveTime(item, "time_end", v)} placeholder="08.30" readOnly={!canManage} className="tabular-nums text-muted-foreground" />
                  </div>
                </td>
                <td className={cn(td, FZ_MD, "z-10 px-2 py-1.5 text-xs text-muted-foreground tabular-nums")} style={durL} title={t("Otomatis dari waktu")}>
                  {duration || <span className="text-muted-foreground/50">–</span>}
                </td>
                <td className={cn(td, FZ_MD, lastFrozen, "z-10")} style={actL}><EditCell value={item.activity} onSave={(v) => save(item.id, { activity: v })} placeholder={t("Kegiatan")} readOnly={!canManage} multiline className="font-medium" /></td>
                <MergeableCell {...cellProps(rowIndex, MERGE_MC)}>
                  <EditCell value={item.mc} onSave={(v) => save(item.id, { mc: v })} readOnly={!canManage} multiline />
                </MergeableCell>
                <MergeableCell {...cellProps(rowIndex, MERGE_OPERATOR)}>
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
                  <MergeableCell key={d.key} {...cellProps(rowIndex, d.key)}>
                    <EditCell
                      value={item.division_jobs?.[d.key] ?? ""}
                      // Sends only THIS division's key. It used to send the
                      // whole division_jobs object rebuilt from `item`, which
                      // is the row as it was last rendered: editing a second
                      // division before the first save came back reverted the
                      // first one, silently. The merge happens on the server
                      // against the live row now.
                      onSave={(v) => saveDivisionJob(item.id, d.key, v)}
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
                        onClick={() => q.duplicate(item.id)}
                        className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title={t("Duplikat")}
                      >
                        <Copy className="size-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => q.remove(item.id)}
                          className="rounded p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                          title={t("Hapus")}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
                </>)}
              </SortableRow>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={7 + cols.length + (canManage ? 1 : 0) + (W.sel > 0 ? 1 : 0)} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("Belum ada baris rundown.")}
                </td>
              </tr>
            )}
          </tbody>
          </SortableContext>
        </table>
        </DndContext>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={q.addRow} aria-keyshortcuts="N">
            <Plus className="size-4" /> {t("Tambah baris")}
          </Button>
          {importButton}
        </div>
      )}
    </div>
  );
}
