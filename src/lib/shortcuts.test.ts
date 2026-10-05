import { describe, it, expect } from "vitest";
import {
  matchesCombo, matchesAny, comboCaps, combosForPlatform, isTypingElement, goTarget, GO_KEYS,
  type KeyLike,
} from "./shortcuts";
import { ALL_NAV_ITEMS } from "@/components/layout/nav-config";

const ev = (key: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods,
});

describe("matchesCombo", () => {
  it("matches a plain letter case-insensitively, but not with Shift", () => {
    expect(matchesCombo(ev("n"), "N")).toBe(true);
    expect(matchesCombo(ev("N", { shiftKey: true }), "N")).toBe(false);
    expect(matchesCombo(ev("N", { shiftKey: true }), "Shift+N")).toBe(true);
  });

  it("requires every modifier to match exactly", () => {
    expect(matchesCombo(ev("k", { ctrlKey: true }), "Control+K")).toBe(true);
    expect(matchesCombo(ev("k"), "Control+K")).toBe(false);
    expect(matchesCombo(ev("k", { ctrlKey: true, shiftKey: true }), "Control+K")).toBe(false);
    expect(matchesCombo(ev("k", { metaKey: true }), "Control+K")).toBe(false);
  });

  it("ignores Shift for symbols, since the symbol already says it", () => {
    expect(matchesCombo(ev("?", { shiftKey: true }), "?")).toBe(true);
    expect(matchesCombo(ev("/"), "/")).toBe(true);
  });

  it("understands named keys and their short forms", () => {
    expect(matchesCombo(ev("Delete", { shiftKey: true }), "Shift+Delete")).toBe(true);
    expect(matchesCombo(ev("Delete"), "Shift+Delete")).toBe(false);
    expect(matchesCombo(ev("Escape"), "Esc")).toBe(true);
    expect(matchesCombo(ev("ArrowLeft", { shiftKey: true }), "Shift+ArrowLeft")).toBe(true);
  });

  it("matches Alt+letter by the physical key, whatever character the layout makes", () => {
    const altM = { ...ev("µ", { altKey: true }), code: "KeyM" } as KeyLike;
    expect(matchesCombo(altM, "Alt+M")).toBe(true);
  });

  it("does not let a digit match its shifted symbol", () => {
    expect(matchesCombo(ev("1"), "1")).toBe(true);
    expect(matchesCombo(ev("!", { shiftKey: true }), "1")).toBe(false);
  });
});

describe("matchesAny", () => {
  it("reads space-separated alternatives, as aria-keyshortcuts allows", () => {
    expect(matchesAny(ev("k", { metaKey: true }), "Control+K Meta+K")).toBe(true);
    expect(matchesAny(ev("k", { ctrlKey: true }), "Control+K Meta+K")).toBe(true);
    expect(matchesAny(ev("k"), "Control+K Meta+K")).toBe(false);
    expect(matchesAny(ev("k"), null)).toBe(false);
  });
});

describe("display", () => {
  it("draws caps per platform", () => {
    expect(comboCaps("Shift+Delete")).toEqual(["Shift", "Del"]);
    expect(comboCaps("Meta+K", true)).toEqual(["⌘", "K"]);
    expect(comboCaps("n")).toEqual(["N"]);
    expect(comboCaps("G D")).toEqual(["G", "D"]);
  });

  it("keeps only the alternative that applies to this machine", () => {
    expect(combosForPlatform(["Control+K", "Meta+K"], false)).toEqual(["Control+K"]);
    expect(combosForPlatform(["Control+K", "Meta+K"], true)).toEqual(["Meta+K"]);
    expect(combosForPlatform(["?"], true)).toEqual(["?"]);
  });
});

describe("isTypingElement", () => {
  const el = (tagName: string, type?: string, editable = false) => ({
    tagName, isContentEditable: editable, getAttribute: (n: string) => (n === "type" ? type ?? null : null),
  });
  it("treats text fields as typing and tick boxes as not", () => {
    expect(isTypingElement(el("INPUT"))).toBe(true);
    expect(isTypingElement(el("INPUT", "search"))).toBe(true);
    expect(isTypingElement(el("TEXTAREA"))).toBe(true);
    expect(isTypingElement(el("DIV", undefined, true))).toBe(true);
    expect(isTypingElement(el("INPUT", "checkbox"))).toBe(false);
    expect(isTypingElement(el("BUTTON"))).toBe(false);
    expect(isTypingElement(null)).toBe(false);
  });
});

describe("the g-sequence map", () => {
  it("gives every menu a letter, and no two menus the same one", () => {
    const keys = ALL_NAV_ITEMS.map((i) => i.key);
    for (const k of keys) expect(GO_KEYS[k], `menu ${k} has no "g" letter`).toBeTruthy();
    const letters = Object.values(GO_KEYS);
    expect(new Set(letters).size).toBe(letters.length);
  });

  it("only opens menus this account may open", () => {
    expect(goTarget("w", ["tasks"])).toBe("tasks");
    expect(goTarget("w", ["dashboard"])).toBeNull();
    expect(goTarget("S", ["settings"])).toBe("settings");
  });
});
