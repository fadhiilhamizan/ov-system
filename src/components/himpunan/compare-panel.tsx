"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Minus, Plus, Scale, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import {
  createCompareEntryAction, deleteCompareEntryAction, updateCompareEntryAction,
} from "@/lib/actions/himpunan";
import { useT } from "@/lib/i18n/provider";
import { useSynced } from "@/lib/use-synced";
import { cn } from "@/lib/utils";
import type { CompareEntry, Prospect } from "@/lib/types";

// ============================================================
// Compare: choosing between the associations that said yes.
//
// GATED ON PURPOSE. The tab only becomes usable once MORE THAN ONE association
// has DITERIMA in Reach & Offer, because with a single acceptance there is
// nothing to weigh up. The gate is explained rather than hidden: a tab that
// silently does nothing reads as a bug.
//
// Each row is one assessment: aspect, indicator, the plus and the minus.
// Grouped per association so the two columns you actually read (kelebihan and
// kekurangan) sit side by side, which is the whole point of the screen.
// ============================================================

export function ComparePanel({
  eventId, entries, accepted, canManage,
}: {
  eventId: string;
  entries: CompareEntry[];
  accepted: Prospect[];
  canManage: boolean;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  if (accepted.length < 2) {
    return (
      <EmptyState
        icon={<Scale />}
        title={t("Belum ada yang bisa dibandingkan")}
        description={
          accepted.length === 0
            ? t("Compare terbuka setelah ada lebih dari satu himpunan dengan Respons Mereka = DITERIMA di Reach & Offer.")
            : t("Baru satu himpunan yang menerima ajakan, jadi belum ada pilihan untuk ditimbang. Compare terbuka setelah ada dua atau lebih.")
        }
      />
    );
  }

  const shown = picked.size ? accepted.filter((p) => picked.has(p.id)) : accepted;

  function addRow(prospect: Prospect) {
    start(async () => {
      const res = await createCompareEntryAction({
        event_id: eventId,
        prospect_id: prospect.id,
        org_name: prospect.org_name,
      });
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {accepted.length} {t("himpunan menerima ajakan pada Ormawa Visit ini.")}{" "}
          {t("Catat aspek penilaian, indikator, kelebihan, dan kekurangan tiap himpunan untuk membandingkannya.")}
        </p>
        <FilterMultiSelect
          label={t("Himpunan")}
          allLabel={t("Semua himpunan")}
          unit={t("himpunan")}
          options={accepted.map((p) => ({
            value: p.id,
            label: p.org_name || t("(tanpa nama)"),
            count: entries.filter((e) => e.prospect_id === p.id).length,
          }))}
          picked={picked}
          onChange={setPicked}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {shown.map((p) => {
          const rows = entries.filter((e) => e.prospect_id === p.id);
          return (
            <Card key={p.id} className="overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                <h3 className="text-sm font-semibold">{p.org_name || t("(tanpa nama)")}</h3>
                {p.campus && <Badge variant="outline" className="text-[10px]">{p.campus}</Badge>}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {rows.length} {t("aspek")}
                </span>
              </div>

              {rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {canManage ? t("Belum ada penilaian. Tambah aspek untuk mulai.") : t("Belum ada penilaian.")}
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {rows.map((row) => (
                    <EntryRow key={row.id} entry={row} canManage={canManage} />
                  ))}
                </div>
              )}

              {canManage && (
                <div className="border-t border-border px-3 py-2">
                  <Button variant="ghost" size="sm" onClick={() => addRow(p)} disabled={pending}>
                    {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}{" "}
                    {t("Tambah aspek")}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Rows whose prospect is gone (deleted, or its response changed) would
          otherwise vanish silently along with whatever was written in them. */}
      <Orphans entries={entries} accepted={accepted} canManage={canManage} />
    </div>
  );
}

function EntryRow({ entry, canManage }: { entry: CompareEntry; canManage: boolean }) {
  const t = useT();
  const [pending, start] = React.useTransition();

  return (
    <div className="group grid gap-2 px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Field entry={entry} field="aspect" label={t("Aspek Penilaian")} strong />
          <Field entry={entry} field="indicator" label={t("Indikator yang Dinilai")} />
        </div>
        {canManage && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              const res = await deleteCompareEntryAction(entry.id);
              if (!res.ok) toast.error(res.error);
            })}
            className="shrink-0 rounded p-1 text-muted-foreground/50 opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus:opacity-100"
            title={t("Hapus aspek")}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-2">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            <Plus className="size-3" /> {t("Kelebihan")}
          </p>
          <Field entry={entry} field="plus" label={t("Plus / Kelebihan")} bare />
        </div>
        <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-2">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
            <Minus className="size-3" /> {t("Kekurangan")}
          </p>
          <Field entry={entry} field="minus" label={t("Minus / Kekurangan")} bare />
        </div>
      </div>
    </div>
  );
}

function Field({
  entry, field, label, strong = false, bare = false,
}: {
  entry: CompareEntry;
  field: "aspect" | "indicator" | "plus" | "minus";
  label: string;
  strong?: boolean;
  bare?: boolean;
}) {
  const [value, setValue] = useSynced(entry[field]);
  // Read-only mode is decided by the parent through `canManage`, but the field
  // itself only needs to know whether it can be edited, which the disabled
  // attribute already expresses. Editing saves on blur, like the FGD grid.
  const save = () => {
    if (value === entry[field]) return;
    void updateCompareEntryAction(entry.id, { [field]: value }).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  };

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      rows={1}
      placeholder={label}
      aria-label={label}
      className={cn(
        "autosize w-full resize-none border-0 bg-transparent p-0 outline-none placeholder:text-muted-foreground/50 focus:ring-0",
        strong ? "text-sm font-medium" : "text-xs",
        !bare && "text-muted-foreground",
        bare && "text-xs text-foreground",
      )}
    />
  );
}

/**
 * Assessments whose association is no longer in the accepted list.
 *
 * They are shown, not hidden: the row still holds whatever someone wrote, and
 * an association can drop off this list simply because its response was edited.
 * Silently swallowing the notes would look like data loss.
 */
function Orphans({
  entries, accepted, canManage,
}: {
  entries: CompareEntry[];
  accepted: Prospect[];
  canManage: boolean;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const ids = new Set(accepted.map((p) => p.id));
  const orphans = entries.filter((e) => !e.prospect_id || !ids.has(e.prospect_id));
  if (!orphans.length) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 p-4">
      <h3 className="text-sm font-semibold">{t("Penilaian tanpa himpunan aktif")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("Himpunannya sudah tidak berstatus DITERIMA di Reach & Offer, atau prospeknya dihapus. Isinya disimpan di sini supaya tidak hilang begitu saja.")}
      </p>
      <ul className="mt-3 space-y-2">
        {orphans.map((e) => (
          <li key={e.id} className="flex items-start gap-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{e.org_name || t("(tanpa nama)")}</p>
              <p className="text-muted-foreground">
                {[e.aspect, e.indicator].filter(Boolean).join(" - ") || t("(kosong)")}
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => {
                  const res = await deleteCompareEntryAction(e.id);
                  if (!res.ok) toast.error(res.error);
                })}
                className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                title={t("Hapus")}
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
