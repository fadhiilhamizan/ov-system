import { describe, it, expect } from "vitest";
import { SHAREABLE_MODULES, SHARE_TARGET, isShareModule, shareLanding, shareModuleForPath, shareUrl } from "./share";
import { MODULE_ACCESS_LEVEL } from "./constants";
import { ALL_NAV_ITEMS } from "@/components/layout/nav-config";

describe("share links", () => {
  it("only offers menus a Tamu can actually open", () => {
    for (const m of SHAREABLE_MODULES) {
      const level = (MODULE_ACCESS_LEVEL as Record<string, Record<string, string>>)[m]?.guest;
      expect(level, `${m} is shareable but a guest has "${level}" access`).not.toBe("none");
    }
  });

  it("never shares the roster, the budget, Super Link or prospects' contacts", () => {
    for (const m of ["members", "budget", "links", "prospects", "settings", "roles", "inbox"]) {
      expect(isShareModule(m)).toBe(false);
    }
  });

  it("lands on real menus", () => {
    for (const m of SHAREABLE_MODULES) {
      expect(ALL_NAV_ITEMS.some((i) => i.href === SHARE_TARGET[m]), m).toBe(true);
    }
  });

  it("builds the URL, demo and view state included", () => {
    expect(shareUrl("https://ov.app", "ov2-2026", "rundown")).toBe("https://ov.app/s/ov2-2026/rundown");
    expect(shareUrl("https://ov.app", "a b", "calendar", { demo: true, query: { view: "week", date: "2026-09-20" } }))
      .toBe("https://ov.app/s/a%20b/calendar?demo=1&view=week&date=2026-09-20");
  });

  it("passes on only the whitelisted query keys, so it is not an open redirect", () => {
    expect(shareLanding("calendar", { view: "week", date: "2026-09-20", next: "https://evil.example" }))
      .toBe("/calendar?view=week&date=2026-09-20");
    expect(shareLanding("calendar", { view: "//evil.example" })).toBe("/calendar");
    expect(shareLanding("tasks", {})).toBe("/tasks");
  });

  it("knows which menu a path is", () => {
    expect(shareModuleForPath("/rundown")).toBe("rundown");
    expect(shareModuleForPath("/calendar")).toBe("calendar");
    expect(shareModuleForPath("/members")).toBeNull();
  });
});
