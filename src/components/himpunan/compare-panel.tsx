"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  Columns2, Loader2, Minus, Plus, Rows3, Scale, Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  createCompareEntryAction, createCompareSubjectAction, deleteCompareEntryAction,
  deleteCompareSubjectAction, updateCompareEntryAction,
} from "@/lib/actions/himpunan";
import { useT } from "@/lib/i18n/provider";
import { useSynced } from "@/lib/use-synced";
import { cn } from "@/lib/utils";
import type { CompareEntry, CompareSubject, Prospect } from "@/lib/types";

// ============================================================
// Compare: weighing up the associations that accepted our invitation.
//
// SUBJECTS ARE EXPLICIT. A comparison card only exists once someone presses
// "Buat perbandingan" and picks an association: it is not derived from the
// accepted list any more, so five acceptances no longer mean five blank cards,
// and a card can be removed (with all its assessments) when it is no longer
// wanted. The button only offers associations that accepted AND have not
// already been made, and the database enforces the no-duplicate rule too (0041).
//
// TWO VIEWS. "Kartu" is one card per association for filling data in. "Sanding"
// puts the assessments of two associations against each other, aspect by
// aspect, which is what "comparing" actually means and is the view the request
// asked for.
// ============================================================

type View = "cards" | "side";

export function ComparePanel({
  eventId, subjects, entries, accepted, canManage,
}: {
  eventId: string;
  subjects: CompareSubject[];
  entries: CompareEntry[];
  /** Prospects with DITERIMA, used to offer new subjects. */
  accepted: Prospect[];
  canManage: boolean;
}) {
  const t = useT();
  const [view, setView] = React.useState<View>("cards");
  const [addOpen, setAddOpen] = React.useState(false);

  const entriesBySubject = React.useMemo(() => {
    const map = new Map<string, CompareEntry[]>();
    for (const e of entries) {
      if (!e.subject_id) continue;
      map.set(e.subject_id, [...(map.get(e.subject_id) ?? []), e]);
    }
    return map;
  }, [entries]);

  // Which accepted associations have NOT been made into a subject yet. Matched
  // by prospect id first, then by name (an imported subject has no prospect).
  const madeProspectIds = new Set(subjects.map((s) => s.prospect_id).filter(Boolean));
  const madeNames = new Set(subjects.map((s) => s.org_name.trim().toLowerCase()));
  const available = accepted.filter(
    (p) => !madeProspectIds.has(p.id) && !madeNames.has((p.org_name ?? "").trim().toLowerCase()),
  );

  if (subjects.length === 0 && accepted.length === 0) {
    return (
      <EmptyState
        icon={<Scale />}
        title={t("Belum ada yang bisa dibandingkan")}
        description={t("Compare terisi setelah ada himpunan dengan Respons Mereka = DITERIMA di Reach & Offer, lalu kamu buat perbandingannya.")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {subjects.length
            ? `${subjects.length} ${t("himpunan dibandingkan.")} ${t("Catat aspek penilaian, indikator, kelebihan, dan kekurangan tiap himpunan.")}`
            : t("Belum ada perbandingan yang dibuat. Klik tombol untuk memilih himpunan yang menerima ajakan.")}
        </p>
        <div className="flex items-center gap-2">
          {subjects.length > 1 && (
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              {(["cards", "side"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                    view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "cards" ? <Rows3 className="size-4" /> : <Columns2 className="size-4" />}
                  <span className="hidden sm:inline">{v === "cards" ? t("Kartu") : t("Sanding")}</span>
                </button>
              ))}
            </div>
          )}
          {canManage && (
            <Button onClick={() => setAddOpen(true)} disabled={available.length === 0}>
              <Plus className="size-4" /> {t("Buat perbandingan")}
            </Button>
          )}
        </div>
      </div>

      {canManage && available.length === 0 && accepted.length > 0 && subjects.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {t("Semua himpunan yang menerima ajakan sudah dibuatkan perbandingannya.")}
        </p>
      )}

      {subjects.length === 0 ? (
        <EmptyState
          icon={<Scale />}
          title={t("Belum ada perbandingan")}
          description={
            available.length
              ? t("Klik “Buat perbandingan” lalu pilih himpunan yang ingin dinilai.")
              : t("Belum ada himpunan berstatus DITERIMA di Reach & Offer untuk dibandingkan.")
          }
        />
      ) : view === "cards" ? (
        <CardsView
          subjects={subjects}
          entriesBySubject={entriesBySubject}
          eventId={eventId}
          canManage={canManage}
        />
      ) : (
        <SideBySide subjects={subjects} entriesBySubject={entriesBySubject} />
      )}

      <AddSubjectDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={eventId}
        available={available}
      />
    </div>
  );
}

// ---------------- cards view (data entry) ----------------

function CardsView({
  subjects, entriesBySubject, eventId, canManage,
}: {
  subjects: CompareSubject[];
  entriesBySubject: Map<string, CompareEntry[]>;
  eventId: string;
  canManage: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {subjects.map((s) => (
        <SubjectCard
          key={s.id}
          subject={s}
          rows={entriesBySubject.get(s.id) ?? []}
          eventId={eventId}
          canManage={canManage}
        />
      ))}
    </div>
  );
}

function SubjectCard({
  subject, rows, eventId, canManage,
}: {
  subject: CompareSubject;
  rows: CompareEntry[];
  eventId: string;
  canManage: boolean;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const [delOpen, setDelOpen] = React.useState(false);

  function addRow() {
    start(async () => {
      const res = await createCompareEntryAction({
        event_id: eventId,
        subject_id: subject.id,
        prospect_id: subject.prospect_id,
        org_name: subject.org_name,
      });
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <h3 className="text-sm font-semibold">{subject.org_name || t("(tanpa nama)")}</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{rows.length} {t("aspek")}</span>
        {canManage && (
          <Button variant="ghost" size="icon-sm" onClick={() => setDelOpen(true)} title={t("Hapus perbandingan")}>
            <Trash2 className="size-4 text-danger" />
          </Button>
        )}
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
          <Button variant="ghost" size="sm" onClick={addRow} disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}{" "}
            {t("Tambah aspek")}
          </Button>
        </div>
      )}

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Hapus perbandingan?")}</DialogTitle>
            <DialogDescription>
              {t("Perbandingan")} &ldquo;{subject.org_name}&rdquo; {t("beserta seluruh penilaiannya akan dihapus dan tidak bisa dikembalikan.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => start(async () => {
                const res = await deleteCompareSubjectAction(subject.id);
                if (res.ok) { toast.success(t("Perbandingan dihapus")); setDelOpen(false); }
                else toast.error(res.error);
              })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} {t("Hapus")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EntryRow({ entry, canManage }: { entry: CompareEntry; canManage: boolean }) {
  const t = useT();
  const [pending, start] = React.useTransition();

  return (
    <div className="group grid gap-2 px-4 py-3">
      {entry.section && (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          {entry.section}
        </p>
      )}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Field entry={entry} field="aspect" label={t("Aspek Penilaian")} strong canManage={canManage} />
          <Field entry={entry} field="indicator" label={t("Indikator yang Dinilai")} canManage={canManage} />
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
          <Field entry={entry} field="plus" label={t("Plus / Kelebihan")} bare canManage={canManage} />
        </div>
        <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-2">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
            <Minus className="size-3" /> {t("Kekurangan")}
          </p>
          <Field entry={entry} field="minus" label={t("Minus / Kekurangan")} bare canManage={canManage} />
        </div>
      </div>
    </div>
  );
}

function Field({
  entry, field, label, strong = false, bare = false, canManage,
}: {
  entry: CompareEntry;
  field: "aspect" | "indicator" | "plus" | "minus";
  label: string;
  strong?: boolean;
  bare?: boolean;
  canManage: boolean;
}) {
  const [value, setValue] = useSynced(entry[field]);
  const save = () => {
    if (value === entry[field]) return;
    void updateCompareEntryAction(entry.id, { [field]: value }).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  };

  if (!canManage) {
    if (!entry[field]) return <span className="text-xs text-muted-foreground/50">-</span>;
    return (
      <p className={cn(
        "whitespace-pre-line break-words",
        strong ? "text-sm font-medium" : "text-xs",
        !bare && "text-muted-foreground",
        bare && "text-xs text-foreground",
      )}>
        {entry[field]}
      </p>
    );
  }

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

// ---------------- side-by-side view (reading) ----------------

/**
 * Two associations, aspect against aspect.
 *
 * This is the view the request called for: not two stacks of cards, but one row
 * per aspect with each association's plus and minus beside it. Rows are matched
 * on the aspect text (case-insensitively) so "Konsumsi" from one lines up with
 * "Konsumsi" from the other; anything that matches nothing gets its own row.
 */
function SideBySide({
  subjects, entriesBySubject,
}: {
  subjects: CompareSubject[];
  entriesBySubject: Map<string, CompareEntry[]>;
}) {
  const t = useT();
  const [leftId, setLeftId] = React.useState(subjects[0]?.id ?? "");
  const [rightId, setRightId] = React.useState(subjects[1]?.id ?? subjects[0]?.id ?? "");

  const left = subjects.find((s) => s.id === leftId) ?? subjects[0];
  const right = subjects.find((s) => s.id === rightId) ?? subjects[1] ?? subjects[0];
  const leftKey = left?.id ?? "";
  const rightKey = right?.id ?? "";

  // Pair the rows by aspect, keeping source order. A blank aspect never merges
  // (two empty aspects are not "the same aspect"), so it always stands alone.
  const pairs = React.useMemo(() => {
    const leftRows = entriesBySubject.get(leftKey) ?? [];
    const rightRows = entriesBySubject.get(rightKey) ?? [];
    const key = (e: CompareEntry) => e.aspect.trim().toLowerCase();
    const rightByAspect = new Map<string, CompareEntry>();
    for (const e of rightRows) if (key(e)) rightByAspect.set(key(e), e);
    const used = new Set<string>();
    const out: { aspect: string; l: CompareEntry | null; r: CompareEntry | null }[] = [];
    for (const l of leftRows) {
      const k = key(l);
      const match = k ? rightByAspect.get(k) : undefined;
      if (match) used.add(k);
      out.push({ aspect: l.aspect || t("(tanpa aspek)"), l, r: match ?? null });
    }
    for (const r of rightRows) {
      if (key(r) && used.has(key(r))) continue;
      out.push({ aspect: r.aspect || t("(tanpa aspek)"), l: null, r });
    }
    return out;
  }, [entriesBySubject, leftKey, rightKey, t]);

  if (subjects.length < 2) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <SubjectSelect label={t("Himpunan A")} value={left?.id} subjects={subjects} onChange={setLeftId} />
        <SubjectSelect label={t("Himpunan B")} value={right?.id} subjects={subjects} onChange={setRightId} />
      </div>

      {left?.id === right?.id ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {t("Pilih dua himpunan yang berbeda untuk membandingkannya berdampingan.")}
        </p>
      ) : pairs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {t("Kedua himpunan belum punya penilaian untuk disandingkan.")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[minmax(120px,1fr)_2fr_2fr] border-b border-border bg-muted/40 text-xs font-semibold">
            <div className="px-3 py-2">{t("Aspek")}</div>
            <div className="border-l border-border px-3 py-2 truncate">{left?.org_name}</div>
            <div className="border-l border-border px-3 py-2 truncate">{right?.org_name}</div>
          </div>
          <div className="divide-y divide-border">
            {pairs.map((row, i) => (
              <div key={i} className="grid grid-cols-[minmax(120px,1fr)_2fr_2fr]">
                <div className="px-3 py-2.5 text-xs font-medium">
                  {row.aspect}
                  {(row.l?.indicator || row.r?.indicator) && (
                    <p className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                      {row.l?.indicator || row.r?.indicator}
                    </p>
                  )}
                </div>
                <SideCell entry={row.l} />
                <SideCell entry={row.r} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SideCell({ entry }: { entry: CompareEntry | null }) {
  const t = useT();
  if (!entry) {
    return <div className="border-l border-border px-3 py-2.5 text-xs text-muted-foreground/40">-</div>;
  }
  return (
    <div className="space-y-1.5 border-l border-border px-3 py-2.5">
      {entry.plus && (
        <div className="flex gap-1.5 text-xs">
          <Plus className="mt-0.5 size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="whitespace-pre-line break-words">{entry.plus}</span>
        </div>
      )}
      {entry.minus && (
        <div className="flex gap-1.5 text-xs">
          <Minus className="mt-0.5 size-3 shrink-0 text-danger" />
          <span className="whitespace-pre-line break-words">{entry.minus}</span>
        </div>
      )}
      {!entry.plus && !entry.minus && (
        <span className="text-xs text-muted-foreground/40">{t("(kosong)")}</span>
      )}
    </div>
  );
}

function SubjectSelect({
  label, value, subjects, onChange,
}: {
  label: string;
  value?: string;
  subjects: CompareSubject[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.org_name || "(tanpa nama)"}</option>
        ))}
      </select>
    </label>
  );
}

// ---------------- add subject ----------------

function AddSubjectDialog({
  open, onOpenChange, eventId, available,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  available: Prospect[];
}) {
  const t = useT();
  const [pending, start] = React.useTransition();

  function add(prospect: Prospect) {
    start(async () => {
      const res = await createCompareSubjectAction({
        event_id: eventId,
        prospect_id: prospect.id,
        org_name: prospect.org_name,
      });
      if (res.ok) { toast.success(t("Perbandingan dibuat")); onOpenChange(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Buat perbandingan")}</DialogTitle>
          <DialogDescription>
            {t("Pilih himpunan yang menerima ajakan (Respons Mereka = DITERIMA) untuk dibuatkan penilaiannya.")}
          </DialogDescription>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("Tidak ada himpunan yang tersisa untuk dibuatkan perbandingan.")}
          </p>
        ) : (
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
            {available.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() => add(p)}
                className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm transition hover:bg-muted disabled:opacity-60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.org_name || t("(tanpa nama)")}</p>
                  {p.campus && <p className="truncate text-[11px] text-muted-foreground">{p.campus}</p>}
                </div>
                {p.campus && <Badge variant="outline" className="shrink-0 text-[10px]">{p.campus}</Badge>}
                <Plus className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Tutup")}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
