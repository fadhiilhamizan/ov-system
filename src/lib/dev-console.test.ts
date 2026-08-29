import { describe, it, expect, beforeEach } from "vitest";
import { pushLine, getConsoleLines, clearConsoleLines, subscribeConsole } from "./dev-console";

// ------------------------------------------------------------------
// The in-page console buffer.
//
// It feeds useSyncExternalStore, which compares snapshots BY IDENTITY. That
// puts two requirements in tension: the array handed out must be a new
// reference after a write (or the panel never updates), and it must be the SAME
// reference when nothing has been written (or the hook loops forever). The
// buffer is mutated and the snapshot copied lazily to satisfy both without
// paying a 400-element copy on every log line.
// ------------------------------------------------------------------
beforeEach(() => {
  clearConsoleLines();
});

describe("snapshot identity", () => {
  it("returns the SAME array when nothing was written", () => {
    pushLine("log", "a");
    const first = getConsoleLines();
    expect(getConsoleLines()).toBe(first);
    expect(getConsoleLines()).toBe(first);
  });

  it("returns a NEW array after a write", () => {
    pushLine("log", "a");
    const before = getConsoleLines();
    pushLine("log", "b");
    expect(getConsoleLines()).not.toBe(before);
  });

  it("does not mutate a snapshot already handed out", () => {
    // The panel may still be rendering the previous snapshot.
    pushLine("log", "a");
    const held = getConsoleLines();
    expect(held).toHaveLength(1);
    pushLine("log", "b");
    expect(held).toHaveLength(1);
  });

  it("clearing also changes the reference", () => {
    pushLine("log", "a");
    const before = getConsoleLines();
    clearConsoleLines();
    expect(getConsoleLines()).not.toBe(before);
    expect(getConsoleLines()).toHaveLength(0);
  });
});

describe("bounded buffer", () => {
  it("keeps the newest lines and drops the oldest", () => {
    for (let i = 0; i < 1000; i++) pushLine("log", `line ${i}`);
    const lines = getConsoleLines();
    expect(lines.length).toBeLessThanOrEqual(500); // cap plus trim slack
    expect(lines[lines.length - 1].text).toBe("line 999");
    // The very first lines are gone.
    expect(lines.some((l) => l.text === "line 0")).toBe(false);
  });

  it("never grows without bound however long the loop runs", () => {
    for (let i = 0; i < 5000; i++) pushLine("log", "x");
    expect(getConsoleLines().length).toBeLessThanOrEqual(500);
  });

  it("ids keep increasing so React keys stay unique after trimming", () => {
    for (let i = 0; i < 600; i++) pushLine("log", `l${i}`);
    const ids = getConsoleLines().map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });
});

describe("subscribers", () => {
  it("notifies on every write, and stops after unsubscribe", () => {
    let hits = 0;
    const off = subscribeConsole(() => hits++);
    pushLine("log", "a");
    pushLine("log", "b");
    expect(hits).toBe(2);
    off();
    pushLine("log", "c");
    expect(hits).toBe(2);
  });

  it("writes cost nothing to read when nobody is subscribed", () => {
    // The point of the lazy snapshot: with the panel closed, a logging loop
    // never builds a copy at all. Observable as the snapshot staying stale
    // until somebody actually asks for it.
    pushLine("log", "seed");
    const before = getConsoleLines();
    for (let i = 0; i < 100; i++) pushLine("log", `noise ${i}`);
    // Still the old reference in hand; the new one only materialises on read.
    expect(before).toHaveLength(1);
    expect(getConsoleLines().length).toBe(101);
  });
});
