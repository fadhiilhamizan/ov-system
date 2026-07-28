"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { searchAction, type SearchHit } from "@/lib/actions/search";
import { ALL_NAV_ITEMS } from "./nav-config";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";
import { cn } from "@/lib/utils";

/** Icon + heading per result group, reusing the nav definitions. */
const NAV_BY_KEY = new Map(ALL_NAV_ITEMS.map((i) => [i.key, i]));

const GROUP_ORDER = [
  "tasks", "members", "divisions", "prospects", "links",
  "budget", "rundown", "jobs", "events", "faq",
];

function groupLabel(key: string): string {
  return NAV_BY_KEY.get(key)?.label ?? key;
}

/** Is the user typing into something? Then Ctrl/Cmd+K still applies, "/" doesn't. */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

export function GlobalSearch() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  // Everything resets when the palette opens or closes — done during render
  // (see lib/use-synced.ts) rather than in an effect, which would flash the
  // previous query for one frame.
  const [q, setQ] = useResetOn(open, () => "");
  const [hits, setHits] = useResetOn(open, () => [] as SearchHit[]);
  const [active, setActive] = useResetOn(open, () => 0);
  const [pending, setPending] = useResetOn(open, () => false);
  // Guards against an older, slower request overwriting a newer one's results.
  const seq = React.useRef(0);

  // ---- keyboard shortcuts: Ctrl/Cmd+K anywhere, "/" when not typing ----
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- debounced search ----
  React.useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setPending(false);
      return;
    }
    setPending(true);
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await searchAction(query);
        if (seq.current === id) {
          setHits(res);
          setActive(0);
        }
      } finally {
        if (seq.current === id) setPending(false);
      }
    }, 220);
    return () => clearTimeout(timer);
    // The setters come from useResetOn -> useState, so their identity is stable;
    // listing them satisfies exhaustive-deps without re-running the effect.
  }, [q, open, setHits, setPending, setActive]);

  const grouped = React.useMemo(() => {
    const by = new Map<string, SearchHit[]>();
    for (const h of hits) {
      const list = by.get(h.group) ?? [];
      list.push(h);
      by.set(h.group, list);
    }
    return GROUP_ORDER.filter((g) => by.has(g)).map((g) => ({ group: g, items: by.get(g)! }));
  }, [hits]);

  /** Flat order, so arrow keys move across group boundaries naturally. */
  const flat = React.useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  function go(hit: SearchHit | undefined) {
    if (!hit) return;
    setOpen(false);
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <>
      {/* Trigger — a search-box lookalike on wide screens, an icon on mobile. */}
      <button
        onClick={() => setOpen(true)}
        aria-label={t("Cari")}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-muted-foreground shadow-sm transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden text-xs lg:inline">{t("Cari apa saja…")}</span>
        <kbd className="ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] lg:inline">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh] backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("Pencarian global")}
            className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              {pending ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Search className="size-4 shrink-0 text-muted-foreground" />
              )}
              <input
                // The input mounts fresh each time the palette opens, so
                // autoFocus is enough — no focus effect needed.
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t("Cari tugas, anggota, divisi, anggaran, tautan…")}
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                Esc
              </kbd>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {q.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {t("Ketik minimal 2 huruf untuk mencari.")}
                </p>
              ) : !flat.length && !pending ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {t("Tidak ada hasil untuk")} “{q}”.
                </p>
              ) : (
                grouped.map(({ group, items }) => {
                  const Icon = NAV_BY_KEY.get(group)?.icon ?? Search;
                  return (
                    <div key={group} className="mb-1">
                      <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t(groupLabel(group))}
                      </p>
                      {items.map((hit) => {
                        const idx = flat.indexOf(hit);
                        return (
                          <button
                            key={hit.id}
                            onMouseEnter={() => setActive(idx)}
                            onClick={() => go(hit)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                              idx === active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
                            )}
                          >
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{hit.title}</span>
                              {hit.subtitle && (
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {hit.subtitle}
                                </span>
                              )}
                            </span>
                            {idx === active && (
                              <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ArrowUp className="size-3" />
                <ArrowDown className="size-3" /> {t("pilih")}
              </span>
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="size-3" /> {t("buka")}
              </span>
              <span className="ml-auto">{t("Hasil mengikuti Ormawa Visit yang aktif")}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
