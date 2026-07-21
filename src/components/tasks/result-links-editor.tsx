"use client";
import * as React from "react";
import { Plus, Trash2, Link2, ExternalLink, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { TaskLinkInput } from "@/lib/types";

/** Row model — `key` is a stable client-side id for React lists. */
export interface DraftLink extends TaskLinkInput {
  key: string;
}

export const toDraft = (l: TaskLinkInput, i: number): DraftLink => ({
  ...l,
  key: l.id ?? `new-${i}-${Math.random().toString(36).slice(2)}`,
});

export const newDraft = (): DraftLink => ({
  key: `new-${Math.random().toString(36).slice(2)}`,
  url: "",
  label: "",
  in_super_link: false,
});

/** True when every filled row has a valid URL and no URL repeats. */
export function validateLinks(links: DraftLink[]): string | null {
  const filled = links.filter((l) => l.url.trim());
  if (filled.some((l) => !isUrl(l.url))) return "invalid";
  const seen = new Set<string>();
  for (const l of filled) {
    const k = l.url.trim().toLowerCase().replace(/\/+$/, "");
    if (seen.has(k)) return "duplicate";
    seen.add(k);
  }
  return null;
}

export function ResultLinksEditor({
  links,
  onChange,
}: {
  links: DraftLink[];
  onChange: (next: DraftLink[]) => void;
}) {
  const t = useT();
  const problem = validateLinks(links);

  function patch(key: string, p: Partial<DraftLink>) {
    onChange(links.map((l) => (l.key === key ? { ...l, ...p } : l)));
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{t("Tautan hasil")}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...links, newDraft()])}>
          <Plus className="size-3.5" /> {t("Tambah tautan")}
        </Button>
      </div>

      {links.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {t("Belum ada tautan. Klik “Tambah tautan” untuk melampirkan Drive/Docs/Foto.")}
        </p>
      )}

      <div className="space-y-2">
        {links.map((l) => {
          const bad = !!l.url.trim() && !isUrl(l.url);
          return (
            <div key={l.key} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-2">
                <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                <Input
                  value={l.url}
                  onChange={(e) => patch(l.key, { url: e.target.value })}
                  placeholder="https://docs.google.com/…"
                  className={cn("h-8 text-sm", bad && "border-danger focus-visible:ring-danger")}
                />
                {isUrl(l.url) && (
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary" title={t("Buka")}>
                    <ExternalLink className="size-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onChange(links.filter((x) => x.key !== l.key))}
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
                    placeholder={t("Nama tautan di Super Link (mis. Proposal OV)")}
                    className="h-8 text-sm"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("Kosongkan untuk memakai judul tugas. Mengubah/menghapus tautan ini juga memperbarui Super Link.")}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {problem === "duplicate" && (
        <p className="flex items-center gap-1.5 text-[11px] text-danger">
          <TriangleAlert className="size-3.5" /> {t("Ada tautan yang sama lebih dari sekali.")}
        </p>
      )}
    </div>
  );
}
