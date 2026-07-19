import { describe, it, expect } from "vitest";
import { formatRupiah, formatRupiahShort, formatDate, daysUntil, isUrl, pct, angkatanFromNrp } from "./format";

describe("formatRupiah", () => {
  it("formats Indonesian thousands", () => {
    expect(formatRupiah(1500000)).toBe("Rp1.500.000");
  });
  it("returns dash for nullish/NaN", () => {
    expect(formatRupiah(null)).toBe("-");
    expect(formatRupiah(undefined)).toBe("-");
    expect(formatRupiah(NaN)).toBe("-");
  });
});

describe("formatRupiahShort", () => {
  it("abbreviates millions and thousands", () => {
    expect(formatRupiahShort(2000000)).toBe("Rp2jt");
    expect(formatRupiahShort(2500000)).toBe("Rp2.5jt");
    expect(formatRupiahShort(15000)).toBe("Rp15rb");
    expect(formatRupiahShort(500)).toBe("Rp500");
  });
});

describe("formatDate", () => {
  it("formats an ISO date to short Indonesian", () => {
    expect(formatDate("2025-09-12")).toBe("12 Sep 2025");
  });
  it("supports the long month form", () => {
    expect(formatDate("2025-09-12", { long: true })).toBe("12 September 2025");
  });
  it("returns null for empty or invalid input", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("not-a-date")).toBeNull();
  });
});

describe("daysUntil", () => {
  it("is 0 for today", () => {
    // Use the LOCAL date (daysUntil works in local time; toISOString is UTC and
    // would drift across the midnight-UTC boundary).
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(daysUntil(today)).toBe(0);
  });
  it("returns null for nullish", () => {
    expect(daysUntil(null)).toBeNull();
  });
});

describe("isUrl", () => {
  it("accepts http(s) and rejects the rest", () => {
    expect(isUrl("https://example.com")).toBe(true);
    expect(isUrl("http://x.io/a")).toBe(true);
    expect(isUrl("  https://trimmed.com  ")).toBe(true);
    expect(isUrl("ftp://x")).toBe(false);
    expect(isUrl("javascript:alert(1)")).toBe(false);
    expect(isUrl("")).toBe(false);
    expect(isUrl(null)).toBe(false);
  });
});

describe("pct", () => {
  it("computes a rounded percentage", () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(1, 3)).toBe(33.3);
  });
  it("guards against divide-by-zero", () => {
    expect(pct(5, 0)).toBe(0);
  });
});

describe("angkatanFromNrp", () => {
  it("derives the enrollment year from the NRP", () => {
    expect(angkatanFromNrp("5026231128")).toBe(2023);
    expect(angkatanFromNrp("5026221210")).toBe(2022);
    expect(angkatanFromNrp("5026241003")).toBe(2024);
  });
  it("works regardless of the study-program prefix", () => {
    expect(angkatanFromNrp("5051231041")).toBe(2023);
  });
  it("ignores non-digit characters", () => {
    expect(angkatanFromNrp("5026(23)1128")).toBe(2023);
  });
  it("returns null for too-short or empty input", () => {
    expect(angkatanFromNrp("")).toBeNull();
    expect(angkatanFromNrp(null)).toBeNull();
    expect(angkatanFromNrp("12345")).toBeNull();
  });
  it("returns null for an implausible future year", () => {
    expect(angkatanFromNrp("5026991128")).toBeNull();
  });
});
