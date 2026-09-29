// Clock arithmetic for the rundown, shared by the table and the XLSX import.
// Pure: no React, no timezone (these are wall-clock strings, not instants).

/** Parse a clock string ("07.30", "07:30", "0730", "7") to minutes-of-day. */
export function parseTime(s: string): number | null {
  const str = (s ?? "").trim();
  if (!str) return null;
  const m = str.match(/^(\d{1,2})\s*[.:h ]?\s*(\d{2})$/);
  if (m) {
    const h = +m[1], min = +m[2];
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }
  const only = str.match(/^(\d{1,2})$/);
  if (only && +only[1] <= 23) return +only[1] * 60;
  return null;
}

/** Format a minute count to "45'", "1j", or "1j 30'". */
export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}j ${m}'`;
  if (h) return `${h}j`;
  return `${m}'`;
}

/** Duration between two clock strings, or null if not derivable. */
export function computeDuration(start: string, end: string): string | null {
  const a = parseTime(start), b = parseTime(end);
  if (a === null || b === null) return null;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60; // crosses midnight
  return formatDuration(diff);
}

/** Normalise a clock string to the table's "HH.MM" form, or null. */
export function normaliseTime(s: string): string | null {
  const m = parseTime(s);
  if (m === null) return null;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}.${String(m % 60).padStart(2, "0")}`;
}
