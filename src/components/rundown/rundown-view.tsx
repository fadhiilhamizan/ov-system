"use client";
import * as React from "react";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Loader2, StickyNote, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createRundownAction, updateRundownAction, deleteRundownAction, duplicateRundownAction } from "@/lib/actions/schedule";
import { cn } from "@/lib/utils";
import { isUrl } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
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
}: {
  items: RundownItem[];
  divisions: Division[];
  eventId: string;
  canManage: boolean;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();

  // Division columns = the event's divisions not excluded from the rundown.
  const cols = React.useMemo(
    () => divisions.filter((d) => !d.exclude_from_rundown).sort((a, b) => a.order - b.order),
    [divisions],
  );

  // Single rundown (versions were removed) — show every row, ordered by no.
  const activeVariant = "A";
  const list = React.useMemo(() => [...items].sort((a, b) => a.no - b.no), [items]);

  function save(id: string, patch: Partial<RundownItem>) {
    start(async () => {
      const res = await updateRundownAction(id, patch);
      if (!res.ok) toast.error(res.error);
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

  // Frozen (sticky) leftmost columns: No, Waktu, Durasi, Kegiatan.
  const FZ = "sticky !bg-card"; // opaque so scrolled content doesn't bleed through
  const noL = { left: 0 } as const;
  const timeL = { left: 40 } as const;
  const durL = { left: 136 } as const;
  const actL = { left: 200 } as const;
  const lastFrozen = "shadow-[2px_0_4px_-1px_rgba(0,0,0,0.12)]"; // edge of the frozen block

  return (
    <div className="space-y-3">
      {pending && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> {t("Menyimpan…")}
        </span>
      )}

      {/* border-separate (not collapse): sticky/frozen columns don't paint their
          background reliably under border-collapse, which made them look hollow. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={cn(th, FZ, "z-20 w-10 text-center")} style={noL}>{t("No")}</th>
              <th className={cn(th, FZ, "z-20 w-24")} style={timeL}>{t("Waktu")}</th>
              <th className={cn(th, FZ, "z-20 w-16")} style={durL}>{t("Durasi")}</th>
              <th className={cn(th, FZ, lastFrozen, "z-20 min-w-[180px]")} style={actL}>{t("Kegiatan")}</th>
              <th className={cn(th, "min-w-[120px]")}>MC</th>
              <th className={cn(th, "min-w-[140px]")}>{t("Kebutuhan Operator")}</th>
              {cols.map((d) => (
                <th key={d.key} className={cn(th, "min-w-[130px]")}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.short || d.name}
                  </span>
                </th>
              ))}
              <th className={cn(th, "min-w-[150px]")}>{t("Catatan")}</th>
              {canManage && <th className={cn(th, "w-10")} />}
            </tr>
          </thead>
          <tbody>
            {list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/20">
                <td className={cn(td, FZ, "z-10 text-center text-xs font-medium text-muted-foreground")} style={noL}>{item.no}</td>
                <td className={cn(td, FZ, "z-10")} style={timeL}>
                  <div className="flex flex-col">
                    <EditCell value={item.time_start} onSave={(v) => saveTime(item, "time_start", v)} placeholder="08.00" readOnly={!canManage} className="tabular-nums" />
                    <EditCell value={item.time_end} onSave={(v) => saveTime(item, "time_end", v)} placeholder="08.30" readOnly={!canManage} className="tabular-nums text-muted-foreground" />
                  </div>
                </td>
                <td className={cn(td, FZ, "z-10 px-2 py-1.5 text-xs text-muted-foreground tabular-nums")} style={durL} title={t("Otomatis dari waktu")}>
                  {item.duration || <span className="text-muted-foreground/50">–</span>}
                </td>
                <td className={cn(td, FZ, lastFrozen, "z-10")} style={actL}><EditCell value={item.activity} onSave={(v) => save(item.id, { activity: v })} placeholder={t("Kegiatan")} readOnly={!canManage} multiline className="font-medium" /></td>
                <td className={td}><EditCell value={item.mc} onSave={(v) => save(item.id, { mc: v })} readOnly={!canManage} multiline /></td>
                <td className={td}>
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
                </td>
                {cols.map((d) => (
                  <td key={d.key} className={td}>
                    <EditCell
                      value={item.division_jobs?.[d.key] ?? ""}
                      onSave={(v) => save(item.id, { division_jobs: { ...(item.division_jobs ?? {}), [d.key]: v } })}
                      readOnly={!canManage}
                      multiline
                    />
                  </td>
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
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="rounded p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                        title={t("Hapus")}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
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
