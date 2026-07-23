// Fictional demo dataset — the "initial data" the demo sandbox resets to.
// Kept in sync with scripts/gen-demo-seed.mjs (same mockup).
export const DEMO_EVENT_ID = "demo-ov";

/** The single demo Ormawa Visit. Reset re-creates this and removes any others. */
export const DEMO_EVENT = {
  id: DEMO_EVENT_ID,
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
  status: "active",
  order: 1,
} as const;

export const demoSeed = {
  // [key, name, short, color, order, exclude_from_rundown]
  divisions: [
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
  ] as const,
  // [name, nickname, nrp, type, division]
  members: [
    ["Budi Santoso", "Budi", "5026221001", "fungsionaris", "EVENT"],
    ["Siti Rahma", "Siti", "5026221002", "fungsionaris", "SECRETARY"],
    ["Andi Wijaya", "Andi", "5026231003", "fungsionaris", "LO"],
    ["Dewi Lestari", "Dewi", "5026231004", "fungsionaris", "CREATIVE"],
    ["Rizky Pratama", "Rizky", "5026231005", "fungsionaris", "MARKETING"],
    ["Putri Anggraini", "Putri", "5026241006", "intern", "CONSUMPTION"],
    ["Fajar Nugroho", "Fajar", "5026241007", "intern", "OPERATIONAL"],
    ["Maya Kusuma", "Maya", "5026241008", "intern", "EVENT"],
  ] as const,
  // [division, title, pic, status, start_date, end_date]
  tasks: [
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
  ] as const,
  // [category, name, qty, unit, unit_price]
  budgetItems: [
    ["KONSUMSI", "Snack peserta", 30, "box", 15000],
    ["KONSUMSI", "Air mineral", 5, "dus", 20000],
    ["KESEKRETARIATAN", "Cetak proposal", 3, "eksemplar", 25000],
    ["ACARA", "Plakat / cinderamata", 1, "buah", 150000],
    ["KREATIF", "Cetak banner", 1, "buah", 120000],
    ["OPERASIONAL", "Sewa perlengkapan", 1, "paket", 200000],
  ] as const,
  // [time_start, time_end, activity, keterangan]
  rundown: [
    ["08:00", "08:30", "Registrasi peserta", "Semua panitia"],
    ["08:30", "09:00", "Pembukaan & sambutan", "MC"],
    ["09:00", "10:30", "Sesi sharing & FGD", "Moderator"],
    ["10:30", "11:30", "Games & networking", "Event"],
    ["11:30", "12:00", "Penutupan & dokumentasi", "MC"],
  ] as const,
  // [job, pic]
  jobs: [
    ["MC Acara", "Maya"],
    ["Registrasi & absensi", "Siti"],
    ["Dokumentasi foto/video", "Dewi"],
    ["LO himpunan partner", "Andi"],
    ["Konsumsi & perlengkapan", "Putri, Fajar"],
  ] as const,
  // [division, fungsionaris, intern]
  teams: [
    ["EVENT", "Budi, Maya", ""],
    ["SECRETARY", "Siti", ""],
    ["LO", "Andi", ""],
    ["CREATIVE", "Dewi", ""],
    ["MARKETING", "Rizky", ""],
    ["CONSUMPTION", "", "Putri"],
    ["OPERATIONAL", "", "Fajar"],
  ] as const,
  // [org_name, campus, pic, contact_status, their_response]
  prospects: [
    ["Himpunan Demo A", "Universitas Contoh", "Andi", "DIHUBUNGI", "DITERIMA"],
    ["Himpunan Demo B", "Institut Sample", "Andi", "MENGHUBUNGI", "DITUNGGU"],
    ["Himpunan Demo C", "Politeknik Uji", "Budi", "DIHUBUNGI", "DITOLAK"],
    ["Himpunan Demo D", "Universitas Placeholder", "", "", ""],
  ] as const,
  // [section, division, name, url]
  links: [
    ["Proposal", "SECRETARY", "Proposal Ormawa Visit Demo", "https://example.com/proposal-demo"],
    ["Desain", "CREATIVE", "Folder Desain", "https://example.com/desain-demo"],
    ["Dokumentasi", "CREATIVE", "Drive Dokumentasi", "https://example.com/dokumentasi-demo"],
    ["Formulir", "EVENT", "Form Pendaftaran Peserta", "https://example.com/form-demo"],
  ] as const,
};

export const angkatanFromNrpNum = (nrp: string) => 2000 + parseInt(nrp.slice(4, 6), 10);
