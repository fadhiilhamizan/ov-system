const ID_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function formatRupiah(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return "Rp" + n.toLocaleString("id-ID");
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

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export function relativeDeadline(iso: string | null | undefined): string | null {
  const d = daysUntil(iso);
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

export function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Derive the enrollment year (angkatan) from an ITS NRP.
 * NRP format is `DDDD YY SSSS` — a 4-digit study-program code, then a 2-digit
 * enrollment year, then a running number. Example: `5026(23)1128` → 2023.
 * Returns null when the NRP is too short / not derivable.
 */
export function angkatanFromNrp(nrp: string | null | undefined): number | null {
  const digits = (nrp ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  const yy = parseInt(digits.slice(4, 6), 10);
  if (Number.isNaN(yy)) return null;
  const year = 2000 + yy;
  // Guard against nonsense (e.g. future beyond next year, or pre-2000 codes).
  if (year < 2000 || year > new Date().getFullYear() + 1) return null;
  return year;
}
