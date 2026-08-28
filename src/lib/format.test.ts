import { describe, it, expect } from "vitest";
import { formatRupiah, formatRupiahShort, formatDate, daysUntil, isUrl, pct, angkatanFromNrp, effectiveStatus, relativeDeadline, todayYmd } from "./format";

// An instant that is a DIFFERENT calendar date in UTC and in Jakarta:
// 18:00 UTC on the 15th is 01:00 WIB on the 16th. Every date helper must
// answer "16", because that is the date the committee is living in. Reading
// the host clock instead is what made Overtime fire seven hours late and the
// dashboard say "Besok" about something due today.
const MIDNIGHT_GAP = new Date("2026-06-15T18:00:00Z");

describe("formatRupiah", () => {
  it("formats Indonesian thousands", () => {
    expect(formatRupiah(1500000)).toBe("Rp1.500.000");
  });
  it("returns dash for nullish/NaN", () => {
    expect(formatRupiah(null)).toBe("-");
    expect(formatRupiah(undefined)).toBe("-");
    expect(formatRupiah(NaN)).toBe("-");
  });
  it("rounds float artifacts to whole rupiah", () => {
    expect(formatRupiah(110.00000000000001)).toBe("Rp110");
    expect(formatRupiah(0.30000000000000004)).toBe("Rp0");
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

describe("todayYmd (Asia/Jakarta, not the host clock)", () => {
  it("uses the Jakarta date across the UTC midnight gap", () => {
    expect(todayYmd(MIDNIGHT_GAP)).toBe("2026-06-16");
  });
  it("agrees with itself whatever the machine timezone is", () => {
    expect(todayYmd()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("daysUntil", () => {
  it("is 0 for today", () => {
    // Self-consistent by construction, so the test cannot drift with the clock.
    expect(daysUntil(todayYmd())).toBe(0);
  });
  it("counts calendar days from the Jakarta date", () => {
    expect(daysUntil("2026-06-16", MIDNIGHT_GAP)).toBe(0);
    expect(daysUntil("2026-06-17", MIDNIGHT_GAP)).toBe(1);
    expect(daysUntil("2026-06-15", MIDNIGHT_GAP)).toBe(-1);
  });
  it("accepts a full timestamp, not only a date", () => {
    // Used to be concatenated with "T00:00:00" and silently return null.
    expect(daysUntil("2026-06-16T23:30:00Z", MIDNIGHT_GAP)).toBe(0);
  });
  it("returns null for nullish or malformed input", () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil("not-a-date")).toBeNull();
  });
});

describe("relativeDeadline", () => {
  it("says Hari ini for something due on the Jakarta date", () => {
    expect(relativeDeadline("2026-06-16", MIDNIGHT_GAP)).toBe("Hari ini");
    expect(relativeDeadline("2026-06-17", MIDNIGHT_GAP)).toBe("Besok");
    expect(relativeDeadline("2026-06-15", MIDNIGHT_GAP)).toBe("Kemarin");
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

describe("effectiveStatus (auto overtime)", () => {
  // Pinned to an explicit offset: a bare "2026-06-15T09:00:00" is parsed in the
  // MACHINE's timezone, so these assertions used to depend on where they ran.
  const NOW = new Date("2026-06-15T09:00:00+07:00");
  it("flips at Jakarta midnight, not the host's", () => {
    // 01:00 WIB on the 16th: the 15th is over for the committee, so a task due
    // on the 15th is late. On a UTC server the old code still said "todo".
    expect(effectiveStatus("todo", "2026-06-15", MIDNIGHT_GAP)).toBe("overtime");
    expect(effectiveStatus("todo", "2026-06-16", MIDNIGHT_GAP)).toBe("todo");
  });
  it("promotes an overdue todo/ongoing task to overtime", () => {
    expect(effectiveStatus("todo", "2026-06-14", NOW)).toBe("overtime");
    expect(effectiveStatus("ongoing", "2026-01-01", NOW)).toBe("overtime");
  });
  it("leaves done tasks alone even if overdue", () => {
    expect(effectiveStatus("done", "2020-01-01", NOW)).toBe("done");
  });
  it("does not touch tasks due today or in the future", () => {
    expect(effectiveStatus("todo", "2026-06-15", NOW)).toBe("todo"); // due today
    expect(effectiveStatus("ongoing", "2026-12-31", NOW)).toBe("ongoing");
  });
  it("is a no-op when there is no deadline", () => {
    expect(effectiveStatus("todo", null, NOW)).toBe("todo");
    expect(effectiveStatus("todo", "", NOW)).toBe("todo");
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
  it("requires a canonical NRP length (9–10 digits)", () => {
    expect(angkatanFromNrp("50262311")).toBeNull(); // 8 digits - too short
    expect(angkatanFromNrp("50262311280000")).toBeNull(); // 14 digits - too long
    expect(angkatanFromNrp("502623112")).toBe(2023); // 9 digits - ok
  });
});
