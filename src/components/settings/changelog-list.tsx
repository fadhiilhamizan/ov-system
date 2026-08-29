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
 * The changelog grows by a release every change, and it is not small: all 49
 * entries serialise to about 38KB, which used to travel to EVERY visitor of
 * Pengaturan whether or not they scrolled past the newest five. That is the
 * same weight the EN dictionary is carefully kept away from Indonesian
 * visitors, sent unconditionally.
 *
 * So the server now hands over only the newest releases, and the rest are
 * fetched as their own JS chunk the first time somebody asks for them. Nothing
 * is lost from the feature; the default page just stops paying for the archive.
 *
 * Every line carries a category, which doubles as a filter: "what got fixed
 * lately" is the question people actually arrive with.
 */
export function ChangelogList({
  entries,
  total,
}: {
  entries: ChangelogEntry[];
  /** How many releases exist in all, so the button can say what it will load. */
  total?: number;
}) {
  const t = useT();
  const [showAll, setShowAll] = React.useState(false);
  const [kinds, setKinds] = React.useState<Set<ChangeKind>>(new Set());
  // Starts as what the server sent; replaced by the full list on demand.
  const [all, setAll] = React.useState<ChangelogEntry[]>(entries);
  const [loading, setLoading] = React.useState(false);
  const complete = all.length >= (total ?? entries.length);

  async function loadOlder() {
    if (complete || loading) return;
    setLoading(true);
    try {
      // Its own chunk, pulled only when someone actually wants the archive.
      const mod = await import("@/lib/changelog");
      setAll(mod.CHANGELOG);
      setShowAll(true);
    } finally {
      setLoading(false);
    }
  }

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
    if (kinds.size === 0) return all;
    return all
      .map((e) => ({ ...e, changes: e.changes.filter((c) => kinds.has(c.kind)) }))
      .filter((e) => e.changes.length > 0);
  }, [all, kinds]);

  const hidden = Math.max(0, filtered.length - VISIBLE);
  const shown = showAll ? filtered : filtered.slice(0, VISIBLE);

  /** How many lines of each kind exist across every release. */
  const counts = React.useMemo(() => {
    const c = {} as Record<ChangeKind, number>;
    for (const k of CHANGE_KINDS) c[k] = 0;
    for (const e of all) for (const ch of e.changes) c[ch.kind]++;
    return c;
  }, [all]);

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

      {(hidden > 0 || !complete) && (
        <button
          type="button"
          disabled={loading}
          onClick={() => (complete ? setShowAll((v) => !v) : loadOlder())}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
        >
          {loading ? (
            <>{t("Memuat…")}</>
          ) : showAll && complete ? (
            <>{t("Tampilkan lebih sedikit")}</>
          ) : (
            <>
              {t("Lihat semua versi")} (
              {complete ? hidden : (total ?? 0) - entries.length + hidden} {t("versi lama")})
            </>
          )}
          <ChevronDown
            className={showAll && complete ? "size-3.5 rotate-180 transition" : "size-3.5 transition"}
          />
        </button>
      )}
    </div>
  );
}
