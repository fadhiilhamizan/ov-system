// ============================================================
// Turn the two benchmarking spreadsheets into migration 0042.
//
//   node scripts/gen-compare-seed.mjs <hmti-uns.csv> <hmti-ub.csv>
//
// Generated rather than hand-written for the usual reason: the source cells are
// full paragraphs containing commas, quotes, and newlines, and hand-escaping
// thirty of them into SQL is how a stray quote ends up closing a literal early
// (the bug class `npm run db:lint` exists to catch).
//
// The CSVs are NOT committed: they are the user's working documents, and the
// migration is the artefact that matters. Re-run this only if they are revised.
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertSqlSane } from "./sql-lint.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The edition these assessments belong to: "HMSI ITS x HMD Eksternal". */
const EVENT = "ov2-2026";

/** RFC4180-ish: quoted fields may contain commas, newlines and doubled quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const clean = (s) => (s ?? "").trim().replace(/\s+/g, " ");
const q = (s) => `'${String(s ?? "").replace(/'/g, "''")}'`;

/**
 * A row whose first cell carries a heading and whose remaining cells are empty
 * is a SECTION, not an assessment: that is how the UNS sheet groups its rows.
 */
const isSection = (cells) =>
  clean(cells[0]) !== "" && !/^\d+$/.test(clean(cells[0])) && cells.slice(1).every((c) => !clean(c));

function toEntries(csvPath) {
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const body = rows.slice(1); // drop the header line
  const out = [];
  let section = "";
  for (const cells of body) {
    if (isSection(cells)) { section = clean(cells[0]); continue; }
    const [no, aspect, indicator, plus, minus] = cells.map(clean);
    // An assessment with no aspect AND no indicator carries nothing to compare.
    if (!aspect && !indicator) continue;
    out.push({ no, section, aspect, indicator, plus, minus });
  }
  return out;
}

const [unsPath, ubPath] = process.argv.slice(2);
if (!unsPath || !ubPath) {
  console.error("usage: node scripts/gen-compare-seed.mjs <uns.csv> <ub.csv>");
  process.exit(1);
}

const SUBJECTS = [
  { org: "HMTI UNS", entries: toEntries(unsPath) },
  { org: "HMTI UB", entries: toEntries(ubPath) },
];

let sql = `-- ============================================================
-- Data Compare untuk Ormawa Visit "HMSI ITS x HMD Eksternal" (${EVENT}).
--
-- DIBUAT OLEH SKRIP: scripts/gen-compare-seed.mjs, dari dua spreadsheet
-- benchmarking milik External Affairs. Jangan disunting dengan tangan - jalankan
-- ulang skripnya kalau sumbernya berubah.
--
-- Idempoten: subjek dipasang dengan on conflict do nothing, dan penilaiannya
-- dihapus lebih dulu per subjek supaya menjalankan ulang tidak menggandakan.
-- Penilaian buatan tangan pada subjek LAIN tidak tersentuh.
-- ============================================================

do $do$
declare
  v_subject uuid;
begin
  if to_regclass('public.compare_subjects') is null then
    raise notice 'compare_subjects belum ada, jalankan 0041 dulu. Dilewati.';
    return;
  end if;
  if not exists (select 1 from events where id = ${q(EVENT)}) then
    raise notice 'Ormawa Visit ${EVENT} tidak ada di database ini. Dilewati.';
    return;
  end if;
`;

SUBJECTS.forEach((subject, si) => {
  sql += `
  -- ---------------- ${subject.org} (${subject.entries.length} penilaian) ----------------
  insert into compare_subjects (event_id, org_name, "order")
  values (${q(EVENT)}, ${q(subject.org)}, ${si})
  on conflict do nothing;

  select id into v_subject from compare_subjects
   where event_id = ${q(EVENT)} and lower(btrim(org_name)) = lower(${q(subject.org)});

  delete from compare_entries where subject_id = v_subject;
`;
  subject.entries.forEach((e, i) => {
    sql += `  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values (${q(EVENT)}, v_subject, ${q(subject.org)}, ${q(e.no)}, ${q(e.section)}, ${q(e.aspect)}, ${q(e.indicator)}, ${q(e.plus)}, ${q(e.minus)}, ${i});\n`;
  });
});

sql += `end $do$;

-- Verifikasi.
select s.org_name, count(e.id) as penilaian
  from compare_subjects s
  left join compare_entries e on e.subject_id = s.id
 where s.event_id = ${q(EVENT)}
 group by s.org_name
 order by s.org_name;
`;

assertSqlSane(sql, "0042_compare_hmd_eksternal_data.sql");
const out = join(__dirname, "../supabase/migrations/0042_compare_hmd_eksternal_data.sql");
writeFileSync(out, sql, "utf8");
console.log(
  `Wrote ${out}\n` +
    SUBJECTS.map((s) => `  ${s.org}: ${s.entries.length} penilaian`).join("\n"),
);
