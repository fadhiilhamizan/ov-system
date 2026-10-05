"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search, Loader2, CornerDownLeft, ArrowUp, ArrowDown, X, Clock, Trash2, Command as CommandIcon,
  Keyboard, SunMoon, Languages, PanelLeft, MousePointerClick, type LucideIcon,
} from "lucide-react";
import { searchAction, type SearchHit } from "@/lib/actions/search";
import { ALL_NAV_ITEMS } from "./nav-config";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";
import { useModalLayer } from "@/lib/use-modal-layer";
import { cn } from "@/lib/utils";
import { GO_KEYS } from "@/lib/shortcuts";
import {
  SHORTCUT_EVENT, runShortcutCommand, shortcutTargets, labelOf, activate, Keys,
  type ShortcutCommand,
} from "./keyboard-shortcuts";

/**
 * Something the palette can DO rather than open: go to a menu, press a button
 * on this page, or flip a setting. Together with the search results this is
 * what makes every function reachable from the keyboard by name.
 */
interface PaletteCommand {
  id: string;
  label: string;
  group: "page" | "nav" | "general";
  keys?: string[];
  icon: LucideIcon;
  run: () => void;
}

const COMMAND_GROUP_LABEL: Record<PaletteCommand["group"], string> = {
  page: "Aksi di halaman ini",
  nav: "Pindah ke menu",
  general: "Umum",
};

/** Controls on screen worth offering: declared shortcuts plus `data-command`. */
function pageCommands(): { label: string; keys?: string[]; el: HTMLElement }[] {
  const seen = new Set<string>();
  const out: { label: string; keys?: string[]; el: HTMLElement }[] = [];
  const els = [
    ...shortcutTargets().filter((el) => el.closest("main")),
    ...[...document.querySelectorAll<HTMLElement>("main [data-command]")].filter((el) => el.getBoundingClientRect().width > 0),
  ];
  for (const el of els) {
    const label = el.dataset.command || labelOf(el);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const keys = el.getAttribute("aria-keyshortcuts")?.split(/\s+/).filter(Boolean);
    out.push({ label, keys, el });
  }
  return out;
}

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
 * localStorage and off the server is the privacy-preserving default - and it
 * means nothing new has to be disclosed in the Privacy Policy.
 */
let recentHits: SearchHit[] = [];

function rememberRecent(hit: SearchHit) {
  recentHits = [hit, ...recentHits.filter((h) => h.id !== hit.id)].slice(0, MAX_RECENT);
}

function groupLabel(key: string): string {
  return NAV_BY_KEY.get(key)?.label ?? key;
}


/**
 * One result row - shared by the search results and the recent list.
 *
 * Module scope, NOT nested inside GlobalSearch. Declared inside the component
 * it would be a new component TYPE on every render, so React would tear down
 * and rebuild every row on each keystroke instead of updating it - in a list
 * that re-renders on literally every character typed.
 */
/** Stable per-position id, so aria-activedescendant has something to point at. */
const optionId = (index: number) => `global-search-option-${index}`;

function Row({
  hit,
  index,
  active,
  onHover,
  onPick,
}: {
  hit: SearchHit;
  index: number;
  active: boolean;
  onHover: (index: number) => void;
  onPick: (hit: SearchHit) => void;
}) {
  const Icon = NAV_BY_KEY.get(hit.group)?.icon ?? Search;
  return (
    <button
      // The arrow keys move a highlight while focus stays in the input, so
      // without role="option" + aria-selected a screen reader announces nothing
      // at all as the selection moves - the list is invisible to it.
      id={optionId(index)}
      role="option"
      aria-selected={active}
      // Focus never lands here: the input keeps it, and Enter is handled there.
      tabIndex={-1}
      onMouseEnter={() => onHover(index)}
      onClick={() => onPick(hit)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{hit.title}</span>
        {hit.subtitle && (
          <span className="block truncate text-[11px] text-muted-foreground">{hit.subtitle}</span>
        )}
      </span>
      {active && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
    </button>
  );
}

/** One command row. Module scope for the same reason as Row. */
function CommandRow({
  cmd, index, active, onHover, onPick,
}: {
  cmd: PaletteCommand;
  index: number;
  active: boolean;
  onHover: (index: number) => void;
  onPick: (cmd: PaletteCommand) => void;
}) {
  const t = useT();
  const Icon = cmd.icon;
  return (
    <button
      id={optionId(index)}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onMouseEnter={() => onHover(index)}
      onClick={() => onPick(cmd)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{t(cmd.label)}</span>
      {cmd.keys?.length ? <Keys keys={cmd.keys} /> : null}
    </button>
  );
}

/** Commands under their group headings, in a fixed order. */
function CommandGroups({
  commands, active, indexOf, onHover,
}: {
  commands: PaletteCommand[];
  active: number;
  indexOf: (cmd: PaletteCommand) => number;
  onHover: (index: number) => void;
}) {
  const t = useT();
  return (
    <>
      {(["page", "nav", "general"] as const).map((g) => {
        const items = commands.filter((c) => c.group === g);
        if (!items.length) return null;
        return (
          <div key={g} className="mb-1">
            <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{t(COMMAND_GROUP_LABEL[g])}</p>
            {items.map((cmd) => (
              <CommandRow
                key={cmd.id}
                cmd={cmd}
                index={indexOf(cmd)}
                active={indexOf(cmd) === active}
                onHover={onHover}
                onPick={(c) => c.run()}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

export function GlobalSearch({ allowedNav = [] }: { allowedNav?: string[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  // Everything resets when the palette opens or closes - done during render
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
  // What the palette can DO, read from the page at the moment it opens.
  const [commands, setCommands] = React.useState<PaletteCommand[]>([]);

  const buildCommands = React.useCallback((): PaletteCommand[] => {
    const later = (fn: () => void) => () => { setOpen(false); setTimeout(fn, 60); };
    const page: PaletteCommand[] = pageCommands().map((c, i) => ({
      id: `page-${i}`, label: c.label, group: "page", keys: c.keys, icon: MousePointerClick,
      run: later(() => activate(c.el)),
    }));
    const nav: PaletteCommand[] = ALL_NAV_ITEMS.filter((i) => allowedNav.includes(i.key)).map((i) => ({
      id: `nav-${i.key}`, label: i.label, group: "nav", icon: i.icon,
      keys: GO_KEYS[i.key] ? [`G ${GO_KEYS[i.key].toUpperCase()}`] : undefined,
      run: () => { setOpen(false); router.push(i.href); },
    }));
    const general = (
      [
        ["help", "Tampilkan daftar pintasan keyboard", Keyboard, ["?"]],
        ["theme", "Ganti tema terang/gelap", SunMoon, ["Shift+D"]],
        ["lang", "Ganti bahasa", Languages, ["Shift+L"]],
        ["sidebar", "Buka/tutup menu samping", PanelLeft, ["["]],
      ] as [ShortcutCommand, string, LucideIcon, string[]][]
    ).map(([cmd, label, icon, keys]) => ({
      id: `general-${cmd}`, label, group: "general" as const, icon, keys,
      run: later(() => runShortcutCommand(cmd)),
    }));
    return [...page, ...nav, ...general];
  }, [allowedNav, router]);

  const openPalette = React.useCallback(() => {
    setCommands(buildCommands());
    setOpen(true);
  }, [buildCommands]);

  // ---- Ctrl/Cmd+K anywhere; "/" and the palette command arrive as events ----
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false); else openPalette();
      }
    }
    function onCommand(e: Event) {
      if ((e as CustomEvent<ShortcutCommand>).detail === "palette") openPalette();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(SHORTCUT_EVENT, onCommand);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SHORTCUT_EVENT, onCommand);
    };
  }, [open, openPalette]);

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
  const query = q.trim().toLowerCase();
  const shownCommands = React.useMemo(
    () => (query
      ? commands.filter((c) => `${t(c.label)} ${c.label} ${t(COMMAND_GROUP_LABEL[c.group])}`.toLowerCase().includes(query))
      : commands),
    [commands, query, t],
  );

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
  const hitList = React.useMemo(
    () => (searching ? grouped.flatMap((g) => g.items) : recent),
    [searching, grouped, recent],
  );
  // Arrow-key order: recent history (when empty), then commands, then results.
  type Entry = { kind: "hit"; hit: SearchHit } | { kind: "cmd"; cmd: PaletteCommand };
  const flat = React.useMemo<Entry[]>(() => {
    const hitsE = hitList.map((hit) => ({ kind: "hit" as const, hit }));
    const cmdsE = shownCommands.map((cmd) => ({ kind: "cmd" as const, cmd }));
    return searching ? [...cmdsE, ...hitsE] : [...hitsE, ...cmdsE];
  }, [hitList, shownCommands, searching]);
  const indexOfHit = (hit: SearchHit) => flat.findIndex((e) => e.kind === "hit" && e.hit === hit);
  const indexOfCmd = (cmd: PaletteCommand) => flat.findIndex((e) => e.kind === "cmd" && e.cmd === cmd);

  function pick(entry: Entry | undefined) {
    if (!entry) return;
    if (entry.kind === "cmd") entry.cmd.run();
    else go(entry.hit);
  }

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
      pick(flat[active]);
    }
    // Escape is handled by useModalLayer, at the layer rather than at the
    // input: it used to work only while the caret sat here, so arrowing down to
    // a result and pressing Escape did nothing.
  }

  // The palette is portalled to <body>. It has to be: the topbar carries
  // `backdrop-blur`, and a backdrop-filter makes that element the containing
  // block for `position: fixed` descendants - so `fixed inset-0` rendered in
  // place covered only the header strip, not the screen.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Focus trap, Escape, body scroll lock, and focus restored to the trigger.
  const close = React.useCallback(() => setOpen(false), []);
  const dialogRef = useModalLayer<HTMLDivElement>(open && mounted, close);

  return (
    <>
      {/* Trigger - a search-box lookalike on wide screens, an icon on mobile. */}
      <button
        onClick={openPalette}
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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("Pencarian global")}
            className="flex max-h-[80dvh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl sm:max-h-[70vh]"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              {pending ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Search className="size-4 shrink-0 text-muted-foreground" />
              )}
              <input
                // The input mounts fresh each time the palette opens, so
                // autoFocus is enough - no focus effect needed.
                autoFocus
                // The combobox pattern: focus stays here while the arrow keys
                // move through the list, and aria-activedescendant is what tells
                // a screen reader which row is currently picked.
                role="combobox"
                aria-expanded
                aria-controls="global-search-results"
                aria-activedescendant={flat.length ? optionId(active) : undefined}
                aria-label={t("Cari data atau ketik perintah…")}
                value={q}
                onChange={(e) => { setQ(e.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                placeholder={t("Cari data atau ketik perintah…")}
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

            <div
              id="global-search-results"
              role="listbox"
              aria-label={t("Hasil pencarian")}
              className="min-h-0 flex-1 overflow-y-auto p-1.5"
            >
              {!searching ? (
                recent.length || !query ? (
                  <>
                  {recent.length > 0 && (
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
                    {recent.map((hit) => (
                      <Row
                        key={hit.id}
                        hit={hit}
                        index={indexOfHit(hit)}
                        active={indexOfHit(hit) === active}
                        onHover={setActive}
                        onPick={go}
                      />
                    ))}
                  </div>
                  )}
                  <CommandGroups commands={shownCommands} active={active} indexOf={indexOfCmd} onHover={setActive} />
                  </>
                ) : shownCommands.length ? (
                  <CommandGroups commands={shownCommands} active={active} indexOf={indexOfCmd} onHover={setActive} />
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
                <>
                <CommandGroups commands={shownCommands} active={active} indexOf={indexOfCmd} onHover={setActive} />
                {grouped.map(({ group, items }) => (
                  <div key={group} className="mb-1">
                    <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(groupLabel(group))}
                    </p>
                    {items.map((hit) => (
                      <Row
                        key={hit.id}
                        hit={hit}
                        index={indexOfHit(hit)}
                        active={indexOfHit(hit) === active}
                        onHover={setActive}
                        onPick={go}
                      />
                    ))}
                  </div>
                ))}
                </>
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
              <span className="inline-flex items-center gap-1">
                <CommandIcon className="size-3" /> {t("perintah & data")}
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
