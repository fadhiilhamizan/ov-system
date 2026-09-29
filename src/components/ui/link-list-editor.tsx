"use client";
import * as React from "react";
import { Plus, Trash2, Link2, ExternalLink, TriangleAlert, Library } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

// ============================================================
// A repeatable list of links that can each be published to Super Link.
//
// Extracted from the task form when Reach & Offer needed the same thing: a
// prospect regularly sends several files (handbook, org profile, the proposal
// they mailed back), and both places want identical behaviour - a URL, an
// optional name, and a tick that mirrors the link into Super Link and
// remembers which row it made.
//
// Only the COPY differs between the two, plus one rule: a task result is
// ALWAYS published and must be named (`alwaysPublish`), because Super Link is
// where the next task goes looking for it. Prospect links stay optional.
// ============================================================

/** Row model - `key` is a stable client-side id for React lists. */
export interface DraftLink {
  id?: string;
  key: string;
  url: string;
  label: string;
  in_super_link: boolean;
  /** The Super Link entry this row owns, if published. Display only: the
   *  server tracks ownership itself and never takes this from a client. */
  link_id?: string | null;
}

export const toDraft = (
  l: { id?: string; url: string; label: string; in_super_link: boolean; link_id?: string | null },
  i: number,
): DraftLink => ({
  id: l.id,
  url: l.url,
  label: l.label,
  in_super_link: l.in_super_link,
  link_id: l.link_id ?? null,
  key: l.id ?? `new-${i}-${Math.random().toString(36).slice(2)}`,
});

export const newDraft = (publish = false): DraftLink => ({
  key: `new-${Math.random().toString(36).slice(2)}`,
  url: "",
  label: "",
  in_super_link: publish,
});

/**
 * True when every filled row has a valid URL and no URL repeats. With
 * `requireName`, a filled row without a name is "unnamed".
 */
export function validateLinks(links: DraftLink[], opts: { requireName?: boolean } = {}): string | null {
  const filled = links.filter((l) => l.url.trim());
  if (filled.some((l) => !isUrl(l.url))) return "invalid";
  if (opts.requireName && filled.some((l) => !l.label.trim())) return "unnamed";
  const seen = new Set<string>();
  for (const l of filled) {
    const k = l.url.trim().toLowerCase().replace(/\/+$/, "");
    if (seen.has(k)) return "duplicate";
    seen.add(k);
  }
  return null;
}

/** Drop the blank rows and the client-only `key` before sending. */
export const cleanLinks = (links: DraftLink[]) =>
  links
    .filter((l) => l.url.trim())
    .map(({ key: _key, ...rest }) => {
      void _key;
      return rest;
    });

export function LinkListEditor({
  links,
  onChange,
  title,
  addLabel,
  emptyHint,
  urlPlaceholder = "https://docs.google.com/…",
  namePlaceholder,
  nameHint,
  description,
  alwaysPublish = false,
  refCountOf,
}: {
  links: DraftLink[];
  onChange: (next: DraftLink[]) => void;
  title: string;
  addLabel: string;
  /** Shown in place of the list when there is nothing attached yet. */
  emptyHint: string;
  urlPlaceholder?: string;
  /** Placeholder for the Super Link name field (only shown when published). */
  namePlaceholder: string;
  /** Caption under that field, explaining what an empty name falls back to. */
  nameHint: string;
  /** Optional one-liner under the heading. */
  description?: string;
  /** Every row is published and must be named: no tick box, name required. */
  alwaysPublish?: boolean;
  /** How many OTHER records reference a row's Super Link entry (by link id). */
  refCountOf?: (linkId: string) => number;
}) {
  const t = useT();
  const problem = validateLinks(links, { requireName: alwaysPublish });
  // Row whose delete is waiting for a second click (it is referenced elsewhere).
  const [confirming, setConfirming] = React.useState<string | null>(null);

  function patch(key: string, p: Partial<DraftLink>) {
    onChange(links.map((l) => (l.key === key ? { ...l, ...p } : l)));
  }
  function remove(key: string) {
    setConfirming(null);
    onChange(links.filter((x) => x.key !== key));
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{title}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...links, newDraft(alwaysPublish)])}>
          <Plus className="size-3.5" /> {addLabel}
        </Button>
      </div>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}

      {links.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {emptyHint}
        </p>
      )}

      <div className="space-y-2">
        {links.map((l) => {
          const bad = !!l.url.trim() && !isUrl(l.url);
          const unnamed = alwaysPublish && !!l.url.trim() && !l.label.trim();
          const usedBy = l.link_id && refCountOf ? refCountOf(l.link_id) : 0;
          return (
            <div key={l.key} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-2">
                <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                <Input
                  value={l.url}
                  onChange={(e) => patch(l.key, { url: e.target.value })}
                  placeholder={urlPlaceholder}
                  inputMode="url"
                  className={cn("h-8 text-sm", bad && "border-danger focus-visible:ring-danger")}
                />
                {isUrl(l.url) && (
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary" title={t("Buka")}>
                    <ExternalLink className="size-4" />
                  </a>
                )}
                <button
                  type="button"
                  // A result other tasks reference asks once more: deleting it
                  // deletes its Super Link entry, and those tasks are left with
                  // only a copy of the address (flagged, but still a loss).
                  onClick={() => (usedBy > 0 && confirming !== l.key ? setConfirming(l.key) : remove(l.key))}
                  className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                  title={t("Hapus tautan")}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              {bad && (
                <p className="mt-1 pl-6 text-[11px] text-danger">
                  {t("Harus berupa tautan (diawali http:// atau https://).")}
                </p>
              )}

              {confirming === l.key && (
                <div className="mt-2 ml-6 flex flex-wrap items-center gap-2 rounded-md border border-amber-400/70 bg-amber-50/60 px-2 py-1.5 text-[11px] text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/5 dark:text-amber-300">
                  <TriangleAlert className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    {usedBy} {t("tugas lain merujuk tautan ini. Menghapusnya juga menghapus entri Super Link-nya; tugas-tugas itu hanya menyimpan salinan alamatnya dan akan diberi tanda.")}
                  </span>
                  <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => setConfirming(null)}>
                    {t("Batal")}
                  </Button>
                  <Button type="button" size="sm" variant="destructive" className="h-6 px-2 text-[11px]" onClick={() => remove(l.key)}>
                    {t("Tetap hapus")}
                  </Button>
                </div>
              )}

              {alwaysPublish ? (
                <div className="mt-2 pl-6">
                  <Label className="mb-1 text-xs font-normal">
                    {t("Judul tautan")} <span className="text-danger">*</span>
                  </Label>
                  <Input
                    value={l.label}
                    onChange={(e) => patch(l.key, { label: e.target.value })}
                    placeholder={namePlaceholder}
                    aria-invalid={unnamed || undefined}
                    className={cn("h-8 text-sm", unnamed && "border-danger focus-visible:ring-danger")}
                  />
                  {unnamed && <p className="mt-1 text-[11px] text-danger">{t("Judul tautan wajib diisi.")}</p>}
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Library className="size-3 shrink-0" /> {nameHint}
                  </p>
                  {usedBy > 0 && (
                    <p className="mt-1 text-[11px] text-sky-700 dark:text-sky-400">
                      {t("Dirujuk oleh")} {usedBy} {t("tugas lain. Perubahan alamat dan judul ikut terlihat di sana.")}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <label className="mt-2 flex cursor-pointer items-center gap-2 pl-6 text-xs">
                    <Checkbox
                      checked={l.in_super_link}
                      onCheckedChange={(v) => patch(l.key, { in_super_link: v === true })}
                    />
                    <span>{t("Tampilkan juga di Super Link")}</span>
                  </label>

                  {l.in_super_link && (
                    <div className="mt-2 pl-6">
                      <Input
                        value={l.label}
                        onChange={(e) => patch(l.key, { label: e.target.value })}
                        placeholder={namePlaceholder}
                        className="h-8 text-sm"
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">{nameHint}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {problem === "unnamed" && (
        <p className="flex items-center gap-1.5 text-[11px] text-danger">
          <TriangleAlert className="size-3.5" /> {t("Setiap tautan hasil wajib diberi judul.")}
        </p>
      )}
      {problem === "duplicate" && (
        <p className="flex items-center gap-1.5 text-[11px] text-danger">
          <TriangleAlert className="size-3.5" /> {t("Ada tautan yang sama lebih dari sekali.")}
        </p>
      )}
    </div>
  );
}
