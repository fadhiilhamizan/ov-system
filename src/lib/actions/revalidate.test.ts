import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

const { revalidateEntities } = await import("./revalidate");

/** Every (path, type) pair passed to Next for one call. */
function callsFor(...entities: Parameters<typeof revalidateEntities>) {
  revalidatePath.mockClear();
  revalidateEntities(...entities);
  return revalidatePath.mock.calls.map((c) => c.join(" "));
}

beforeEach(() => revalidatePath.mockClear());

describe("revalidateEntities", () => {
  it("busts the division DETAIL route, not just the list", () => {
    // Regression: the consumer lists named "/divisions" only. Next matches
    // paths literally, so nothing ever invalidated /divisions/[key] and a task
    // edited in Work Breakdown stayed stale on Papan Divisi. A dynamic route
    // has to be named by its route PATTERN plus the "page" type.
    expect(callsFor("tasks")).toContain("/divisions/[key] page");
  });

  it("passes the page type ONLY for dynamic routes", () => {
    for (const call of callsFor("tasks", "members", "links", "teams")) {
      const [path, type] = call.split(" ");
      expect(type).toBe(path.includes("[") ? "page" : undefined);
    }
  });

  it("collapses to a single full-tree pass when anything is layout-wide", () => {
    // "events" drives the topbar switcher on every route, so it is the one
    // case where the narrow paths are pointless work.
    expect(callsFor("events")).toEqual(["/ layout"]);
    expect(callsFor("tasks", "events")).toEqual(["/ layout"]);
  });

  it("does not repeat a path shared by two entities", () => {
    const calls = callsFor("tasks", "taskLinks");
    expect(new Set(calls).size).toBe(calls.length);
  });

  it("busts nothing outside the entities it was given", () => {
    expect(callsFor("faq")).toEqual(["/faq"]);
  });
});
