// One-off seed migration for v1.5.0. Idempotent.
//  1) Fix each member's `year` (angkatan) from their NRP.
//  2) Delete the wrong ov2-2026 (HMSI ITS x HMD Eksternal) budget plans.
//  3) Add the protected "Ormawa Visit Demo" edition + mockup data.
// Run: node scripts/seed-1_5.mjs   (then: node scripts/gen-seed-sql.mjs)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = join(__dirname, "../src/lib/seed/seed.json");
const db = JSON.parse(readFileSync(SEED, "utf8"));

const DEMO = "ov-demo";

function angkatanFromNrp(nrp) {
  const digits = String(nrp ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  const yy = parseInt(digits.slice(4, 6), 10);
  if (Number.isNaN(yy)) return null;
  const year = 2000 + yy;
  if (year < 2000 || year > new Date().getFullYear() + 1) return null;
  return year;
}

// ---- 1) angkatan from NRP ----
let fixed = 0;
for (const m of db.members) {
  const y = angkatanFromNrp(m.nrp);
  if (y && m.year !== y) {
    m.year = y;
    fixed++;
  }
}
console.log(`members: angkatan fixed for ${fixed}/${db.members.length}`);

// ---- 2) delete wrong ov2-2026 budget ----
const beforeBudget = db.budgetPlans.length;
db.budgetPlans = db.budgetPlans.filter((b) => b.event_id !== "ov2-2026");
console.log(`budgetPlans: removed ${beforeBudget - db.budgetPlans.length} ov2-2026 plan(s)`);

// ---- 3) demo edition + mockup ----
// Remove any existing demo rows first (idempotent re-run).
db.events = db.events.filter((e) => e.id !== DEMO);
db.members = db.members.filter((m) => m.event_id !== DEMO);
db.tasks = db.tasks.filter((t) => t.event_id !== DEMO);
db.budgetPlans = db.budgetPlans.filter((b) => b.event_id !== DEMO);
db.rundown = db.rundown.filter((r) => r.event_id !== DEMO);
db.jobHariH = db.jobHariH.filter((j) => j.event_id !== DEMO);
db.teams = db.teams.filter((t) => t.event_id !== DEMO);
db.prospects = db.prospects.filter((p) => p.event_id !== DEMO);
db.links = db.links.filter((l) => l.event_id !== DEMO);

db.events.push({
  id: DEMO,
  code: "DEMO",
  title: "Ormawa Visit Demo",
  partner: "Himpunan Demo",
  campus: "Universitas Contoh",
  type: "external",
  mode: "offline",
  cabinet: "Sandbox",
  event_date: "2026-09-20",
  plan_start: "2026-08-01",
  plan_end: "2026-09-19",
  location: "Ruang Demo, Gedung Contoh",
  status: "planning",
  order: 100,
});

const members = [
  ["dm-1", "Budi Santoso", "Budi", "5026221001", "fungsionaris", "EVENT"],
  ["dm-2", "Siti Rahma", "Siti", "5026221002", "fungsionaris", "SECRETARY"],
  ["dm-3", "Andi Wijaya", "Andi", "5026231003", "fungsionaris", "LO"],
  ["dm-4", "Dewi Lestari", "Dewi", "5026231004", "fungsionaris", "CREATIVE"],
  ["dm-5", "Rizky Pratama", "Rizky", "5026231005", "fungsionaris", "MARKETING"],
  ["dm-6", "Putri Anggraini", "Putri", "5026241006", "intern", "CONSUMPTION"],
  ["dm-7", "Fajar Nugroho", "Fajar", "5026241007", "intern", "OPERATIONAL"],
  ["dm-8", "Maya Kusuma", "Maya", "5026241008", "intern", "EVENT"],
];
for (const [id, name, nickname, nrp, type, division] of members) {
  db.members.push({
    id,
    event_id: DEMO,
    name,
    nickname,
    nrp,
    type,
    year: angkatanFromNrp(nrp),
    division,
  });
}

// tasks: [division, title, pic, status, start, end]
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
const noByDiv = {};
tasks.forEach(([division, title, pic, status, start, end], i) => {
  noByDiv[division] = (noByDiv[division] ?? 0) + 1;
  db.tasks.push({
    id: `dt-${i + 1}`,
    event_id: DEMO,
    division,
    no: String(noByDiv[division]),
    pic,
    title,
    start_date: start,
    start_raw: "",
    end_date: end,
    end_raw: "",
    notes: "",
    result: "",
    status,
  });
});

// budget
const items = [
  ["KONSUMSI", "Snack peserta", 30, "box", 15000],
  ["KONSUMSI", "Air mineral", 5, "dus", 20000],
  ["KESEKRETARIATAN", "Cetak proposal", 3, "eksemplar", 25000],
  ["ACARA", "Plakat / cinderamata", 1, "buah", 150000],
  ["KREATIF", "Cetak banner", 1, "buah", 120000],
  ["OPERASIONAL", "Sewa perlengkapan", 1, "paket", 200000],
];
db.budgetPlans.push({
  id: "dbp-1",
  name: "RAB Ormawa Visit Demo",
  event_id: DEMO,
  items: items.map(([category, name, qty, unit, unit_price], i) => ({
    id: `dbi-${i + 1}`,
    category,
    no: i + 1,
    name,
    qty,
    unit,
    unit_price,
    total: qty * unit_price,
  })),
});

// rundown (variant A)
const rundown = [
  ["08:00", "08:30", "Registrasi peserta", "Semua panitia"],
  ["08:30", "09:00", "Pembukaan & sambutan", "MC"],
  ["09:00", "10:30", "Sesi sharing & FGD", "Moderator"],
  ["10:30", "11:30", "Games & networking", "Event"],
  ["11:30", "12:00", "Penutupan & dokumentasi", "MC"],
];
rundown.forEach(([time_start, time_end, activity, keterangan], i) => {
  db.rundown.push({
    id: `dr-${i + 1}`,
    event_id: DEMO,
    variant: "A",
    no: i + 1,
    time_start,
    time_end,
    duration: "",
    activity,
    keterangan,
    host: "",
    opr_link: "",
    mc: "",
    job_lo: "",
    job_event: "",
    job_consump: "",
    job_creative: "",
    job_opr: "",
  });
});

// job hari-H
const jobs = [
  ["MC Acara", "Maya"],
  ["Registrasi & absensi", "Siti"],
  ["Dokumentasi foto/video", "Dewi"],
  ["LO himpunan partner", "Andi"],
  ["Konsumsi & perlengkapan", "Putri, Fajar"],
];
jobs.forEach(([job, pic], i) => {
  db.jobHariH.push({ id: `dj-${i + 1}`, event_id: DEMO, no: String(i + 1), pic, job, notes: "" });
});

// teams
const teams = [
  ["EVENT", "Budi, Maya", ""],
  ["SECRETARY", "Siti", ""],
  ["LO", "Andi", ""],
  ["CREATIVE", "Dewi", ""],
  ["MARKETING", "Rizky", ""],
  ["CONSUMPTION", "", "Putri"],
  ["OPERATIONAL", "", "Fajar"],
];
teams.forEach(([division, fungsionaris, intern], i) => {
  db.teams.push({ id: `dtm-${i + 1}`, event_id: DEMO, division, fungsionaris, intern });
});

// prospects
const prospects = [
  ["Himpunan Demo A", "Universitas Contoh", "Andi", "DIHUBUNGI", "DITERIMA"],
  ["Himpunan Demo B", "Institut Sample", "Andi", "MENGHUBUNGI", "DITUNGGU"],
  ["Himpunan Demo C", "Politeknik Uji", "Budi", "DIHUBUNGI", "DITOLAK"],
  ["Himpunan Demo D", "Universitas Placeholder", "", "", ""],
];
prospects.forEach(([org_name, campus, pic, contact_status, their_response], i) => {
  db.prospects.push({
    id: `dp-${i + 1}`,
    event_id: DEMO,
    batch: "Demo",
    no: String(i + 1),
    date_text: "",
    month: "",
    contact: "",
    org_name,
    campus,
    location: "",
    pic,
    contact_status,
    their_response,
    our_response: "",
    done: false,
    source: "demo",
  });
});

// links (URL is required)
const links = [
  ["Proposal", "SECRETARY", "Proposal Ormawa Visit Demo", "https://example.com/proposal-demo"],
  ["Desain", "CREATIVE", "Folder Desain", "https://example.com/desain-demo"],
  ["Dokumentasi", "CREATIVE", "Drive Dokumentasi", "https://example.com/dokumentasi-demo"],
  ["Formulir", "EVENT", "Form Pendaftaran Peserta", "https://example.com/form-demo"],
];
links.forEach(([section, division, name, url], i) => {
  db.links.push({ id: `dl-${i + 1}`, event_id: DEMO, section, division, name, url, note: "", source: "demo" });
});

writeFileSync(SEED, JSON.stringify(db, null, 2) + "\n", "utf8");
console.log("seed.json updated: demo edition added, budget cleaned, angkatan fixed.");
