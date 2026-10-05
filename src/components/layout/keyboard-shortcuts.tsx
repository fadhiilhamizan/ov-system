"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Keyboard } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ALL_NAV_ITEMS } from "./nav-config";
import { setLang } from "@/lib/actions/session";
import { useLang, useT } from "@/lib/i18n/provider";
import {
  GLOBAL_SHORTCUTS, TABLE_SHORTCUTS, DIALOG_SHORTCUTS, GO_KEYS, SEQUENCE_TIMEOUT,
  matchesAny, matchesCombo, comboCaps, combosForPlatform, isTypingElement, goTarget,
  type ShortcutDoc,
} from "@/lib/shortcuts";

// ============================================================
// The one keydown listener behind every keyboard shortcut (see lib/shortcuts.ts
// for the map and why page keys live on the elements themselves).
//
// Order of precedence, which is what keeps it from fighting the page:
//   1. Something else already handled the key (defaultPrevented): hands off.
//   2. Ctrl/Cmd+Enter inside a dialog or popover form: press its save button.
//   3. A modal dialog, menu, listbox or popover has focus: it owns every key.
//   4. Focus is in a text field: keys are text. Escape leaves the field.
//   5. "g" + letter, "?", "[", Shift+D/L, Alt+M.
//   6. Table row keys (j/k/x/o/e/.).
//   7. The visible element whose aria-keyshortcuts matches.
// ============================================================

/** Ask the shell for something from anywhere (the user menu, the palette). */
export const SHORTCUT_EVENT = "ov:shortcut";
export type ShortcutCommand = "help" | "palette" | "sidebar" | "theme" | "lang";
export function runShortcutCommand(cmd: ShortcutCommand) {
  window.dispatchEvent(new CustomEvent(SHORTCUT_EVENT, { detail: cmd }));
}

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

function visible(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest("[aria-hidden='true'], [inert], [hidden]")) return false;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none";
}

/** A Radix modal dialog (not a popover) or our own aria-modal layer is open. */
function modalOpen(): boolean {
  return [...document.querySelectorAll("[role='dialog'], [role='alertdialog'], [aria-modal='true']")].some(
    (d) => !d.closest("[data-radix-popper-content-wrapper]") && visible(d),
  );
}

/** Focus sits in something that owns its own keys (a menu, a popover, a list). */
function inOverlay(el: Element | null): boolean {
  return !!el?.closest("[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox'], [data-radix-popper-content-wrapper]");
}

/** The button a Ctrl+Enter should press inside this scope. */
function submitButton(scope: Element): HTMLElement | null {
  const marked = scope.querySelector<HTMLElement>("[data-kbd-submit]");
  if (marked && visible(marked)) return marked;
  const footers = scope.querySelectorAll("[data-dialog-footer]");
  const footer = footers[footers.length - 1];
  if (!footer) return null;
  // The LAST button is the save button. When it is disabled (a required field
  // is empty) nothing happens: falling back to the next one would press Batal.
  const shown = [...footer.querySelectorAll<HTMLButtonElement>("button")].filter(
    (b) => b.getBoundingClientRect().width > 0,
  );
  const last = shown[shown.length - 1];
  return last && !last.disabled ? last : null;
}

/** Press an element the way a person would, whatever kind of control it is. */
export function activate(el: HTMLElement) {
  if (isTypingElement(el)) {
    el.focus();
    (el as HTMLInputElement).select?.();
    return;
  }
  el.focus();
  // Radix tabs select on focus; menus and selects open on a key, not a click.
  if (el.getAttribute("role") === "tab") return;
  const popup = el.getAttribute("aria-haspopup");
  if (popup === "menu" || popup === "listbox" || el.getAttribute("role") === "combobox") {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    return;
  }
  el.click();
}

/** Visible elements that declare a shortcut, main content first. */
export function shortcutTargets(): HTMLElement[] {
  const all = [...document.querySelectorAll<HTMLElement>("[aria-keyshortcuts]")].filter(visible);
  const rank = (el: HTMLElement) => (el.closest("main") ? 0 : 1);
  return all.sort((a, b) => rank(a) - rank(b));
}

/** The readable name of a control, for the help list and the palette. */
export function labelOf(el: HTMLElement): string {
  return (
    el.dataset.shortcutLabel ||
    el.getAttribute("aria-label") ||
    el.getAttribute("placeholder") ||
    el.getAttribute("title") ||
    el.textContent?.replace(/\s+/g, " ").trim() ||
    ""
  );
}

// ---------------- table rows ----------------
const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

function tableRows(from: Element | null): HTMLElement[] {
  const main = document.querySelector("main");
  if (!main) return [];
  const table = from?.closest("table") ?? [...main.querySelectorAll("table")].find((t) => visible(t) && t.querySelector("tbody tr"));
  if (!table) return [];
  return [...table.querySelectorAll<HTMLElement>(":scope > tbody > tr")].filter(
    (r) => visible(r) && r.querySelector(FOCUSABLE),
  );
}

function focusRow(row: HTMLElement) {
  const first = [...row.querySelectorAll<HTMLElement>(FOCUSABLE)].find(visible);
  first?.focus();
  row.scrollIntoView({ block: "nearest" });
}

/** j/k/x/o/e/. on the row that has focus (or the first row). */
function tableKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
  const key = e.key.toLowerCase();
  if (!["j", "k", "x", "o", "e", "."].includes(key)) return false;
  const active = document.activeElement;
  const rows = tableRows(active);
  if (!rows.length) return false;
  const current = active?.closest("tr") as HTMLElement | null;
  const i = current ? rows.indexOf(current) : -1;
  if (key === "j" || key === "k") {
    const next = i < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, i + (key === "j" ? 1 : -1)));
    focusRow(rows[next]);
    return true;
  }
  if (i < 0) return false;
  const row = rows[i];
  const pick = (sel: string) => [...row.querySelectorAll<HTMLElement>(sel)].find(visible) ?? null;
  const target =
    key === "x" ? pick("[role='checkbox'], input[type='checkbox']")
    : key === "." ? pick("[aria-haspopup='menu']")
    : key === "e" ? pick("[data-row-edit], button[aria-label^='Edit'], [aria-label^='Edit ']")
    : pick("[data-row-open]") ?? pick("button:not([role='checkbox']):not([aria-haspopup='menu']):not([aria-label]), a[href]");
  if (!target) return false;
  activate(target);
  return true;
}

// ---------------- the component ----------------

export function KeyboardShortcuts({
  allowedNav,
  onToggleSidebar,
}: {
  /** Nav keys this account may open (from can.accessModule). */
  allowedNav: string[];
  /** Collapse the desktop sidebar, or open the drawer on a phone. */
  onToggleSidebar: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const pendingG = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest values for the listener, which is attached once.
  const live = React.useRef({ allowedNav, onToggleSidebar, resolvedTheme, setTheme, lang, router, t });
  React.useEffect(() => {
    live.current = { allowedNav, onToggleSidebar, resolvedTheme, setTheme, lang, router, t };
  });

  React.useEffect(() => {
    const run = (cmd: ShortcutCommand) => {
      const v = live.current;
      if (cmd === "help") setHelpOpen(true);
      else if (cmd === "sidebar") v.onToggleSidebar();
      else if (cmd === "theme") v.setTheme(v.resolvedTheme === "dark" ? "light" : "dark");
      else if (cmd === "lang") void setLang(v.lang === "id" ? "en" : "id");
    };
    const onCommand = (e: Event) => {
      const cmd = (e as CustomEvent<ShortcutCommand>).detail;
      if (cmd !== "palette") run(cmd);
    };

    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return;
      const target = e.target instanceof Element ? e.target : null;

      // Ctrl/Cmd+Enter saves the form that holds focus (dialog or popover).
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const scope = target?.closest("[role='dialog'], [role='alertdialog']");
        const btn = scope ? submitButton(scope) : null;
        if (btn) { e.preventDefault(); btn.click(); }
        return;
      }
      if (modalOpen() || inOverlay(target)) return;

      if (isTypingElement(target as HTMLElement | null)) {
        // Escape hands the keyboard back to the shortcuts.
        if (e.key === "Escape") (target as HTMLElement).blur();
        return;
      }

      // "g" sequences.
      if (pendingG.current) {
        clearTimeout(pendingG.current);
        pendingG.current = null;
        if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
          const key = goTarget(e.key, live.current.allowedNav);
          const item = key && ALL_NAV_ITEMS.find((i) => i.key === key);
          if (item) {
            e.preventDefault();
            live.current.router.push(item.href);
          }
          return;
        }
      }
      if (matchesCombo(e, "G")) {
        e.preventDefault();
        pendingG.current = setTimeout(() => { pendingG.current = null; }, SEQUENCE_TIMEOUT);
        return;
      }

      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setHelpOpen(true); return; }
      if (matchesCombo(e, "[")) { e.preventDefault(); run("sidebar"); return; }
      if (matchesCombo(e, "Shift+D")) { e.preventDefault(); run("theme"); return; }
      if (matchesCombo(e, "Shift+L")) { e.preventDefault(); run("lang"); return; }
      if (matchesCombo(e, "Alt+M")) {
        const main = document.getElementById("main-content");
        if (main) { e.preventDefault(); main.focus(); main.scrollIntoView({ block: "start" }); }
        return;
      }

      // "/" prefers the page's own search box, else the palette.
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const box = shortcutTargets().find((el) => el.getAttribute("aria-keyshortcuts") === "/");
        e.preventDefault();
        if (box) activate(box);
        else runShortcutCommand("palette");
        return;
      }

      if (tableKey(e)) { e.preventDefault(); return; }

      const hit = shortcutTargets().find((el) => matchesAny(e, el.getAttribute("aria-keyshortcuts")));
      if (hit) { e.preventDefault(); activate(hit); return; }

      // Digits with no explicit owner switch the page's tabs, in order.
      if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const list = [...document.querySelectorAll("main [role='tablist']")].find(visible);
        const tab = list ? [...list.querySelectorAll<HTMLElement>("[role='tab']")].filter(visible)[Number(e.key) - 1] : undefined;
        if (tab) { e.preventDefault(); activate(tab); }
      }
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener(SHORTCUT_EVENT, onCommand);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SHORTCUT_EVENT, onCommand);
      if (pendingG.current) clearTimeout(pendingG.current);
    };
  }, []);

  return <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} allowedNav={allowedNav} />;
}

/** Key caps for one documented shortcut, alternatives joined by "/". */
export function Keys({ keys }: { keys: string[] }) {
  const mac = React.useSyncExternalStore(() => () => {}, isMacPlatform, () => false);
  const combos = combosForPlatform(keys, mac);
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {combos.map((c, i) => (
        <React.Fragment key={c}>
          {i > 0 && <span className="text-[10px] text-muted-foreground">/</span>}
          <span className="inline-flex items-center gap-0.5">
            {comboCaps(c, mac).map((cap, j) => (
              <kbd key={j} className="min-w-[1.4rem] rounded border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-[10px] font-medium text-foreground shadow-[0_1px_0_var(--border)]">
                {cap}
              </kbd>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

function Section({ title, items }: { title: string; items: ShortcutDoc[] }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((s) => (
          <li key={`${s.keys.join(",")}-${s.label}`} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
            <span className="min-w-0">{t(s.label)}</span>
            <Keys keys={s.keys} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The "?" sheet: everything the keyboard can do, including on this page. */
function ShortcutHelp({
  open, onOpenChange, allowedNav,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allowedNav: string[];
}) {
  const t = useT();
  // Read the page's own shortcuts at the moment the sheet opens, so it lists
  // exactly what is pressable on screen right now.
  const [pageKeys, setPageKeys] = React.useState<ShortcutDoc[]>([]);
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open && typeof document !== "undefined") {
      const seen = new Set<string>();
      const list: ShortcutDoc[] = [];
      for (const el of shortcutTargets()) {
        const keys = (el.getAttribute("aria-keyshortcuts") ?? "").split(/\s+/).filter(Boolean);
        const label = labelOf(el);
        const id = `${keys.join(" ")}|${label}`;
        if (!label || seen.has(id) || GLOBAL_SHORTCUTS.some((g) => g.keys.join() === keys.join())) continue;
        seen.add(id);
        list.push({ keys, label });
      }
      setPageKeys(list);
    }
  }

  const nav: ShortcutDoc[] = ALL_NAV_ITEMS
    .filter((i) => allowedNav.includes(i.key) && GO_KEYS[i.key])
    .map((i) => ({ keys: [`G ${GO_KEYS[i.key].toUpperCase()}`], label: i.label }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Keyboard className="size-5" /> {t("Pintasan Keyboard")}</DialogTitle>
          <DialogDescription>
            {t("Semua menu dan tombol bisa dipakai tanpa mouse. Tekan ? kapan saja untuk membuka daftar ini; Ctrl+K membuka palet berisi semua perintah.")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-5">
            <Section title={t("Umum")} items={GLOBAL_SHORTCUTS} />
            <Section title={t("Halaman ini")} items={pageKeys} />
          </div>
          <div className="space-y-5">
            <NavSection items={nav} />
            <Section title={t("Tabel")} items={TABLE_SHORTCUTS} />
            <Section title={t("Dialog & formulir")} items={DIALOG_SHORTCUTS} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "G then D" reads better as two separate caps than as a combo. */
function NavSection({ items }: { items: ShortcutDoc[] }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold text-muted-foreground">{t("Pindah menu (tekan G lalu huruf)")}</h3>
      <ul className="grid grid-cols-1 divide-y divide-border rounded-lg border border-border sm:grid-cols-2 sm:divide-y-0">
        {items.map((s) => {
          const [, letter] = s.keys[0].split(" ");
          return (
            <li key={s.label} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm sm:border-b sm:border-border">
              <span className="min-w-0 truncate">{t(s.label)}</span>
              <span className="inline-flex items-center gap-1">
                <Keys keys={["G"]} />
                <Keys keys={[letter]} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Toast-free hint used by the footer / user menu to open the sheet. */
export function ShortcutsHint({ className }: { className?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => runShortcutCommand("help")}
      className={className}
      aria-label={t("Tampilkan daftar pintasan keyboard")}
    >
      <Keyboard className="size-3.5" />
      <span>{t("Pintasan keyboard")}</span>
      <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">?</kbd>
    </button>
  );
}

