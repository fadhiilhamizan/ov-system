import { describe, it, expect } from "vitest";
import {
  viewDays, step, rangeTitle, ymd, parseYmd, activeOn, deadlinesByDate, layoutTimed, hourRange, isCalView,
} from "./calendar";

const d = (s: string) => parseYmd(s)!;
const days = (xs: Date[]) => xs.map(ymd);

describe("viewDays", () => {
  const ref = d("2026-09-30"); // a Wednesday
  it("covers one day, four days, and the Sunday-first week", () => {
    expect(days(viewDays("day", ref))).toEqual(["2026-09-30"]);
    expect(days(viewDays("4day", ref))).toEqual(["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(days(viewDays("week", ref))).toEqual([
      "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03",
    ]);
  });
  it("gives the month a full 6x7 grid starting on the Sunday before the 1st", () => {
    const m = viewDays("month", ref);
    expect(m).toHaveLength(42);
    expect(ymd(m[0])).toBe("2026-08-30");
    expect(m[0].getDay()).toBe(0);
  });
  it("covers a whole year and a whole month for the schedule", () => {
    expect(viewDays("year", ref)).toHaveLength(365);
    expect(days(viewDays("schedule", ref)).slice(0, 1)).toEqual(["2026-09-01"]);
    expect(viewDays("schedule", ref)).toHaveLength(30);
  });
});

describe("step", () => {
  it("moves by the size of each view", () => {
    const ref = d("2026-01-31");
    expect(ymd(step("day", ref, 1))).toBe("2026-02-01");
    expect(ymd(step("4day", ref, -1))).toBe("2026-01-27");
    expect(ymd(step("week", ref, 1))).toBe("2026-02-07");
    // Month steps land on the 1st, so Jan 31 + 1 month is February, not March.
    expect(ymd(step("month", ref, 1))).toBe("2026-02-01");
    expect(ymd(step("year", ref, -1))).toBe("2025-01-01");
  });
});

describe("rangeTitle", () => {
  it("reads naturally across month and year boundaries", () => {
    expect(rangeTitle("day", d("2026-09-30"))).toBe("Rabu, 30 September 2026");
    expect(rangeTitle("4day", d("2026-09-29"))).toBe("29 September - 2 Oktober 2026");
    expect(rangeTitle("week", d("2026-12-30"))).toBe("27 Desember 2026 - 2 Januari 2027");
    expect(rangeTitle("week", d("2026-09-16"))).toBe("13 - 19 September 2026");
    expect(rangeTitle("month", d("2026-09-16"))).toBe("September 2026");
    expect(rangeTitle("year", d("2026-09-16"))).toBe("2026");
  });
});

describe("tasks on dates", () => {
  const tasks = [
    { id: "a", start_date: "2026-09-01", end_date: "2026-09-05" },
    { id: "b", start_date: null, end_date: "2026-09-03" },
    { id: "c", start_date: "2026-09-10", end_date: null },
    { id: "d", start_date: "2026-09-09", end_date: "2026-09-04" }, // start after deadline: treat as one day
  ];
  it("places a deadline on its date", () => {
    expect(deadlinesByDate(tasks).get("2026-09-03")!.map((t) => t.id)).toEqual(["b"]);
  });
  it("spans a task from its start to its deadline", () => {
    expect(activeOn(tasks, "2026-09-03").map((t) => t.id)).toEqual(["a", "b"]);
    expect(activeOn(tasks, "2026-09-04").map((t) => t.id)).toEqual(["a", "d"]);
    expect(activeOn(tasks, "2026-09-10")).toEqual([]);
  });
});

describe("layoutTimed", () => {
  it("places sessions by minutes and lanes the overlapping ones", () => {
    const blocks = layoutTimed([
      { id: 1, time_start: "08.00", time_end: "09.00" },
      { id: 2, time_start: "08.30", time_end: "09.30" },
      { id: 3, time_start: "10.00", time_end: "" },
      { id: 4, time_start: "", time_end: "11.00" },
    ]);
    expect(blocks.map((b) => [b.item.id, b.start, b.end, b.lane, b.lanes])).toEqual([
      [1, 480, 540, 0, 2],
      [2, 510, 570, 1, 2],
      [3, 600, 630, 0, 1],
    ]);
  });
  it("shows at least 07-19 and widens for early or late sessions", () => {
    expect(hourRange([])).toEqual([7, 19]);
    expect(hourRange([{ start: 5 * 60, end: 22 * 60 + 30 }])).toEqual([4, 24]);
  });
});

it("knows its views", () => {
  expect(isCalView("4day")).toBe(true);
  expect(isCalView("fortnight")).toBe(false);
});
