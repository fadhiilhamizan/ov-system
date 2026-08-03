// Generates supabase/seed.sql from the Excel-derived seed.json.
// Usage: node scripts/gen-seed-sql.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertSqlSane } from "./sql-lint.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "../src/lib/seed/seed.json"), "utf8"));

const q = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "null" : Number(v));
const b = (v) => (v ? "true" : "false");
const d = (v) => (v ? `'${v}'` : "null");
const jb = (v) => `'${JSON.stringify(v ?? {}).replace(/'/g, "''")}'::jsonb`;
/** text[] literal, e.g. ["LO","EVENT"] -> array['LO','EVENT']::text[] */
const arr = (v) =>
  !v || !v.length
    ? "'{}'::text[]"
    : `array[${v.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",")}]::text[]`;

// ============================================================
// Edition scoping.
//
// `getProspects(eventId)` / `getMembers(eventId)` filter LENIENTLY: a row whose
// event_id is null is treated as belonging to every edition. That is deliberate
// (legacy unscoped rows still render), but it means an unscoped row LEAKS —
// every Ormawa Visit showed all 61 prospects instead of its own 12-19.
//
// So the generator refuses to emit an unscoped prospect or member. Prospects
// carry their edition in the `batch` text, which is mapped here; a batch name
// that isn't recognised is a hard error rather than a silent null.
// ============================================================
const BATCH_TO_EVENT = {
  "Ormawa Visit Pertama 2025": "ov1-2025",
  "Ormawa Visit Kedua 2025": "ov2-2025",
  "Ormawa Visit Pertama 2026": "ov1-2026",
  "Ormawa Visit Kedua 2026": "ov2-2026",
};

function prospectEvent(p) {
  if (p.event_id) return p.event_id;
  const mapped = BATCH_TO_EVENT[(p.batch ?? "").trim()];
  if (!mapped) {
    throw new Error(
      `seed.json: prospek "${p.org_name || p.id}" tidak punya event_id dan batch-nya ` +
        `("${p.batch}") tidak dikenal. Tambahkan pemetaannya di BATCH_TO_EVENT — ` +
        `sebuah prospek tanpa edisi akan muncul di SEMUA Ormawa Visit.`,
    );
  }
  return mapped;
}

let out = `-- Auto-generated from Excel seed. Run after migrations.\n-- HMSI ITS Ormawa Visit\nbegin;\n\n`;

// Events first — divisions are per-event (migration 0018) and reference them.
out += `-- events\n`;
for (const e of seed.events)
  out += `insert into events(id,code,title,partner,campus,type,mode,cabinet,event_date,plan_start,plan_end,location,status,"order") values (${q(e.id)},${q(e.code)},${q(e.title)},${q(e.partner)},${q(e.campus)},${q(e.type)},${q(e.mode)},${q(e.cabinet)},${d(e.event_date)},${d(e.plan_start)},${d(e.plan_end)},${q(e.location)},${q(e.status)},${e.order}) on conflict (id) do nothing;\n`;

// Each event gets its own copy of the division set (per-event divisions).
out += `\n-- divisions (per event)\n`;
for (const e of seed.events)
  for (const x of seed.divisions)
    out += `insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values (${q(e.id)},${q(x.key)},${q(x.name)},${q(x.short)},${q(x.color)},${x.order},${b(x.exclude_from_rundown)}) on conflict (event_id,key) do nothing;\n`;

// The roster in seed.json is the PRE-0019 set: 44 people with no edition and no
// division. Emitting it would put all 44 into every Ormawa Visit. The real
// per-edition roster (119 people across 4 editions) lives in
// migrations/0019_real_roster.sql, which is part of the rebuild recipe.
const scopedMembers = seed.members.filter((m) => m.event_id);
const unscopedMembers = seed.members.length - scopedMembers.length;
out += `\n-- members (divisions[] is the real membership; division = the primary)\n`;
if (unscopedMembers) {
  out += `-- ${unscopedMembers} anggota di seed.json TIDAK ditulis: mereka belum punya event_id,\n`;
  out += `-- dan anggota tanpa edisi akan muncul di SEMUA Ormawa Visit. Roster asli\n`;
  out += `-- per-edisi ada di migrations/0019_real_roster.sql — jalankan itu setelah file ini.\n`;
}
for (const m of scopedMembers) {
  const divs = m.divisions?.length ? m.divisions : m.division ? [m.division] : [];
  out += `insert into members(event_id,name,nickname,nrp,type,year,division,divisions) values (${q(m.event_id)},${q(m.name)},${q(m.nickname)},${q(m.nrp)},${q(m.type)},${n(m.year)},${q(divs[0] ?? null)},${arr(divs)});\n`;
}

out += `\n-- tasks\n`;
for (const t of seed.tasks)
  out += `insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values (${q(t.event_id)},${q(t.division)},${q(t.no)},${q(t.pic)},${q(t.title)},${d(t.start_date)},${q(t.start_raw)},${d(t.end_date)},${q(t.end_raw)},${q(t.notes)},${q(t.result)},${q(t.status)});\n`;

// prospects — `batch` is no longer written (the app dropped the concept; the
// edition is `event_id`). We still READ seed.json's batch above via
// prospectEvent() to derive that event_id. The DB column stays (default '').
out += `\n-- prospects\n`;
for (const p of seed.prospects)
  out += `insert into prospects(event_id,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values (${q(prospectEvent(p))},${q(p.no)},${q(p.date_text)},${q(p.month)},${q(p.contact)},${q(p.org_name)},${q(p.campus)},${q(p.location)},${q(p.pic)},${q(p.contact_status)},${q(p.their_response)},${q(p.our_response)},${b(p.done)},${q(p.source)});\n`;

out += `\n-- links\n`;
for (const l of seed.links)
  out += `insert into links(event_id,section,division,name,url,note,source) values (${q(l.event_id)},${q(l.section)},${q(l.division)},${q(l.name)},${q(l.url)},${q(l.note)},${q(l.source)});\n`;

out += `\n-- budget\n`;
for (const plan of seed.budgetPlans) {
  const values = plan.items
    .map((i, idx) => `(${q(i.category)},${n(i.no)},${q(i.name)},${n(i.qty)},${q(i.unit)},${n(i.unit_price)},${n(i.total)},${idx})`)
    .join(",\n    ");
  out += `with p as (insert into budget_plans(name,event_id) values (${q(plan.name)},${q(plan.event_id)}) returning id)\n  insert into budget_items(plan_id,category,no,name,qty,unit,unit_price,total,"order")\n  select p.id, v.* from p, (values\n    ${values}\n  ) as v(category,no,name,qty,unit,unit_price,total,ord);\n\n`;
}

// Rundown is single-version now: only variant 'A' is emitted. seed.json still
// carries legacy 'B' rows for some editions (the old second version); writing
// them would make every activity appear twice on the single-version page.
out += `-- rundown (variant A only; legacy 'B' rows are dropped)\n`;
const rundownA = seed.rundown.filter((r) => (r.variant ?? "A") === "A");
const rundownDropped = seed.rundown.length - rundownA.length;
if (rundownDropped) out += `-- (${rundownDropped} baris versi B lama dilewati)\n`;
for (const r of rundownA)
  out += `insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,mc,operator,division_jobs) values (${q(r.event_id)},'A',${n(r.no)},${q(r.time_start)},${q(r.time_end)},${q(r.duration)},${q(r.activity)},${q(r.keterangan)},${q(r.mc)},${q(r.operator)},${jb(r.division_jobs)});\n`;

out += `\n-- job hari-h\n`;
for (const j of seed.jobHariH)
  out += `insert into job_harih(event_id,no,pic,job,notes) values (${q(j.event_id)},${q(j.no)},${q(j.pic)},${q(j.job)},${q(j.notes)});\n`;

out += `\n-- faqs\n`;
seed.faqs.forEach((f, i) => {
  out += `insert into faqs(question,answer,"order") values (${q(f.question)},${q(f.answer)},${i});\n`;
});

out += `\n-- teams\n`;
for (const t of seed.teams)
  out += `insert into teams(event_id,division,fungsionaris,intern) values (${q(t.event_id)},${q(t.division)},${q(t.fungsionaris)},${q(t.intern)});\n`;

out += `\ncommit;\n`;

// Fail loudly here rather than in the user's SQL editor.
assertSqlSane(out, "seed.sql");
writeFileSync(join(__dirname, "../supabase/seed.sql"), out, "utf8");
console.log("Wrote supabase/seed.sql", `(${out.length} chars)`);
