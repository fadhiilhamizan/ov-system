"use client";
import * as React from "react";
import {
  Plus, Trash2, BookMarked, ExternalLink, TriangleAlert, Search, Library, Check, ArrowUpDown, CalendarRange,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { isUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import {
  matchesSuperLink, sortSuperLinks, type SuperLinkOption, type SuperLinkSort,
} from "@/lib/super-link";
import type { TaskRef, TaskRefInput } from "@/lib/types";

/**
 * References a task USES: a handbook, a template, last year's proposal.
 *
 * Not the same thing as the result links above it in the form. Those are the
 * task's OUTPUT and get published TO Super Link. These point AT Super Link (or
 * anywhere else), and the same Super Link entry may be referenced by any number
 * of tasks, so nothing here ever writes to Super Link.
 *
 * When the entry a reference was picked from is DELETED (its task removed the
 * result, or the task itself went), the database keeps the last URL and name
 * on the reference and marks it `link_lost_at`. The editor and the table both
 * say so, and the row can be re-pointed with "Ganti" - the reference is never
 * silently left pointing at something nobody maintains any more.
 */

/** Row model. `key` is a stable client-side id for React lists. */
export interface DraftRef extends TaskRefInput {
  key: string;
}

export const toRefDraft = (r: TaskRef | TaskRefInput, i: number): DraftRef => ({
  id: r.id,
  url: r.url,
  label: r.label,
  link_id: r.link_id ?? null,
  link_lost: "link_lost_at" in r ? !!r.link_lost_at : !!(r as TaskRefInput).link_lost,
  key: r.id ?? `new-${i}-${Math.random().toString(36).slice(2)}`,
});

export const newRefDraft = (): DraftRef => ({
  key: `new-${Math.random().toString(36).slice(2)}`,
  url: "",
  label: "",
  link_id: null,
  link_lost: false,
});

/** True when every filled row has a valid URL and no URL repeats. */
export function validateRefs(refs: DraftRef[]): string | null {
  const filled = refs.filter((r) => r.url.trim());
  if (filled.some((r) => !isUrl(r.url))) return "invalid";
  const seen = new Set<string>();
  for (const r of filled) {
    const k = r.url.trim().toLowerCase().replace(/\/+$/, "");
    if (seen.has(k)) return "duplicate";
    seen.add(k);
  }
  return null;
}

/** Drop empty rows before sending; the form always keeps one blank row around. */
export const cleanRefs = (refs: DraftRef[]): TaskRefInput[] =>
  refs
    .filter((r) => r.url.trim())
    .map(({ key: _key, ...rest }) => {
      void _key;
      return rest;
    });

const normUrl = (u: string) => u.trim().toLowerCase().replace(/\/+$/, "");

/** More than this and the list asks for a narrower search instead of rendering hundreds of rows. */
const SHOW_MAX = 80;

function SuperLinkPicker({
  links, taken, onPick, trigger,
}: {
  links: SuperLinkOption[];
  /** Normalised URLs already on this task, shown ticked and not pickable again. */
  taken: Set<string>;
  onPick: (l: SuperLinkOption) => void;
  trigger: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [events, setEvents] = React.useState<Set<string>>(new Set());
  const [sort, setSort] = React.useState<SuperLinkSort>("event-desc");

  // Editions that actually have entries, newest first, for the filter.
  const eventOptions = React.useMemo(() => {
    const seen = new Map<string, { title: string; rank: string; count: number }>();
    for (const l of links) {
      if (!l.event_id) continue;
      const cur = seen.get(l.event_id);
      if (cur) cur.count += 1;
      else seen.set(l.event_id, { title: l.event_title || l.event_id, rank: l.event_rank, count: 1 });
    }
    return [...seen.entries()]
      .sort((a, b) => (a[1].rank < b[1].rank ? 1 : a[1].rank > b[1].rank ? -1 : 0))
      .map(([value, v]) => ({ value, label: v.title, count: v.count }));
  }, [links]);

  const matched = React.useMemo(
    () => sortSuperLinks(
      links.filter((l) => (events.size === 0 || (!!l.event_id && events.has(l.event_id))) && matchesSuperLink(l, q)),
      sort,
    ),
    [links, events, q, sort],
  );
  const shown = matched.slice(0, SHOW_MAX);
  const grouped = sort === "event-desc" || sort === "event-asc";

  function reset(v: boolean) {
    setOpen(v);
    if (!v) setQ("");
  }

  return (
    <Popover open={open} onOpenChange={reset}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] p-2">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Cari nama, divisi, atau Ormawa Visit…")}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          <FilterMultiSelect
            label={t("Ormawa Visit")}
            allLabel={t("Semua Ormawa Visit")}
            icon={<CalendarRange className="size-3.5" />}
            options={eventOptions}
            picked={events}
            onChange={setEvents}
            className="w-full"
          />
          <Select value={sort} onValueChange={(v) => setSort(v as SuperLinkSort)}>
            <SelectTrigger className="h-auto min-h-8 text-xs" aria-label={t("Urutkan")}>
              <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="event-desc">{t("Ormawa Visit terbaru")}</SelectItem>
              <SelectItem value="event-asc">{t("Ormawa Visit terlama")}</SelectItem>
              <SelectItem value="name-asc">{t("Nama A-Z")}</SelectItem>
              <SelectItem value="name-desc">{t("Nama Z-A")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {shown.map((l, i) => {
            const header = grouped && (i === 0 || shown[i - 1].event_id !== l.event_id);
            const already = taken.has(normUrl(l.url));
            return (
              <React.Fragment key={l.id}>
                {header && (
                  <p className="sticky top-0 z-10 bg-popover px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {l.event_title || t("Tanpa Ormawa Visit")}
                  </p>
                )}
                <button
                  type="button"
                  disabled={already}
                  onClick={() => { onPick(l); reset(false); }}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-muted disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{l.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[
                        !grouped && l.event_title,
                        l.division_name,
                        l.section,
                      ].filter(Boolean).join(" · ") || l.url}
                    </span>
                  </span>
                  {already && <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-label={t("Sudah dipakai")} />}
                </button>
              </React.Fragment>
            );
          })}
          {shown.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {t("Tidak ada tautan yang cocok.")}
            </p>
          )}
        </div>
        <p className="mt-1.5 border-t border-border pt-1.5 text-[10px] text-muted-foreground">
          {matched.length > SHOW_MAX
            ? `${SHOW_MAX} / ${matched.length} ${t("tautan. Persempit pencarian untuk melihat sisanya.")}`
            : `${matched.length} ${t("tautan")}`}
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function RefsEditor({
  refs, onChange, links, readOnly,
}: {
  refs: DraftRef[];
  onChange: (next: DraftRef[]) => void;
  /** Super Link entries offered by the picker. */
  links: SuperLinkOption[];
  readOnly?: boolean;
}) {
  const t = useT();
  const problem = validateRefs(refs);
  const taken = React.useMemo(
    () => new Set(refs.filter((r) => r.url.trim()).map((r) => normUrl(r.url))),
    [refs],
  );

  const update = (key: string, patch: Partial<DraftRef>) =>
    onChange(refs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  /** A picked entry as a reference. The label starts as the entry's name, and
   *  the server stores it empty while it still equals that name, so renaming
   *  the entry later renames the reference too. */
  const fromEntry = (l: SuperLinkOption): Partial<DraftRef> => ({
    url: l.url, label: l.name, link_id: l.id, link_lost: false,
  });

  if (readOnly) {
    const filled = refs.filter((r) => r.url.trim());
    if (!filled.length) return null;
    return (
      <div className="grid gap-1.5">
        <Label>{t("Referensi")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {filled.map((r) => (
            <a
              key={r.key}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs transition hover:bg-muted"
            >
              {r.link_lost
                ? <TriangleAlert className="size-3.5 text-amber-500" />
                : <BookMarked className="size-3.5 text-muted-foreground" />}
              {r.label || r.url}
              <ExternalLink className="size-3 text-muted-foreground" />
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{t("Referensi (opsional)")}</Label>
        <SuperLinkPicker
          links={links}
          taken={taken}
          onPick={(l) =>
            onChange([
              // Replace a trailing blank row rather than leaving a gap.
              ...refs.filter((r) => r.url.trim()),
              { ...newRefDraft(), ...fromEntry(l), key: `new-${l.id}-${Math.random().toString(36).slice(2)}` },
              newRefDraft(),
            ])
          }
          trigger={
            <Button type="button" variant="outline" size="sm">
              <Library className="size-3.5" /> {t("Ambil dari Super Link")}
            </Button>
          }
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t("Bahan rujukan untuk mengerjakan tugas ini. Boleh diketik manual atau diambil dari Super Link, dan satu tautan Super Link boleh dipakai banyak tugas.")}
      </p>

      {refs.map((r) => (
        <div
          key={r.key}
          className={cn(
            "grid gap-1.5 rounded-lg border p-2",
            r.link_lost ? "border-amber-400/70 bg-amber-50/60 dark:border-amber-500/50 dark:bg-amber-500/5" : "border-border",
          )}
        >
          <div className="flex items-center gap-1.5">
            <Input
              value={r.url}
              // Typing a URL makes the reference the user's own: it no longer
              // follows a Super Link entry, and a "source deleted" warning
              // about the old one would now be about a different link.
              onChange={(e) => update(r.key, { url: e.target.value, link_id: null, link_lost: false })}
              placeholder="https://…"
              inputMode="url"
              className={cn("h-8 text-xs", r.url.trim() && !isUrl(r.url) && "border-danger")}
            />
            {/* The shortcut the request asked for: open the reference straight
                from the form, without saving first. */}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!isUrl(r.url)}
              title={t("Buka tautan")}
              onClick={() => window.open(r.url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title={t("Hapus referensi")}
              onClick={() => onChange(refs.filter((x) => x.key !== r.key))}
            >
              <Trash2 className="size-4 text-danger" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              value={r.label}
              onChange={(e) => update(r.key, { label: e.target.value })}
              placeholder={t("Nama referensi (opsional)")}
              className="h-8 text-xs"
            />
            {r.link_id && (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                {t("Super Link")}
              </span>
            )}
          </div>
          {r.link_lost && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-amber-700 dark:text-amber-400">
              <TriangleAlert className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                {t("Sumbernya sudah dihapus dari Super Link. Alamat terakhirnya tetap disimpan; pilih penggantinya bila ada.")}
              </span>
              <SuperLinkPicker
                links={links}
                taken={taken}
                onPick={(l) => update(r.key, fromEntry(l))}
                trigger={
                  <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]">
                    <Library className="size-3" /> {t("Ganti")}
                  </Button>
                }
              />
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...refs, newRefDraft()])}>
        <Plus className="size-3.5" /> {t("Tambah referensi")}
      </Button>

      {problem && (
        <p className="inline-flex items-center gap-1.5 text-xs text-danger">
          <TriangleAlert className="size-3.5" />
          {problem === "invalid"
            ? t("Ada tautan yang belum diawali http:// atau https://.")
            : t("Ada referensi yang sama lebih dari sekali.")}
        </p>
      )}
    </div>
  );
}
