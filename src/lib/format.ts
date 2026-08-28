const ID_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function formatRupiah(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  // Rupiah has no sub-unit in practice; round so float artifacts
  // (e.g. 110.00000000000001) never surface as "Rp110,0…".
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function formatRupiahShort(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  if (n >= 1_000_000) return "Rp" + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "jt";
  if (n >= 1_000) return "Rp" + Math.round(n / 1_000) + "rb";
  return "Rp" + n;
}

/** ISO date → "12 Sep 2025" (Indonesian short). */
export function formatDate(iso: string | null | undefined, opts?: { long?: boolean }) {
  if (!iso) return null;
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return null;
  const m = opts?.long ? ID_MONTHS[d.getMonth()] : ID_MONTHS[d.getMonth()].slice(0, 3);
  return `${d.getDate()} ${m} ${d.getFullYear()}`;
}

/**
 * Days from today to `iso`, counted in CALENDAR days.
 *
 * Both ends are reduced to a plain YYYY-MM-DD first and then compared with
 * Date.UTC, so the answer is pure integer arithmetic on the date parts: no
 * timezone, DST shift or hour-of-day can move it. "Today" is today in
 * `APP_TIME_ZONE`, not on whatever clock the server happens to run - see
 * `todayYmd`.
 *
 * A full timestamp is accepted as well as a date: it used to be concatenated
 * with "T00:00:00" unconditionally, which turned one into an invalid date and
 * silently returned null.
 */
export function daysUntil(
  iso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!iso) return null;
  const target = ymdToUtcMillis(iso.trim().slice(0, 10));
  if (target === null) return null;
  const today = ymdToUtcMillis(todayYmd(now));
  if (today === null) return null;
  return Math.round((target - today) / 86400000);
}

/** A YYYY-MM-DD string as a UTC timestamp, or null when it isn't one. */
function ymdToUtcMillis(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

export function relativeDeadline(
  iso: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const d = daysUntil(iso, now);
  if (d === null) return null;
  if (d === 0) return "Hari ini";
  if (d === 1) return "Besok";
  if (d === -1) return "Kemarin";
  if (d < 0) return `${Math.abs(d)} hari lalu`;
  return `${d} hari lagi`;
}

export function isUrl(s: string | null | undefined) {
  return !!s && /^https?:\/\//i.test(s.trim());
}

/**
 * The committee's timezone, and the only definition of "today" in this app.
 *
 * This used to read the host clock (`now.getFullYear()` and friends), which is
 * whatever the server runs on: UTC in production, WIB on a developer's laptop.
 * Those disagree for the first seven hours of every Indonesian day, and the
 * disagreement was visible in two places at once - a task due today was still
 * counted as yesterday's, so Overtime lit up about seven hours late, and the
 * dashboard called a deadline "Besok" when it was in fact today. Deriving the
 * date IN Asia/Jakarta makes the app agree with the people using it, wherever
 * it is deployed.
 */
export const APP_TIME_ZONE = "Asia/Jakarta";

// Built once: constructing an Intl formatter is comparatively expensive, and
// `effectiveStatus` runs on every task on every read.
const YMD_IN_APP_TZ = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today's date in `APP_TIME_ZONE` as YYYY-MM-DD (matches how task dates are
 * stored, so the two can be compared as plain strings).
 *
 * Assembled from `formatToParts` rather than a locale that happens to print
 * ISO order, so no ICU version can change the shape underneath us.
 */
export function todayYmd(now: Date = new Date()): string {
  const parts = YMD_IN_APP_TZ.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** A task whose deadline has passed and isn't done is "overtime". Returns the
 *  effective status; pure so it can be derived at read time (no cron needed). */
export function effectiveStatus(
  status: string,
  endDate: string | null | undefined,
  now: Date = new Date(),
): string {
  if (status !== "done" && status !== "overtime" && endDate && endDate < todayYmd(now)) {
    return "overtime";
  }
  return status;
}

export function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Derive the enrollment year (angkatan) from an ITS NRP.
 * NRP format is `DDDD YY SSSS` - a 4-digit study-program code, then a 2-digit
 * enrollment year, then a running number. Example: `5026(23)1128` → 2023.
 * Returns null when the NRP is too short / not derivable.
 */
export function angkatanFromNrp(nrp: string | null | undefined): number | null {
  const digits = (nrp ?? "").replace(/\D/g, "");
  // A real ITS NRP is 9–10 digits (DDDD YY SSSS). Requiring the canonical
  // length avoids deriving a bogus year from an arbitrary ≥6-digit string.
  if (digits.length < 9 || digits.length > 10) return null;
  const yy = parseInt(digits.slice(4, 6), 10);
  if (Number.isNaN(yy)) return null;
  const year = 2000 + yy;
  // Guard against nonsense (e.g. future beyond next year, or pre-2000 codes).
  if (year < 2000 || year > new Date().getFullYear() + 1) return null;
  return year;
}

