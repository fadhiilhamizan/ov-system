import { describe, it, expect } from "vitest";
import {
  taskPicList, picOptions, matchesDivision, matchesPics, hasOrphanTasks,
  NO_DIVISION, NO_PIC,
} from "./task-filters";
import type { Task } from "./types";

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1", event_id: "ov1", division: "EVENT", no: "1", pic: "Budi",
  title: "Tugas", start_date: null, start_raw: "", end_date: null, end_raw: "",
  notes: "", result: "", status: "todo", ...over,
});

const KEYS = new Set(["EVENT", "LO"]);

describe("taskPicList", () => {
  it("splits a multi-name PIC field", () => {
    expect(taskPicList("Ali, Budi")).toEqual(["Ali", "Budi"]);
  });
  it("trims and drops empties", () => {
    expect(taskPicList(" Ali ,, Budi , ")).toEqual(["Ali", "Budi"]);
  });
  it("treats blank and null as nobody", () => {
    expect(taskPicList("")).toEqual([]);
    expect(taskPicList(null)).toEqual([]);
    expect(taskPicList(undefined)).toEqual([]);
  });
});

describe("picOptions", () => {
  it("lists each person once, sorted", () => {
    const list = picOptions([task({ pic: "Budi" }), task({ pic: "Ali, Budi" }), task({ pic: "" })]);
    expect(list).toEqual(["Ali", "Budi"]);
  });
  it("de-dupes case-insensitively but keeps the first spelling", () => {
    expect(picOptions([task({ pic: "Budi" }), task({ pic: "budi" })])).toEqual(["Budi"]);
  });
});

describe("matchesDivision", () => {
  it("'all' matches everything", () => {
    expect(matchesDivision(task(), "all", KEYS)).toBe(true);
    expect(matchesDivision(task({ division: "" }), "all", KEYS)).toBe(true);
  });
  it("matches an exact division", () => {
    expect(matchesDivision(task({ division: "EVENT" }), "EVENT", KEYS)).toBe(true);
    expect(matchesDivision(task({ division: "LO" }), "EVENT", KEYS)).toBe(false);
  });
  it("'tanpa divisi' catches a blank division", () => {
    expect(matchesDivision(task({ division: "" }), NO_DIVISION, KEYS)).toBe(true);
    expect(matchesDivision(task({ division: "EVENT" }), NO_DIVISION, KEYS)).toBe(false);
  });
  it("'tanpa divisi' also catches a division that no longer exists", () => {
    // After a division is deleted its tasks keep the old key; without this they
    // would be unreachable from the toolbar entirely.
    expect(matchesDivision(task({ division: "DIHAPUS" }), NO_DIVISION, KEYS)).toBe(true);
    expect(matchesDivision(task({ division: "DIHAPUS" }), "EVENT", KEYS)).toBe(false);
  });
});

describe("matchesPics", () => {
  it("an empty selection filters nothing", () => {
    expect(matchesPics(task({ pic: "Budi" }), new Set())).toBe(true);
    expect(matchesPics(task({ pic: "" }), new Set())).toBe(true);
  });
  it("matches any one of a task's several PICs", () => {
    const picked = new Set(["ali"]);
    expect(matchesPics(task({ pic: "Ali, Budi" }), picked)).toBe(true);
    expect(matchesPics(task({ pic: "Budi" }), picked)).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(matchesPics(task({ pic: "BUDI" }), new Set(["budi"]))).toBe(true);
  });
  it("only 'tanpa PIC' matches an unassigned task", () => {
    expect(matchesPics(task({ pic: "" }), new Set(["budi"]))).toBe(false);
    expect(matchesPics(task({ pic: "" }), new Set([NO_PIC]))).toBe(true);
    // ...and picking "tanpa PIC" must not sweep up assigned tasks.
    expect(matchesPics(task({ pic: "Budi" }), new Set([NO_PIC]))).toBe(false);
  });
  it("matches when any of several ticked people is on the task", () => {
    expect(matchesPics(task({ pic: "Budi" }), new Set(["ali", "budi"]))).toBe(true);
  });
});

describe("hasOrphanTasks", () => {
  it("is false when every task has a live division", () => {
    expect(hasOrphanTasks([task({ division: "EVENT" })], KEYS)).toBe(false);
  });
  it("is true for a blank or dangling division", () => {
    expect(hasOrphanTasks([task({ division: "" })], KEYS)).toBe(true);
    expect(hasOrphanTasks([task({ division: "DIHAPUS" })], KEYS)).toBe(true);
  });
});
