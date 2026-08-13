import { describe, it, expect } from "vitest";
import { APP_ROUTES, guideHref, isKnownHref, resolveHref, routeCatalogue } from "./links";
import { GUIDE } from "@/lib/guide";
import { NAV } from "@/components/layout/nav-config";

describe("resolveHref", () => {
  it("keeps a known path", () => {
    expect(resolveHref("/tasks")).toBe("/tasks");
    expect(resolveHref("/tasks/")).toBe("/tasks");
  });

  it("keeps a known anchor", () => {
    expect(resolveHref("/settings#changelog")).toBe("/settings#changelog");
    expect(resolveHref("/panduan#guide-violet")).toBe("/panduan#guide-violet");
  });

  it("drops an unknown anchor but keeps the page", () => {
    // The model does invent plausible-looking anchors. Landing at the top of
    // the right page still helps.
    expect(resolveHref("/settings#riwayat-versi")).toBe("/settings");
  });

  it("rejects a path that does not exist", () => {
    // The original bug, pinned: Violet is a button, not a page.
    expect(resolveHref("/violet")).toBeUndefined();
    expect(resolveHref("/tugas")).toBeUndefined();
    expect(resolveHref("/settings/backup")).toBeUndefined();
  });

  it("rejects anything pointing off this app", () => {
    expect(resolveHref("https://ov-system.vercel.app/violet")).toBeUndefined();
    expect(resolveHref("//evil.example.com")).toBeUndefined();
    expect(resolveHref("javascript:alert(1)")).toBeUndefined();
    expect(resolveHref("mailto:someone@example.com")).toBeUndefined();
    expect(resolveHref("")).toBeUndefined();
    expect(resolveHref(undefined)).toBeUndefined();
  });

  it("strips a query string", () => {
    expect(resolveHref("/tasks?view=kanban")).toBe("/tasks");
  });

  it("isKnownHref agrees with resolveHref", () => {
    expect(isKnownHref("/faq")).toBe(true);
    expect(isKnownHref("/violet")).toBe(false);
  });
});

describe("guideHref", () => {
  it("points at the menu when the section has one", () => {
    expect(guideHref("rundown")).toBe("/rundown");
  });

  it("points at the guide section when it does not", () => {
    expect(guideHref("violet")).toBe("/panduan#guide-violet");
  });

  it("never returns a dead link for any guide section", () => {
    for (const s of GUIDE) {
      expect(isKnownHref(guideHref(s.key)), `dead link for guide "${s.key}"`).toBe(true);
    }
  });
});

describe("the route table matches the app", () => {
  it("lists every navigable menu", () => {
    // A menu missing here means Violet can never link to it.
    for (const item of NAV.flatMap((g) => g.items)) {
      expect(APP_ROUTES[item.href], `NAV item ${item.href} is not in APP_ROUTES`).toBeDefined();
    }
  });

  it("has a panduan anchor for every guide section", () => {
    // guide-sections.tsx renders exactly these ids; drift here means a
    // shortcut that silently degrades to the top of the page.
    for (const s of GUIDE) {
      expect(
        APP_ROUTES["/panduan"],
        `no anchor guide-${s.key}`,
      ).toContain(`guide-${s.key}`);
    }
  });

  it("has no anchor for a section that no longer exists", () => {
    const keys = new Set(GUIDE.map((s) => s.key));
    for (const anchor of APP_ROUTES["/panduan"]) {
      if (!anchor.startsWith("guide-")) continue;
      expect(keys, `stale anchor ${anchor}`).toContain(anchor.slice("guide-".length));
    }
  });

  it("renders a catalogue the model can read", () => {
    const text = routeCatalogue();
    expect(text).toContain("/settings#changelog");
    expect(text).not.toContain("/violet\n");
  });
});
