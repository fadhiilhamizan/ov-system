import { describe, it, expect } from "vitest";
import { percentOfMax } from "./grapify";

describe("percentOfMax (grapify wrapper)", () => {
  it("scales the series against its largest value", () => {
    const out = percentOfMax([
      { label: "LO", value: 12 },
      { label: "EVENT", value: 6 },
      { label: "CREATIVE", value: 3 },
    ]);
    expect(out.map((d) => d.percent)).toEqual([100, 50, 25]);
    expect(out.map((d) => d.value)).toEqual([12, 6, 3]);
  });

  it("returns zeros when every value is zero (grapify would divide by zero)", () => {
    const out = percentOfMax([
      { label: "A", value: 0 },
      { label: "B", value: 0 },
    ]);
    expect(out.map((d) => d.percent)).toEqual([0, 0]);
  });

  it("handles an empty series", () => {
    expect(percentOfMax([])).toEqual([]);
  });

  it("strips commas from labels — comma is grapify's separator", () => {
    const out = percentOfMax([
      { label: "A,B", value: 2 },
      { label: "C", value: 1 },
    ]);
    expect(out.map((d) => d.label)).toEqual(["A B", "C"]);
    expect(out.map((d) => d.percent)).toEqual([100, 50]);
  });

  it("substitutes a placeholder for an empty label", () => {
    expect(percentOfMax([{ label: "", value: 1 }])[0].label).toBe("-");
  });

  it("clamps negative / non-finite values instead of feeding them to grapify", () => {
    const out = percentOfMax([
      { label: "A", value: 10 },
      { label: "B", value: -5 },
      { label: "C", value: Number.NaN },
    ]);
    expect(out.map((d) => d.value)).toEqual([10, 0, 0]);
    expect(out.map((d) => d.percent)).toEqual([100, 0, 0]);
  });

  it("rounds to one decimal", () => {
    const out = percentOfMax([
      { label: "A", value: 3 },
      { label: "B", value: 1 },
    ]);
    expect(out[1].percent).toBe(33.3);
  });

  it("stays correct across repeated calls (grapify keeps module-level state)", () => {
    const first = percentOfMax([
      { label: "A", value: 4 },
      { label: "B", value: 2 },
    ]);
    const second = percentOfMax([
      { label: "A", value: 4 },
      { label: "B", value: 2 },
    ]);
    expect(second).toEqual(first);
    expect(second).toHaveLength(2);
  });
});
