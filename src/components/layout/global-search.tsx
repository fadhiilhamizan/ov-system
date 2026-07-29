"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Loader2, CornerDownLeft, ArrowUp, ArrowDown, X, Clock, Trash2 } from "lucide-react";
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

const MAX_RECENT = 6;

/**
 * Recently opened results, held in module scope.
 *
 * Deliberately NOT persisted: it survives closing and reopening the palette and
 * navigating between pages (the module stays loaded), and disappears on reload.
 * Search history is a trail of what someone was looking at, so keeping it out of
 * localStorage and off the server is the privacy-preserving default — and it
 * means nothing new has to be disclosed in the Privacy Policy.
 */
let recentHits: SearchHit[] = [];

function rememberRecent(hit: SearchHit) {
  recentHits = [hit, ...recentHits.filter((h) => h.id !== hit.id)].slice(0, MAX_RECENT);
}

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
  // Snapshot the module-level list on open so the visible order stays stable
  // while the palette is on screen.
  const [recent, setRecent] = useResetOn(open, () => recentHits);
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

  const searching = q.trim().length >= 2;

  const grouped = React.useMemo(() => {
    const by = new Map<string, SearchHit[]>();
    for (const h of hits) {
      const list = by.get(h.group) ?? [];
      list.push(h);
      by.set(h.group, list);
    }
    return GROUP_ORDER.filter((g) => by.has(g)).map((g) => ({ group: g, items: by.get(g)! }));
  }, [hits]);

  /**
   * Flat order for the arrow keys. When there is no query yet the list IS the
   * recent history, so Enter opens the last thing you looked at.
   */
  const flat = React.useMemo(
    () => (searching ? grouped.flatMap((g) => g.items) : recent),
    [searching, grouped, recent],
  );

  function go(hit: SearchHit | undefined) {
    if (!hit) return;
    rememberRecent(hit);
    setOpen(false);
    router.push(hit.href);
  }

  function clearRecent() {
    recentHits = [];
    setRecent([]);
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

  /** One result row — shared by the search results and the recent list. */
  function Row({ hit, index }: { hit: SearchHit; index: number }) {
    const Icon = NAV_BY_KEY.get(hit.group)?.icon ?? Search;
    return (
      <button
        onMouseEnter={() => setActive(index)}
        onClick={() => go(hit)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
          index === active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
        )}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{hit.title}</span>
          {hit.subtitle && (
            <span className="block truncate text-[11px] text-muted-foreground">{hit.subtitle}</span>
          )}
        </span>
        {index === active && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
      </button>
    );
  }

  // The palette is portalled to <body>. It has to be: the topbar carries
  // `backdrop-blur`, and a backdrop-filter makes that element the containing
  // block for `position: fixed` descendants — so `fixed inset-0` rendered in
  // place covered only the header strip, not the screen.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

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

      {open && mounted && createPortal(
        // Centred both ways, with the page behind blurred out.
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md"
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
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                Esc
              </kbd>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("Tutup pencarian")}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {!searching ? (
                recent.length ? (
                  <div className="mb-1">
                    <div className="flex items-center justify-between px-2.5 py-1">
                      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <Clock className="size-3" /> {t("Pencarian terakhir")}
                      </p>
                      <button
                        type="button"
                        onClick={clearRecent}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <Trash2 className="size-3" /> {t("Bersihkan")}
                      </button>
                    </div>
                    {recent.map((hit, i) => (
                      <Row key={hit.id} hit={hit} index={i} />
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {t("Ketik minimal 2 huruf untuk mencari.")}
                  </p>
                )
              ) : !flat.length && !pending ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {t("Tidak ada hasil untuk")} “{q}”.
                </p>
              ) : (
                grouped.map(({ group, items }) => (
                  <div key={group} className="mb-1">
                    <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(groupLabel(group))}
                    </p>
                    {items.map((hit) => (
                      <Row key={hit.id} hit={hit} index={flat.indexOf(hit)} />
                    ))}
                  </div>
                ))
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
              <span className="ml-auto hidden sm:inline">{t("Hasil mengikuti Ormawa Visit yang aktif")}</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
