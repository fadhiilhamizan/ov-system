// Generates the SEED for the SEPARATE demo Supabase project.
// The demo lives in its own database (its own project + env vars), fully
// isolated from real data. This writes:
//   supabase/demo/demo-seed.sql          (mockup: divisions + 1 demo edition + data)
//   supabase/demo/demo-open-access.sql   (disable RLS so the anon key can CRUD)
// Run: node scripts/gen-demo-seed.mjs   (or: npm run db:demo)
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertSqlSane } from "./sql-lint.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../supabase/demo");
mkdirSync(outDir, { recursive: true });

const q = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "null" : Number(v));
const b = (v) => (v ? "true" : "false");
const d = (v) => (v ? `'${v}'` : "null");
/** text[] literal, e.g. ["LO","EVENT"] -> array['LO','EVENT']::text[] */
const arr = (v) =>
  !v || !v.length
    ? "'{}'::text[]"
    : `array[${v.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",")}]::text[]`;

const EV = "demo-ov";

// [key, name, short, color, order, exclude_from_rundown]
const divisions = [
  ["PIC", "PIC Ormawa Visit", "PIC", "#6366f1", 1, true],
  ["COORDINATOR", "Coordinator", "CORD", "#8b5cf6", 2, true],
  ["SECRETARY", "Secretary", "SEC", "#ec4899", 3, true],
  ["TREASURER", "Treasurer", "TRE", "#f59e0b", 4, true],
  ["LO", "Liaison Officer", "LO", "#0ea5e9", 5, false],
  ["EVENT", "Event", "EVE", "#10b981", 6, false],
  ["CONSUMPTION", "Consumption", "CON", "#f97316", 7, false],
  ["OPERATIONAL", "Operational", "OPR", "#64748b", 8, false],
  ["CREATIVE", "Creative", "CRE", "#d946ef", 9, false],
  ["MARKETING", "Marketing", "MRT", "#f43f5e", 10, false],
  ["OUTSOURCE", "Outsource", "OUT", "#14b8a6", 11, false],
];

function angkatan(nrp) {
  return 2000 + parseInt(String(nrp).slice(4, 6), 10);
}

// [name, nickname, nrp, type, divisions] - a member may sit in several
// divisions; the first is the primary (mirrored into members.division).
const members = [
  ["Budi Santoso", "Budi", "5026221001", "fungsionaris", ["EVENT"]],
  ["Siti Rahma", "Siti", "5026221002", "fungsionaris", ["SECRETARY"]],
  ["Andi Wijaya", "Andi", "5026231003", "fungsionaris", ["LO"]],
  ["Dewi Lestari", "Dewi", "5026231004", "fungsionaris", ["CREATIVE", "MARKETING"]],
  ["Rizky Pratama", "Rizky", "5026231005", "fungsionaris", ["MARKETING"]],
  ["Putri Anggraini", "Putri", "5026241006", "intern", ["CONSUMPTION"]],
  ["Fajar Nugroho", "Fajar", "5026241007", "intern", ["OPERATIONAL"]],
  ["Maya Kusuma", "Maya", "5026241008", "intern", ["EVENT"]],
];

const tasks = [
  ["EVENT", "Susun konsep acara Ormawa Visit Demo", "Budi", "ongoing", "2026-08-01", "2026-08-10"],
  ["EVENT", "Buat rundown acara", "Maya", "todo", "2026-08-11", "2026-08-20"],
  ["EVENT", "Evaluasi & laporan akhir", "Budi", "todo", "2026-09-21", "2026-09-30"],
  ["SECRETARY", "Buat proposal & surat-menyurat", "Siti", "done", "2026-08-01", "2026-08-08"],
  ["SECRETARY", "Notulensi & absensi peserta", "Siti", "todo", "2026-09-20", "2026-09-20"],
  ["LO", "Koordinasi dengan himpunan partner", "Andi", "ongoing", "2026-08-05", "2026-08-25"],
  ["LO", "Follow up konfirmasi kehadiran", "Andi", "todo", "2026-09-01", "2026-09-15"],
  ["CREATIVE", "Desain feeds & poster publikasi", "Dewi", "done", "2026-08-10", "2026-08-18"],
  ["CREATIVE", "Siapkan dokumentasi acara", "Dewi", "todo", "2026-09-19", "2026-09-20"],
  ["MARKETING", "Publikasi di media sosial", "Rizky", "ongoing", "2026-08-18", "2026-09-18"],
  ["CONSUMPTION", "Pesan konsumsi peserta", "Putri", "todo", "2026-09-10", "2026-09-19"],
  ["OPERATIONAL", "Siapkan perlengkapan & ruangan", "Fajar", "overtime", "2026-09-15", "2026-09-19"],
];

const budgetItems = [
  ["KONSUMSI", "Snack peserta", 30, "box", 15000],
  ["KONSUMSI", "Air mineral", 5, "dus", 20000],
  ["KESEKRETARIATAN", "Cetak proposal", 3, "eksemplar", 25000],
  ["ACARA", "Plakat / cinderamata", 1, "buah", 150000],
  ["KREATIF", "Cetak banner", 1, "buah", 120000],
  ["OPERASIONAL", "Sewa perlengkapan", 1, "paket", 200000],
];

const rundown = [
  ["08:00", "08:30", "Registrasi peserta", "Semua panitia"],
  ["08:30", "09:00", "Pembukaan & sambutan", "MC"],
  ["09:00", "10:30", "Sesi sharing & FGD", "Moderator"],
  ["10:30", "11:30", "Games & networking", "Event"],
  ["11:30", "12:00", "Penutupan & dokumentasi", "MC"],
];

const jobs = [
  ["MC Acara", "Maya"],
  ["Registrasi & absensi", "Siti"],
  ["Dokumentasi foto/video", "Dewi"],
  ["LO himpunan partner", "Andi"],
  ["Konsumsi & perlengkapan", "Putri, Fajar"],
];

// [division, coordinator] - the roster is derived from members.divisions, so a
// team row only names the coordinator (a fungsionaris of that same division).
// CONSUMPTION/OPERATIONAL deliberately have none.
const teams = [
  ["EVENT", "Budi"],
  ["SECRETARY", "Siti"],
  ["LO", "Andi"],
  ["CREATIVE", "Dewi"],
  ["MARKETING", "Rizky"],
  ["CONSUMPTION", ""],
  ["OPERATIONAL", ""],
];

const prospects = [
  ["Himpunan Demo A", "Universitas Contoh", "Andi", "DIHUBUNGI", "DITERIMA"],
  ["Himpunan Demo B", "Institut Sample", "Andi", "MENGHUBUNGI", "DITUNGGU"],
  ["Himpunan Demo C", "Politeknik Uji", "Budi", "DIHUBUNGI", "DITOLAK"],
  ["Himpunan Demo D", "Universitas Placeholder", "", "", ""],
];

const links = [
  ["Proposal", "SECRETARY", "Proposal Ormawa Visit Demo", "https://example.com/proposal-demo"],
  ["Desain", "CREATIVE", "Folder Desain", "https://example.com/desain-demo"],
  ["Dokumentasi", "CREATIVE", "Drive Dokumentasi", "https://example.com/dokumentasi-demo"],
  ["Formulir", "EVENT", "Form Pendaftaran Peserta", "https://example.com/form-demo"],
];

let out = `-- ============================================================
-- MOCKUP SEED for the SEPARATE demo Supabase project.
-- Run this ONLY on the demo project (never on production), AFTER the schema
-- migrations and demo-open-access.sql.
--
-- Which migrations the demo needs: 0001-0018 and 0027, but NOT 0019 (it wipes
-- the roster and inserts HMSI's real people - production only). 0027 adds the
-- teams.coordinator column that 0019 would otherwise have provided. Columns
-- from 0029/0031 are added by the "Part 0" catch-up below, so the demo never
-- needs to run those migrations by hand.
--
-- RE-RUNNABLE: this script first deletes the demo edition's rows, so running it
-- again restores the sample data instead of duplicating it.
-- All data here is fictional/example data - safe to modify freely.
-- ============================================================
begin;

-- ------------------------------------------------------------------
-- Part 0: schema catch-up. The demo project is at migrations 0001-0018 + 0027
-- and never runs 0028+, but the APP has kept adding columns since (perf
-- measurement in 0029, rundown.merges in 0031, prospect link/notes in 0036, task_refs in 0037, prospect_links in 0038, menu Himpunan in 0040-0041). Without them the demo's own
-- Ormawa Visit form and rundown merge fail with "Could not find the '…' column".
-- These add-column statements are idempotent no-ops on a caught-up schema, so
-- re-running demo-seed silently heals an out-of-date demo project.
-- ------------------------------------------------------------------
alter table events add column if not exists attendance_hmsi int;
alter table events add column if not exists feedback_hmsi_count int;
alter table events add column if not exists feedback_hmsi_rating numeric(3, 2);
alter table events add column if not exists feedback_partner_count int;
alter table events add column if not exists feedback_partner_rating numeric(3, 2);
alter table events add column if not exists report_url text;
alter table rundown add column if not exists merges jsonb not null default '{}'::jsonb;
-- 0036: Reach & Offer link + notes.
alter table prospects add column if not exists link text default '';
alter table prospects add column if not exists link_label text default '';
alter table prospects add column if not exists notes text default '';
alter table prospects add column if not exists link_in_super_link boolean not null default false;
alter table prospects add column if not exists link_id uuid references links(id) on delete set null;
-- 0037: tabel referensi tugas (tidak ada sama sekali di project demo lama).
create table if not exists task_refs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  url text not null,
  label text default '',
  link_id uuid references links(id) on delete set null,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
-- 0038: banyak tautan per prospek, juga belum pernah ada di project demo.
create table if not exists prospect_links (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  url text not null,
  label text default '',
  in_super_link boolean not null default false,
  link_id uuid references links(id) on delete set null,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
-- 0040 (menu Himpunan) + 0041 (subjek Compare): tabel-tabel ini tidak pernah
-- ada di project demo lama. Dibuat tanpa RLS di sini karena demo memang berjalan
-- dengan RLS dimatikan (demo-open-access.sql).
create table if not exists fgd_plans (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  title text default '',
  partner_name text default '',
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists fgd_rows (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references fgd_plans(id) on delete cascade,
  ours text default '',
  theirs text default '',
  "order" int not null default 0
);
create table if not exists compare_subjects (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete set null,
  org_name text not null default '',
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists compare_entries (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  subject_id uuid references compare_subjects(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  org_name text default '',
  section text default '',
  "no" text default '',
  aspect text default '',
  indicator text default '',
  plus text default '',
  minus text default '',
  "order" int not null default 0
);
-- If compare_entries predates 0041 in the demo, add the newer columns. Wrapped
-- in a DO block (not bare ALTERs) so it only runs when the table is already
-- there, and so the demo catch-up self-test does not try it in isolation.
do $ce$ begin
  if to_regclass('public.compare_entries') is not null then
    alter table compare_entries add column if not exists subject_id uuid references compare_subjects(id) on delete cascade;
    alter table compare_entries add column if not exists section text default '';
    alter table compare_entries add column if not exists "no" text default '';
  end if;
end $ce$;

-- Clear this edition's data first (FK-safe order) so the seed is idempotent.
-- task_links is guarded: it only exists once migration 0025 has been applied.
-- NOTE: the body below is dollar-quoted, and dollar-quoting is LEXICAL - a
-- doubled-dollar sequence ends it even inside what looks like a comment. So
-- keep every explanation out here, and dollar-quote the inner statement with a
-- distinct tag because it contains its own single quotes.
do $do$ begin
  if to_regclass('public.task_links') is not null then
    execute $sql$delete from public.task_links where task_id in (select id from public.tasks where event_id = ${q(EV)})$sql$;
  end if;
end $do$;
delete from teams where event_id = ${q(EV)};
delete from job_harih where event_id = ${q(EV)};
delete from rundown where event_id = ${q(EV)};
delete from budget_items where plan_id in (select id from budget_plans where event_id = ${q(EV)});
delete from budget_plans where event_id = ${q(EV)};
delete from links where event_id = ${q(EV)};
delete from compare_entries where event_id = ${q(EV)};
delete from compare_subjects where event_id = ${q(EV)};
delete from fgd_rows where plan_id in (select id from fgd_plans where event_id = ${q(EV)});
delete from fgd_plans where event_id = ${q(EV)};
delete from prospect_links where prospect_id in (select id from prospects where event_id = ${q(EV)});
delete from prospects where event_id = ${q(EV)};
delete from tasks where event_id = ${q(EV)};
delete from members where event_id = ${q(EV)};
delete from divisions where event_id = ${q(EV)};

-- demo edition (active = the landing edition) - created first so divisions can
-- reference it (divisions are per-event since migration 0018).
`;
out += `insert into events(id,code,title,partner,campus,type,mode,cabinet,event_date,plan_start,plan_end,location,status,"order")
values (${q(EV)},'DEMO','Ormawa Visit Demo','Himpunan Demo','Universitas Contoh','external','offline','Sandbox','2026-09-20','2026-08-01','2026-09-19','Ruang Demo, Gedung Contoh','active',1)
on conflict (id) do nothing;\n`;

out += `\n-- divisions (scoped to the demo edition)\n`;
for (const [key, name, short, color, order, excl] of divisions)
  out += `insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values (${q(EV)},${q(key)},${q(name)},${q(short)},${q(color)},${order},${b(excl)}) on conflict (event_id,key) do nothing;\n`;

out += `\n-- members\n`;
for (const [name, nickname, nrp, type, divs] of members)
  out += `insert into members(event_id,name,nickname,nrp,type,year,division,divisions) values (${q(EV)},${q(name)},${q(nickname)},${q(nrp)},${q(type)},${angkatan(nrp)},${q(divs[0])},${arr(divs)});\n`;

out += `\n-- tasks\n`;
const noByDiv = {};
for (const [division, title, pic, status, start, end] of tasks) {
  noByDiv[division] = (noByDiv[division] ?? 0) + 1;
  out += `insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values (${q(EV)},${q(division)},${q(String(noByDiv[division]))},${q(pic)},${q(title)},${d(start)},'',${d(end)},'','','',${q(status)});\n`;
}

out += `\n-- budget\n`;
const budgetValues = budgetItems
  .map(([category, name, qty, unit, up], i) => `(${q(category)},${i + 1},${q(name)},${n(qty)},${q(unit)},${n(up)},${n(qty * up)},${i})`)
  .join(",\n    ");
out += `with p as (insert into budget_plans(name,event_id) values ('RAB Ormawa Visit Demo',${q(EV)}) returning id)
  insert into budget_items(plan_id,category,no,name,qty,unit,unit_price,total,"order")
  select p.id, v.* from p, (values
    ${budgetValues}
  ) as v(category,no,name,qty,unit,unit_price,total,ord);\n`;

out += `\n-- rundown\n`;
rundown.forEach(([ts, te, activity, ket], i) => {
  out += `insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,mc,operator,division_jobs) values (${q(EV)},'A',${i + 1},${q(ts)},${q(te)},'',${q(activity)},${q(ket)},'','','{}'::jsonb);\n`;
});

out += `\n-- job hari-h\n`;
jobs.forEach(([job, pic], i) => {
  out += `insert into job_harih(event_id,no,pic,job,notes) values (${q(EV)},${q(String(i + 1))},${q(pic)},${q(job)},'');\n`;
});

out += `\n-- teams (coordinator only; fungsionaris/intern derive from members)\n`;
for (const [division, coordinator] of teams)
  out += `insert into teams(event_id,division,coordinator,fungsionaris,intern) values (${q(EV)},${q(division)},${q(coordinator)},'','');\n`;

out += `\n-- prospects\n`;
prospects.forEach(([org, campus, pic, cs, tr], i) => {
  out += `insert into prospects(event_id,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values (${q(EV)},${q(String(i + 1))},'','','',${q(org)},${q(campus)},'',${q(pic)},${q(cs)},${q(tr)},'',${b(false)},'demo');\n`;
});

out += `\n-- links\n`;
for (const [section, division, name, url] of links)
  out += `insert into links(event_id,section,division,name,url,note,source) values (${q(EV)},${q(section)},${q(division)},${q(name)},${q(url)},'','demo');\n`;

out += `\ncommit;\n`;

// Fail loudly here rather than in the user's SQL editor.
assertSqlSane(out, "demo-seed.sql");
writeFileSync(join(outDir, "demo-seed.sql"), out, "utf8");

// --- open access: the demo uses the anon key with no login, so disable RLS ---
const tablesForRls = [
  "divisions", "events", "members", "tasks", "task_links", "task_refs", "prospects", "prospect_links", "links",
  "budget_plans", "budget_items", "rundown", "job_harih", "faqs", "teams",
  "fgd_plans", "fgd_rows", "compare_subjects", "compare_entries",
];
let openSql = `-- ============================================================
-- Demo project ONLY: the demo runs with the anon key and NO login, so the
-- public anon role must be able to read AND write. This disables Row Level
-- Security on the app tables AND grants the anon role write access (Supabase
-- grants anon SELECT by default, so without this UPDATE/INSERT would fail with
-- "permission denied for table …"). NEVER run this on the production project.
-- ============================================================
`;
// Guarded per table: a demo project that hasn't caught up on every migration
// (task_links arrived in 0025, for example) would otherwise abort the whole
// script on the first missing table.
for (const t of tablesForRls)
  openSql += `do $$ begin if to_regclass('public.${t}') is not null then execute 'alter table public.${t} disable row level security'; end if; end $$;\n`;
// Grants: without these, disabling RLS still leaves the anon role read-only.
openSql += `\ngrant usage on schema public to anon;\n`;
openSql += `grant select, insert, update, delete on all tables in schema public to anon;\n`;
openSql += `alter default privileges in schema public grant select, insert, update, delete on tables to anon;\n`;
assertSqlSane(openSql, "demo-open-access.sql");
writeFileSync(join(outDir, "demo-open-access.sql"), openSql, "utf8");

console.log("Wrote supabase/demo/demo-seed.sql and supabase/demo/demo-open-access.sql");
