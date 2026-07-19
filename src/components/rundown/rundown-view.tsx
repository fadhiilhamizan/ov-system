"use client";
import * as React from "react";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Loader2, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createRundownAction, updateRundownAction, deleteRundownAction } from "@/lib/actions/schedule";
import { cn } from "@/lib/utils";
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
    <textarea rows={1} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} className={cls} />
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
        className="w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs outline-none transition hover:border-border focus:border-primary focus:bg-card"
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

  const variants = React.useMemo(() => {
    const set = [...new Set(items.map((i) => i.variant))].sort();
    return set.length ? set : ["A"];
  }, [items]);
  const [variant, setVariant] = React.useState(variants[0] ?? "A");
  const activeVariant = variants.includes(variant) ? variant : variants[0] ?? "A";
  const list = items.filter((i) => i.variant === activeVariant).sort((a, b) => a.no - b.no);

  function save(id: string, patch: Partial<RundownItem>) {
    start(async () => {
      const res = await updateRundownAction(id, patch);
      if (!res.ok) toast.error(res.error);
    });
  }
  function addRow() {
    start(async () => {
      const res = await createRundownAction({ event_id: eventId, variant: activeVariant, activity: "" });
      if (!res.ok) toast.error(res.error);
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteRundownAction(id);
      if (res.ok) toast.success(t("Agenda dihapus")); else toast.error(res.error);
    });
  }

  if (!items.length && !canManage) {
    return <EmptyState icon={<Clock />} title={t("Belum ada rundown")} description={t("Rundown acara belum tersedia untuk Ormawa Visit ini.")} />;
  }

  const th = "border-b border-border bg-muted/40 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const td = "border-b border-border/60 align-top";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {variants.length > 1 ? (
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {variants.map((vr) => (
              <button
                key={vr}
                onClick={() => setVariant(vr)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition",
                  activeVariant === vr ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("Versi")} {vr}
              </button>
            ))}
          </div>
        ) : <div />}
        {pending && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> {t("Menyimpan…")}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={cn(th, "w-10 text-center")}>{t("No")}</th>
              <th className={cn(th, "w-24")}>{t("Waktu")}</th>
              <th className={cn(th, "w-16")}>{t("Durasi")}</th>
              <th className={cn(th, "min-w-[160px]")}>{t("Kegiatan")}</th>
              {cols.map((d) => (
                <th key={d.key} className={cn(th, "min-w-[120px]")}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.short || d.name}
                  </span>
                </th>
              ))}
              <th className={cn(th, "min-w-[110px]")}>MC</th>
              <th className={cn(th, "min-w-[130px]")}>{t("Kebutuhan Operator")}</th>
              <th className={cn(th, "min-w-[150px]")}>{t("Catatan")}</th>
              {canManage && <th className={cn(th, "w-10")} />}
            </tr>
          </thead>
          <tbody>
            {list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/20">
                <td className={cn(td, "text-center text-xs font-medium text-muted-foreground")}>{item.no}</td>
                <td className={td}>
                  <div className="flex flex-col">
                    <EditCell value={item.time_start} onSave={(v) => save(item.id, { time_start: v })} placeholder="08.00" readOnly={!canManage} className="tabular-nums" />
                    <EditCell value={item.time_end} onSave={(v) => save(item.id, { time_end: v })} placeholder="08.30" readOnly={!canManage} className="tabular-nums text-muted-foreground" />
                  </div>
                </td>
                <td className={td}><EditCell value={item.duration} onSave={(v) => save(item.id, { duration: v })} placeholder="30'" readOnly={!canManage} /></td>
                <td className={td}><EditCell value={item.activity} onSave={(v) => save(item.id, { activity: v })} placeholder={t("Kegiatan")} readOnly={!canManage} multiline className="font-medium" /></td>
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
                <td className={td}><EditCell value={item.mc} onSave={(v) => save(item.id, { mc: v })} readOnly={!canManage} multiline /></td>
                <td className={td}><EditCell value={item.operator ?? ""} onSave={(v) => save(item.id, { operator: v })} readOnly={!canManage} multiline /></td>
                <td className={td}><NoteCell value={item.keterangan} onSave={(v) => save(item.id, { keterangan: v })} readOnly={!canManage} /></td>
                {canManage && (
                  <td className={cn(td, "text-center")}>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="rounded p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                      title={t("Hapus")}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5 + cols.length + (canManage ? 1 : 0)} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("Belum ada baris rundown untuk versi ini.")}
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
