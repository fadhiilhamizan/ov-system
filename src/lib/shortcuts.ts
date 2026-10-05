// ============================================================
// Keyboard shortcuts: the map, and the pure helpers that read it.
//
// There are three kinds, and they live in three places on purpose:
//
// 1. GLOBAL keys (help, search, sidebar, theme, language, "g" + letter to go
//    to a menu) are listed here and handled by components/layout/
//    keyboard-shortcuts.tsx. They work on every page.
//
// 2. PAGE keys are declared ON THE ELEMENT they press, with the standard
//    `aria-keyshortcuts` attribute ("N" on a page's Tambah button, "/" on its
//    search box, "1"/"2"/"3" on view switches). The global handler finds the
//    visible element carrying the key and activates it, and the "?" help and
//    the command palette list them by reading the same attribute. So adding a
//    shortcut to a button is ONE attribute, it cannot drift from what the help
//    says, and a screen reader announces it too.
//
// 3. TABLE keys (j/k/x/o/e/.) work on any table row, with no per-table code.
//
// Everything here is pure (no React, no DOM globals at import) so it can be
// unit-tested in shortcuts.test.ts.
// ============================================================

/** "g" then this letter opens the menu with that nav key. */
export const GO_KEYS: Record<string, string> = {
  dashboard: "d",
  tasks: "w",
  calendar: "k",
  rundown: "r",
  jobs: "h",
  himpunan: "m",
  prospects: "o",
  links: "l",
  budget: "a",
  members: "v",
  events: "e",
  faq: "f",
  panduan: "p",
  inbox: "i",
  roles: "q",
  settings: "s",
};

export interface ShortcutDoc {
  /** One or more alternatives, each in aria-keyshortcuts syntax. */
  keys: string[];
  label: string;
}

/** The global keys, as the help dialog lists them. Labels are i18n keys. */
export const GLOBAL_SHORTCUTS: ShortcutDoc[] = [
  { keys: ["?"], label: "Tampilkan daftar pintasan keyboard" },
  { keys: ["Control+K", "Meta+K"], label: "Buka palet perintah & pencarian" },
  { keys: ["/"], label: "Cari di halaman ini (atau buka pencarian)" },
  { keys: ["["], label: "Buka/tutup menu samping" },
  { keys: ["Shift+E"], label: "Pilih Ormawa Visit" },
  { keys: ["Shift+U"], label: "Buka menu akun" },
  { keys: ["Shift+D"], label: "Ganti tema terang/gelap" },
  { keys: ["Shift+L"], label: "Ganti bahasa" },
  { keys: ["Shift+A"], label: "Buka Violet (asisten)" },
  { keys: ["Alt+M"], label: "Lompat ke konten utama" },
  { keys: ["1", "2", "3"], label: "Pindah tab atau tampilan halaman (angka 1-9)" },
];

export const TABLE_SHORTCUTS: ShortcutDoc[] = [
  { keys: ["J"], label: "Baris berikutnya" },
  { keys: ["K"], label: "Baris sebelumnya" },
  { keys: ["X"], label: "Centang/lepas baris" },
  { keys: ["O"], label: "Buka baris" },
  { keys: ["E"], label: "Edit baris" },
  { keys: ["."], label: "Menu aksi baris (titik tiga)" },
];

export const DIALOG_SHORTCUTS: ShortcutDoc[] = [
  { keys: ["Escape"], label: "Tutup dialog, menu, atau keluar dari kolom ketik" },
  { keys: ["Control+Enter", "Meta+Enter"], label: "Simpan formulir yang sedang terbuka" },
  { keys: ["Tab", "Shift+Tab"], label: "Pindah antar isian dan tombol" },
  { keys: ["Space"], label: "Seret: angkat/letakkan baris lewat ikon geser, lalu panah atas/bawah" },
];

/** How long a "g" waits for its second key. */
export const SEQUENCE_TIMEOUT = 1500;

export interface KeyLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

const NAMED: Record<string, string> = {
  esc: "escape",
  del: "delete",
  space: " ",
  spacebar: " ",
  return: "enter",
  plus: "+",
};

function normKey(k: string): string {
  const low = k.toLowerCase();
  return NAMED[low] ?? low;
}

/**
 * Does this keyboard event match ONE combo in aria-keyshortcuts syntax
 * ("N", "Shift+Delete", "Control+Enter", "/")?
 *
 * Letters and named keys must match Shift exactly ("N" is not "Shift+N").
 * Symbols ignore Shift, because the symbol already says it: "?" is Shift+/ on
 * one layout and a plain key on another.
 */
export function matchesCombo(e: KeyLike, combo: string): boolean {
  const parts = combo.split("+").filter(Boolean);
  if (combo.endsWith("++")) parts.push("+");
  const key = parts.pop();
  if (!key) return false;
  const mods = new Set(parts.map((p) => p.toLowerCase()));
  const want = {
    ctrl: mods.has("control") || mods.has("ctrl"),
    meta: mods.has("meta") || mods.has("cmd"),
    alt: mods.has("alt") || mods.has("option"),
    shift: mods.has("shift"),
  };
  if (e.ctrlKey !== want.ctrl || e.metaKey !== want.meta || e.altKey !== want.alt) return false;
  const k = normKey(key);
  // Alt changes what e.key produces on some layouts (Alt+M is "µ" on a Mac),
  // so with Alt the physical letter is compared through e.code.
  const ev = normKey(e.key);
  const code = (e as KeyLike & { code?: string }).code;
  const keyHit = ev === k || (want.alt && /^[a-z]$/.test(k) && code === `Key${k.toUpperCase()}`);
  if (!keyHit) return false;
  const shiftMatters = /^[a-z]$/.test(k) || k.length > 1;
  return !shiftMatters || e.shiftKey === want.shift;
}

/** aria-keyshortcuts may list alternatives separated by spaces. */
export function matchesAny(e: KeyLike, value: string | null | undefined): boolean {
  if (!value) return false;
  return value.split(/\s+/).filter(Boolean).some((c) => matchesCombo(e, c));
}

/** Pretty key caps for one combo: "Shift+Delete" -> ["Shift", "Del"]. */
export function comboCaps(combo: string, mac = false): string[] {
  // "G D" is a sequence (press G, then D), shown as two caps side by side.
  if (combo.length > 1 && combo.includes(" ")) {
    return combo.split(" ").filter(Boolean).flatMap((c) => comboCaps(c, mac));
  }
  const parts = combo.split("+").filter(Boolean);
  if (combo.endsWith("++")) parts.push("+");
  return parts.map((p) => {
    const low = p.toLowerCase();
    if (low === "control" || low === "ctrl") return mac ? "⌃" : "Ctrl";
    if (low === "meta" || low === "cmd") return mac ? "⌘" : "Win";
    if (low === "alt" || low === "option") return mac ? "⌥" : "Alt";
    if (low === "shift") return mac ? "⇧" : "Shift";
    if (low === "escape" || low === "esc") return "Esc";
    if (low === "delete" || low === "del") return "Del";
    if (low === "arrowleft") return "←";
    if (low === "arrowright") return "→";
    if (low === "arrowup") return "↑";
    if (low === "arrowdown") return "↓";
    if (low === " ") return "Space";
    return p.length === 1 ? p.toUpperCase() : p;
  });
}

/**
 * Drop the alternative that does not apply to this machine: Control+K on
 * Windows/Linux, Meta+K on a Mac. Anything without either is kept.
 */
export function combosForPlatform(keys: string[], mac: boolean): string[] {
  const kept = keys.filter((k) => (mac ? !/\bcontrol\+/i.test(k) : !/\bmeta\+/i.test(k)));
  return kept.length ? kept : keys;
}

/** Is focus somewhere the user types? Then single-letter keys are text. */
export function isTypingElement(el: { tagName?: string; isContentEditable?: boolean; getAttribute?: (n: string) => string | null } | null): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) return true;
  if (tag !== "INPUT") return false;
  const type = (el.getAttribute?.("type") ?? "text").toLowerCase();
  // A checkbox or a button-like input takes no text, so shortcuts stay live.
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(type);
}

/** Which nav key does "g" + this letter open? */
export function goTarget(letter: string, allowed: readonly string[]): string | null {
  const l = letter.toLowerCase();
  const hit = Object.entries(GO_KEYS).find(([key, k]) => k === l && allowed.includes(key));
  return hit ? hit[0] : null;
}
