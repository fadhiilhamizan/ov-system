export interface ChangelogEntry {
  version: string;
  date: string; // ISO date
  title: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2.0.0",
    date: "2026-07-18",
    title: "Perombakan besar: penomoran otomatis, RAB & Anggota penuh CRUD, backup",
    changes: [
      "Penomoran tugas & Hari-H sekarang otomatis; ID lama dari spreadsheet dihapus.",
      "Super Link dirombak: dikelompokkan per Ormawa Visit & divisi, wajib memiliki URL.",
      "Anggaran (RAB) kini bisa CRUD penuh: tambah/hapus rencana & item.",
      "Anggota EA kini tampil per Ormawa Visit, tampilan tabel, divisi wajib diisi.",
      "Struktur Tim: pengisian anggota via dropdown multi-select, bukan teks bebas lagi.",
      "Fitur reset ke data Excel awal dihapus; digantikan Backup & Rollback.",
      "Backup manual, backup otomatis terjadwal, dan pemulihan (rollback) data.",
      "Palet warna divisi diurutkan + ditambah versi warna muda.",
      "Berbagai perbaikan teks & kejelasan field wajib di seluruh formulir.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-07-18",
    title: "Optimasi performa navigasi",
    changes: [
      "Tambah skeleton loading agar perpindahan menu terasa instan.",
      "Kurangi query berulang ke Supabase lewat cache per-request.",
      "Proxy tidak lagi memvalidasi sesi saat prefetch (mencegah rate limit).",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-18",
    title: "Multi-select tugas & pengalih bahasa",
    changes: [
      "Work Breakdown: pilih banyak tugas sekaligus untuk ubah status/hapus massal.",
      "Tombol ganti bahasa Indonesia/English di sebelah tombol tema.",
      "Reach & Offer dan Super Link kini bisa difilter per Ormawa Visit.",
      "Upload file/foto untuk hasil tugas (kemudian dihapus di 2.0.0).",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-07-17",
    title: "Terhubung ke Supabase & deploy",
    changes: [
      "Sistem login sungguhan (email & password) via Supabase Auth.",
      "Mode Tamu (lihat saja, tanpa akun).",
      "Data dipindahkan dari mode demo lokal ke database Supabase cloud.",
      "Perbaikan data Super Link yang sebelumnya berupa shortcut, bukan URL asli.",
      "Panduan & konfigurasi deployment ke Vercel.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-16",
    title: "Peluncuran awal",
    changes: [
      "Sistem dibangun dari digitalisasi Main Sheet Ormawa Visit (Google Sheets).",
      "Dashboard, Work Breakdown Structure, Papan Divisi, Reach & Offer, Anggaran, Super Link.",
      "Kalender, Rundown Acara, Job Hari-H, Anggota & Tim, Edisi Ormawa Visit, FAQ.",
      "Hak akses berjenjang: Admin/PIC, Koordinator, Staff, Intern, Tamu.",
    ],
  },
];
