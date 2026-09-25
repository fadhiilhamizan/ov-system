import { describe, it, expect } from "vitest";
import {
  describeSuperLinks, divisionLabel, eventRecencyKey, matchesSuperLink, sortSuperLinks,
} from "./super-link";
import type { Division, LinkItem, OVEvent } from "./types";

const div = (key: string, name: string, event_id: string): Division =>
  ({ key, name, short: key.slice(0, 4), color: "#000", order: 0, event_id }) as Division;

const ev = (id: string, title: string, over: Partial<OVEvent> = {}): OVEvent =>
  ({ id, title, code: id, event_date: null, plan_start: null, plan_end: null, order: 0, ...over }) as OVEvent;

const link = (id: string, over: Partial<LinkItem> = {}): LinkItem => ({
  id, event_id: "ov1", section: "Hasil Tugas", division: "", name: id, url: `https://x.test/${id}`, note: "", source: "task", ...over,
});

describe("divisionLabel", () => {
  const divisions = [
    div("DIV-MSNZZKHR-5C1LAH", "Humas & Kemitraan", "ov2"),
    div("LO", "Liaison Officer", "ov1"),
    div("LO", "Liaison Officer Baru", "ov2"),
  ];

  // The bug report: a result published from a division with a generated key
  // reached other tasks as "DIV-MSNZZKHR-5C1LAH".
  it("turns a generated key into the division's name", () => {
    expect(divisionLabel({ division: "DIV-MSNZZKHR-5C1LAH", event_id: "ov2" }, divisions)).toBe("Humas & Kemitraan");
  });

  it("prefers the division of the entry's own edition (keys repeat per edition)", () => {
    expect(divisionLabel({ division: "LO", event_id: "ov2" }, divisions)).toBe("Liaison Officer Baru");
    expect(divisionLabel({ division: "LO", event_id: "ov1" }, divisions)).toBe("Liaison Officer");
  });

  it("falls back to any edition, then to a name match", () => {
    expect(divisionLabel({ division: "lo", event_id: "ov9" }, divisions)).toBe("Liaison Officer");
    expect(divisionLabel({ division: "humas & kemitraan", event_id: null }, divisions)).toBe("Humas & Kemitraan");
  });

  it("never shows a generated key whose division is gone, but keeps free text", () => {
    expect(divisionLabel({ division: "DIV-GONE123-ABC", event_id: "ov2" }, divisions)).toBe("");
    expect(divisionLabel({ division: "Panitia Inti", event_id: "ov1" }, divisions)).toBe("Panitia Inti");
    expect(divisionLabel({ division: "", event_id: "ov1" }, divisions)).toBe("");
  });
});

describe("eventRecencyKey", () => {
  it("orders by date, treats an undated edition as the newest, ties on order", () => {
    const keys = [
      eventRecencyKey(ev("a", "A", { event_date: "2025-05-10" })),
      eventRecencyKey(ev("b", "B", { plan_start: "2025-09-01" })),
      eventRecencyKey(ev("c", "C", { order: 3 })),
      eventRecencyKey(ev("d", "D", { order: 4 })),
    ];
    expect([...keys].sort()).toEqual(keys);
  });
});

describe("sortSuperLinks", () => {
  const events = [
    ev("ov1", "OV1 2025", { event_date: "2025-05-10" }),
    ev("ov2", "OV2 2026", { event_date: "2026-05-10" }),
  ];
  const opts = describeSuperLinks([
    link("Proposal", { event_id: "ov1" }),
    link("Anggaran", { event_id: "ov2" }),
    link("Zine", { event_id: "ov2" }),
    link("Arsip bebas", { event_id: null }),
    link("Tanpa URL", { url: "" }),
  ], events, []);

  it("drops entries without a URL", () => {
    expect(opts.map((o) => o.id)).not.toContain("Tanpa URL");
  });

  it("newest Ormawa Visit first, grouped, alphabetical inside, unscoped last", () => {
    expect(sortSuperLinks(opts, "event-desc").map((o) => o.id)).toEqual(["Anggaran", "Zine", "Proposal", "Arsip bebas"]);
  });

  it("oldest Ormawa Visit first", () => {
    expect(sortSuperLinks(opts, "event-asc").map((o) => o.id)).toEqual(["Proposal", "Anggaran", "Zine", "Arsip bebas"]);
  });

  it("by name either way, without touching the input", () => {
    const before = opts.map((o) => o.id);
    expect(sortSuperLinks(opts, "name-asc").map((o) => o.id)).toEqual(["Anggaran", "Arsip bebas", "Proposal", "Zine"]);
    expect(sortSuperLinks(opts, "name-desc").map((o) => o.id)).toEqual(["Zine", "Proposal", "Arsip bebas", "Anggaran"]);
    expect(opts.map((o) => o.id)).toEqual(before);
  });

  it("searches the edition title and the readable division too", () => {
    const [anggaran] = opts.filter((o) => o.id === "Anggaran");
    expect(matchesSuperLink(anggaran, "ov2 2026")).toBe(true);
    expect(matchesSuperLink(anggaran, "proposal")).toBe(false);
  });
});
