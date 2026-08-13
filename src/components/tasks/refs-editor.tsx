"use client";
import * as React from "react";
import { Plus, Trash2, BookMarked, ExternalLink, TriangleAlert, Search, Library } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { LinkItem, TaskRefInput } from "@/lib/types";

/**
 * References a task USES: a handbook, a template, last year's proposal.
 *
 * Not the same thing as the result links above it in the form. Those are the
 * task's OUTPUT and get published TO Super Link. These point AT Super Link (or
 * anywhere else), and the same Super Link entry may be referenced by any number
 * of tasks, so nothing here ever writes to Super Link.
 */

/** Row model. `key` is a stable client-side id for React lists. */
export interface DraftRef extends TaskRefInput {
  key: string;
}

export const toRefDraft = (r: TaskRefInput, i: number): DraftRef => ({
  ...r,
  key: r.id ?? `new-${i}-${Math.random().toString(36).slice(2)}`,
});

export const newRefDraft = (): DraftRef => ({
  key: `new-${Math.random().toString(36).slice(2)}`,
  url: "",
  label: "",
  link_id: null,
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

function SuperLinkPicker({
  links, onPick,
}: {
  links: LinkItem[];
  onPick: (l: LinkItem) => void;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const shown = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    const withUrl = links.filter((l) => l.url);
    if (!query) return withUrl.slice(0, 50);
    return withUrl
      .filter((l) => `${l.name} ${l.section} ${l.division} ${l.note}`.toLowerCase().includes(query))
      .slice(0, 50);
  }, [links, q]);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Library className="size-3.5" /> {t("Ambil dari Super Link")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Cari tautan…")}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="max-h-60 space-y-0.5 overflow-y-auto">
          {shown.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => { onPick(l); setOpen(false); setQ(""); }}
              className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left transition hover:bg-muted"
            >
              <span className="w-full truncate text-xs font-medium">{l.name}</span>
              <span className="w-full truncate text-[11px] text-muted-foreground">
                {[l.section, l.division].filter(Boolean).join(" · ") || l.url}
              </span>
            </button>
          ))}
          {shown.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {t("Tidak ada tautan yang cocok.")}
            </p>
          )}
        </div>
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
  links: LinkItem[];
  readOnly?: boolean;
}) {
  const t = useT();
  const problem = validateRefs(refs);

  const update = (key: string, patch: Partial<DraftRef>) =>
    onChange(refs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

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
              <BookMarked className="size-3.5 text-muted-foreground" />
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
          onPick={(l) =>
            onChange([
              // Replace a trailing blank row rather than leaving a gap.
              ...refs.filter((r) => r.url.trim()),
              { key: `new-${l.id}-${Math.random().toString(36).slice(2)}`, url: l.url, label: l.name, link_id: l.id },
              newRefDraft(),
            ])
          }
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t("Bahan rujukan untuk mengerjakan tugas ini. Boleh diketik manual atau diambil dari Super Link, dan satu tautan Super Link boleh dipakai banyak tugas.")}
      </p>

      {refs.map((r) => (
        <div key={r.key} className="grid gap-1.5 rounded-lg border border-border p-2">
          <div className="flex items-center gap-1.5">
            <Input
              value={r.url}
              onChange={(e) => update(r.key, { url: e.target.value, link_id: null })}
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
