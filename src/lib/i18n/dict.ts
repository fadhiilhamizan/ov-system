import type { Lang } from "./config";

// Translation approach: the Indonesian string is the key. When the language is
// English, look it up in EN; unmapped strings gracefully fall back to Indonesian.
// (User-generated content is never translated.)
export const EN: Record<string, string> = {
  // Nav groups
  "Utama": "Main",
  "Operasional": "Operational",
  "Relasi & Aset": "Relations & Assets",
  "Organisasi": "Organization",
  // Nav labels
  "Work Breakdown": "Work Breakdown",
  "Divisi": "Divisions",
  "Kalender": "Calendar",
  "Rundown": "Rundown",
  "Hari-H": "D-Day",
  "Reach & Offer": "Reach & Offer",
  "Super Link": "Super Link",
  "Anggaran": "Budget",
  "Anggota & Tim": "Members & Team",
  "Ormawa Visit": "Ormawa Visit",
  "FAQ & Panduan": "FAQ & Guide",
  "Pengaturan": "Settings",
  // Nav descriptions
  "Ringkasan progres & metrik Ormawa Visit": "Progress overview & metrics",
  "Semua tugas: tabel, kanban & timeline": "All tasks: table, kanban & timeline",
  "Tugas per divisi, otomatis tersinkron": "Tasks per division, auto-synced",
  "Deadline & agenda dalam tampilan kalender": "Deadlines & agenda in a calendar",
  "Susunan acara hari pelaksanaan": "Run-of-show for the event day",
  "Pembagian tugas panitia saat hari pelaksanaan": "Committee duties on the event day",
  "Data & alur himpunan yang dihubungi": "Data & pipeline of reached associations",
  "Kumpulan dokumen & tautan penting": "Important documents & links",
  "Rencana anggaran biaya & skenario min/maks": "Budget plan & min/max scenarios",
  "Daftar anggota & struktur tim tiap divisi": "Member directory & team structure",
  "Kelola daftar Ormawa Visit": "Manage the Ormawa Visit list",
  "Pertanyaan umum seputar Ormawa Visit": "Common questions about Ormawa Visit",
  "Konfigurasi sistem & manajemen data": "System configuration & data management",
  // Topbar / shell
  "Command Center · EA HMSI": "Command Center · EA HMSI",
  "Ganti tema": "Toggle theme",
  "Ganti bahasa": "Change language",
  "Fokus divisi": "Division focus",
  "Fokus ke divisi": "Focus on a division",
  "Semua Divisi": "All Divisions",
  "Pilih Ormawa Visit": "Choose Ormawa Visit",
  "Ganti peran (mode demo)": "Switch role (demo)",
  "Keluar": "Sign out",
  "Menu": "Menu",
  "Peran": "Role",
  "Sedang dilihat": "Viewing",
  "Aktif": "Active",
  "Rencana": "Planned",
  "Selesai": "Done",
  // Roles
  "Admin / PIC": "Admin / PIC",
  "Koordinator": "Coordinator",
  "Staff": "Staff",
  "Intern": "Intern",
  "Tamu": "Guest",
  "Akses penuh ke semua fitur": "Full access to everything",
  "Kelola divisi, tugas, rundown & anggaran": "Manage divisions, tasks, rundown & budget",
  "Update status & isi hasil tugasnya": "Update status & submit results",
  "Hanya melihat": "View only",
  // Common actions
  "Tambah": "Add",
  "Edit": "Edit",
  "Hapus": "Delete",
  "Batal": "Cancel",
  "Simpan": "Save",
  "Reset": "Reset",
  "Masuk": "Sign in",
  "Tambah Tugas": "Add Task",
  "Tambah Ormawa Visit": "Add Ormawa Visit",
  "Tambah Divisi": "Add Division",
  "Tambah Tim": "Add Team",
  "Tambah Agenda": "Add Agenda",
  "Tambah Anggota": "Add Member",
  "Ubah status": "Change status",
  "terpilih": "selected",
  // View modes / filters
  "Tabel": "Table",
  "Kanban": "Kanban",
  "Timeline": "Timeline",
  "Pipeline": "Pipeline",
  "Semua Status": "All Status",
  "Semua Batch": "All Batches",
  "Semua Tahap": "All Stages",
  "Semua Seksi": "All Sections",
  "Cari tugas, PIC, catatan…": "Search tasks, PIC, notes…",
  "Cari himpunan, kampus, PIC…": "Search association, campus, PIC…",
  "Cari tautan…": "Search links…",
  "Cari nama / NRP…": "Search name / NRP…",
  // Table headers
  "Tugas": "Task",
  "PIC": "PIC",
  "Deadline": "Deadline",
  "Status": "Status",
  "Hasil": "Result",
  "Himpunan": "Association",
  "Kampus": "Campus",
  "Kontak": "Contact",
  "Tahap": "Stage",
  "Batch": "Batch",
  "Catatan": "Notes",
  "Job Description": "Job Description",
  "No": "No",
  // Counts / misc
  "tugas": "tasks",
  "prospek": "prospects",
  "Total Prospek": "Total Prospects",
  "Diterima": "Accepted",
  "Menunggu": "Waiting",
  "Ditolak": "Rejected",
  // Page headers
  "Work Breakdown Structure": "Work Breakdown Structure",
  "Seluruh tugas Ormawa Visit dalam satu sumber kebenaran. Ubah tampilan antara tabel, kanban, dan timeline.":
    "All Ormawa Visit tasks in one source of truth. Switch between table, kanban, and timeline.",
  "Tugas per divisi, otomatis tersinkron dengan Work Breakdown (tanpa duplikasi & tanpa delay).":
    "Tasks per division, auto-synced with the Work Breakdown (no duplication, no delay).",
  "Data & alur himpunan yang dihubungi, dari reach pertama sampai konfirmasi.":
    "Data & pipeline of associations, from first reach to confirmation.",
  "Rencana Anggaran Biaya": "Budget Plan",
  "Deadline tugas & hari pelaksanaan dalam satu tampilan. Klik tanggal untuk detail atau menambah tugas.":
    "Task deadlines & the event day in one view. Click a date for details or to add a task.",
  "Rundown Acara (Juklak-Juknis)": "Event Rundown",
  "Susunan acara hari-H beserta pengisi, MC, kebutuhan operator, dan job per divisi.":
    "Run-of-show with hosts, MC, operator needs, and per-division duties.",
  "Pembagian Tugas Hari-H": "D-Day Task Assignment",
  "Pembagian tugas panitia saat hari pelaksanaan Ormawa Visit.":
    "Committee task assignment for the Ormawa Visit event day.",
  "Anggota & Struktur Tim": "Members & Team Structure",
  "Daftar fungsionaris & intern External Affairs, serta pembagian tim per divisi.":
    "Directory of External Affairs staff & interns, and team structure per division.",
  "Daftar Ormawa Visit": "Ormawa Visit List",
  // Empty states
  "Tidak ada tugas": "No tasks",
  "Tidak ada prospek": "No prospects",
  "Tidak ada tautan": "No links",
  "Belum ada rundown": "No rundown yet",
  "Belum ada pembagian tugas": "No assignments yet",
};

export function translate(lang: Lang, s: string): string {
  if (lang === "en") return EN[s] ?? s;
  return s;
}
