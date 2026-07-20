// Generates the SEED for the SEPARATE demo Supabase project.
// The demo lives in its own database (its own project + env vars), fully
// isolated from real data. This writes:
//   supabase/demo/demo-seed.sql          (mockup: divisions + 1 demo edition + data)
//   supabase/demo/demo-open-access.sql   (disable RLS so the anon key can CRUD)
// Run: node scripts/gen-demo-seed.mjs   (or: npm run db:demo)
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../supabase/demo");
mkdirSync(outDir, { recursive: true });

const q = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "null" : Number(v));
const b = (v) => (v ? "true" : "false");
const d = (v) => (v ? `'${v}'` : "null");

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

const members = [
  ["Budi Santoso", "Budi", "5026221001", "fungsionaris", "EVENT"],
  ["Siti Rahma", "Siti", "5026221002", "fungsionaris", "SECRETARY"],
  ["Andi Wijaya", "Andi", "5026231003", "fungsionaris", "LO"],
  ["Dewi Lestari", "Dewi", "5026231004", "fungsionaris", "CREATIVE"],
  ["Rizky Pratama", "Rizky", "5026231005", "fungsionaris", "MARKETING"],
  ["Putri Anggraini", "Putri", "5026241006", "intern", "CONSUMPTION"],
  ["Fajar Nugroho", "Fajar", "5026241007", "intern", "OPERATIONAL"],
  ["Maya Kusuma", "Maya", "5026241008", "intern", "EVENT"],
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

const teams = [
  ["EVENT", "Budi, Maya", ""],
  ["SECRETARY", "Siti", ""],
  ["LO", "Andi", ""],
  ["CREATIVE", "Dewi", ""],
  ["MARKETING", "Rizky", ""],
  ["CONSUMPTION", "", "Putri"],
  ["OPERATIONAL", "", "Fajar"],
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
-- Run this ONLY on the demo project (never on production), after the
-- schema migrations (0001..0011) and demo-open-access.sql.
-- All data here is fictional/example data — safe to modify freely.
-- ============================================================
begin;

-- demo edition (active = the landing edition) — created first so divisions can
-- reference it (divisions are per-event since migration 0018).
`;
out += `insert into events(id,code,title,partner,campus,type,mode,cabinet,event_date,plan_start,plan_end,location,status,"order")
values (${q(EV)},'DEMO','Ormawa Visit Demo','Himpunan Demo','Universitas Contoh','external','offline','Sandbox','2026-09-20','2026-08-01','2026-09-19','Ruang Demo, Gedung Contoh','active',1)
on conflict (id) do nothing;\n`;

out += `\n-- divisions (scoped to the demo edition)\n`;
for (const [key, name, short, color, order, excl] of divisions)
  out += `insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values (${q(EV)},${q(key)},${q(name)},${q(short)},${q(color)},${order},${b(excl)}) on conflict (event_id,key) do nothing;\n`;

out += `\n-- members\n`;
for (const [name, nickname, nrp, type, division] of members)
  out += `insert into members(event_id,name,nickname,nrp,type,year,division) values (${q(EV)},${q(name)},${q(nickname)},${q(nrp)},${q(type)},${angkatan(nrp)},${q(division)});\n`;

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

out += `\n-- teams\n`;
for (const [division, fung, intern] of teams)
  out += `insert into teams(event_id,division,fungsionaris,intern) values (${q(EV)},${q(division)},${q(fung)},${q(intern)});\n`;

out += `\n-- prospects\n`;
prospects.forEach(([org, campus, pic, cs, tr], i) => {
  out += `insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values (${q(EV)},'Demo',${q(String(i + 1))},'','','',${q(org)},${q(campus)},'',${q(pic)},${q(cs)},${q(tr)},'',${b(false)},'demo');\n`;
});

out += `\n-- links\n`;
for (const [section, division, name, url] of links)
  out += `insert into links(event_id,section,division,name,url,note,source) values (${q(EV)},${q(section)},${q(division)},${q(name)},${q(url)},'','demo');\n`;

out += `\ncommit;\n`;

writeFileSync(join(outDir, "demo-seed.sql"), out, "utf8");

// --- open access: the demo uses the anon key with no login, so disable RLS ---
const tablesForRls = [
  "divisions", "events", "members", "tasks", "prospects", "links",
  "budget_plans", "budget_items", "rundown", "job_harih", "faqs", "teams",
];
let openSql = `-- ============================================================
-- Demo project ONLY: the demo runs with the anon key and NO login, so the
-- public anon role must be able to read AND write. This disables Row Level
-- Security on the app tables. NEVER run this on the production project.
-- ============================================================
`;
for (const t of tablesForRls) openSql += `alter table ${t} disable row level security;\n`;
writeFileSync(join(outDir, "demo-open-access.sql"), openSql, "utf8");

console.log("Wrote supabase/demo/demo-seed.sql and supabase/demo/demo-open-access.sql");
