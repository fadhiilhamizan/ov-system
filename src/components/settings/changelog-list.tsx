"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { ChangelogEntry } from "@/lib/changelog";

/** How many releases are visible before "show everything". */
const VISIBLE = 5;

/**
 * The changelog grows by a release every change, so showing all of it buried the
 * cards below it. Only the newest few are rendered until asked; the rest stay in
 * the payload (it is plain data, already sent) and just aren't drawn.
 */
export function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  const t = useT();
  const [showAll, setShowAll] = React.useState(false);
  const hidden = Math.max(0, entries.length - VISIBLE);
  const shown = showAll ? entries : entries.slice(0, VISIBLE);

  return (
    <div className="space-y-4">
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
            <ul className="space-y-1 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              {entry.changes.map((c, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-primary">•</span> {c}
                </li>
              ))}
            </ul>
          </details>
        ))}
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
