"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { CHANGE_KIND, CHANGE_KINDS, type ChangeKind, type ChangelogEntry } from "@/lib/changelog";

/** How many releases are visible before "show everything". */
const VISIBLE = 5;

/**
 * The changelog grows by a release every change, so showing all of it buried the
 * cards below it. Only the newest few are rendered until asked; the rest stay in
 * the payload (it is plain data, already sent) and just aren't drawn.
 *
 * Every line carries a category, which doubles as a filter: "what got fixed
 * lately" is the question people actually arrive with.
 */
export function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  const t = useT();
  const [showAll, setShowAll] = React.useState(false);
  const [kinds, setKinds] = React.useState<Set<ChangeKind>>(new Set());

  function toggleKind(k: ChangeKind) {
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  // Filtering drops the LINES, then any release left with nothing to say. That
  // keeps "show me only fixes" from listing empty version headers.
  const filtered = React.useMemo(() => {
    if (kinds.size === 0) return entries;
    return entries
      .map((e) => ({ ...e, changes: e.changes.filter((c) => kinds.has(c.kind)) }))
      .filter((e) => e.changes.length > 0);
  }, [entries, kinds]);

  const hidden = Math.max(0, filtered.length - VISIBLE);
  const shown = showAll ? filtered : filtered.slice(0, VISIBLE);

  /** How many lines of each kind exist across every release. */
  const counts = React.useMemo(() => {
    const c = {} as Record<ChangeKind, number>;
    for (const k of CHANGE_KINDS) c[k] = 0;
    for (const e of entries) for (const ch of e.changes) c[ch.kind]++;
    return c;
  }, [entries]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setKinds(new Set())}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition",
            kinds.size === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {t("Semua")}
        </button>
        {CHANGE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => toggleKind(k)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition",
              kinds.has(k) ? CHANGE_KIND[k].className : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {t(CHANGE_KIND[k].label)} {counts[k]}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {shown.map((entry, i) => (
          <details key={entry.version} className="group rounded-lg border border-border" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <Badge variant={i === 0 ? "primary" : "outline"}>v{entry.version}</Badge>
              <span className="min-w-0 flex-1 text-sm font-medium">{entry.title}</span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {formatDate(entry.date, { long: true })}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
            </summary>
            <ul className="space-y-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              {entry.changes.map((c, j) => (
                <li key={j} className="flex flex-wrap items-start gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      CHANGE_KIND[c.kind].className,
                    )}
                  >
                    {t(CHANGE_KIND[c.kind].label)}
                  </span>
                  <span className="min-w-0 flex-1">{c.text}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
        {shown.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t("Tidak ada perubahan pada kategori itu.")}
          </p>
        )}
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {showAll ? (
            <>{t("Tampilkan lebih sedikit")}</>
          ) : (
            <>
              {t("Lihat semua versi")} ({hidden} {t("versi lama")})
            </>
          )}
          <ChevronDown className={showAll ? "size-3.5 rotate-180 transition" : "size-3.5 transition"} />
        </button>
      )}
    </div>
  );
}
