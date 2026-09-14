import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ============================================================
// A date formatted without an explicit `timeZone` reads the HOST clock, and in
// this app the host is two different machines: the server renders the page in
// UTC and the browser hydrates it in WIB. React compares the two, finds
// "14 Sep 2026, 06.56.14" where it rendered "14 Sep 2026, 13.56.14", reports a
// hydration failure (#418) and throws the whole subtree away and re-renders it.
//
// That is not theoretical: it fired eight times on /developer and /settings in
// two days, on every load of both, because `full()` and the backup panel's
// `formatTimestamp` each left the timezone to whoever was formatting. The app
// already has exactly one answer to "what time is it" - `APP_TIME_ZONE` in
// lib/format.ts - and this test is what keeps a new call site from forgetting.
//
// Only calls that ask for date or time PARTS are checked. `formatRupiah` calls
// `toLocaleString("id-ID")` on a NUMBER, which has nothing to do with clocks and
// must stay exempt; a number format never carries `hour` or `dateStyle`.
// ============================================================

const ROOT = join(process.cwd(), "src");

/** Options that only a date/time format has. Their presence is what tells a
 *  clock format apart from a number one. */
const DATE_PARTS = [
  "dateStyle", "timeStyle", "weekday", "era", "year", "month", "day",
  "hour", "minute", "second", "dayPeriod", "hour12", "fractionalSecondDigits",
];

const CALL = /\.toLocale(?:Date|Time)?String\s*\(/g;

/** The argument list of the call starting at `from` (index of the open paren). */
function argsOf(source: string, from: number): string {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") {
      depth--;
      if (depth === 0) return source.slice(from + 1, i);
    }
  }
  return source.slice(from);
}

export function hostTimeZoneOffenders(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(CALL)) {
    const open = m.index + m[0].length - 1;
    const args = argsOf(source, open);
    if (!DATE_PARTS.some((k) => new RegExp(`\\b${k}\\s*:`).test(args))) continue;
    if (/\btimeZone\s*:/.test(args)) continue;
    out.push(source.slice(0, m.index).split("\n").length.toString());
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no host-timezone date formatting", () => {
  it("every date/time format pins an explicit timeZone", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      if (file.endsWith("no-host-timezone.test.ts")) continue;
      const source = readFileSync(file, "utf8");
      for (const line of hostTimeZoneOffenders(source)) {
        offenders.push(`${file.slice(process.cwd().length + 1)}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // Without this the check above is green the moment the regex stops matching
  // anything at all, which is the failure mode of every scanner like it.
  it("still recognises an offender", () => {
    expect(
      hostTimeZoneOffenders('d.toLocaleString("id-ID", { dateStyle: "medium" })'),
    ).toHaveLength(1);
    expect(
      hostTimeZoneOffenders(
        'd.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium" })',
      ),
    ).toHaveLength(0);
    // A number format is not a clock format.
    expect(hostTimeZoneOffenders('n.toLocaleString("id-ID")')).toHaveLength(0);
  });
});
