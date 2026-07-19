export interface ChangelogEntry {
  version: string;
  date: string; // ISO date
  title: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.6.1",
    date: "2026-07-20",
    title: "Identitas baru, penyempurnaan rundown & divisi",
    changes: [
      "Nama sistem menjadi 'Ormawa Visit Management System' dengan logo & favicon baru yang lebih profesional.",
      "Rundown: field kegiatan kini menyesuaikan tinggi (teks panjang tidak lagi terpotong); kolom MC & Kebutuhan Operator dipindah ke samping Kegiatan.",
      "Rundown: durasi otomatis dihitung dari waktu, dan kegiatan baru otomatis dimulai dari waktu selesai kegiatan sebelumnya.",
      "Divisi: singkatan Coordinator diperbaiki menjadi 'CORD'; PIC, Coordinator, Secretary, Treasurer kini tidak diikutkan pada rundown.",
      "Divisi: penataan pemilih warna dirapikan pada dialog edit.",
      "Penomoran versi kini tanpa nama kode.",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-07-20",
    title: "Rundown tabel dinamis, Panduan, FAQ CRUD, & penyempurnaan divisi",
    changes: [
      "Rundown dirombak menjadi tabel: tiap divisi otomatis menjadi kolom, kegiatannya diisi langsung di tabel. MC & Kebutuhan Operator tetap kolom tetap; kolom pengisi acara dihapus.",
      "Rundown: edit & hapus langsung di tabel (tanpa menu titik tiga), plus catatan cepat 'terlalu cepat/lama [menit]'.",
      "Divisi: tambah opsi edit & hapus, singkatan otomatis kapital maksimal 4 huruf, dan opsi 'tidak diikutsertakan pada rundown'.",
      "Anggota & Tim: kolom kini bisa diurutkan (sorting).",
      "FAQ kini bisa CRUD penuh (tambah/edit/hapus), dan Panduan dipisah ke menu tersendiri.",
      "Panduan: flowchart alur penggunaan website dari awal sampai akhir, lengkap dengan percabangan keputusan.",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-07-19",
    title: "Mode Demo, template pembuatan, & integrasi anggota",
    changes: [
      "Mode Demo: sandbox dengan database Supabase terpisah — dari halaman login, coba-coba tanpa akun. Data demo dan data asli benar-benar terisolasi (tidak bisa saling mengakses).",
      "Template pembuatan Ormawa Visit: saat membuat edisi baru, data (tugas, rundown, job hari-H, struktur tim, anggaran) bisa disalin dari Ormawa Visit sebelumnya, tidak lagi diisi satu per satu.",
      "PIC tugas & job hari-H kini dipilih langsung dari daftar anggota, bukan diketik manual.",
      "Anggota & Tim: pilih banyak anggota sekaligus untuk hapus atau ubah divisi/tipe massal.",
      "Angkatan anggota kini otomatis dari NRP (mis. 5026(23)1128 → angkatan 2023).",
      "Data anggaran Ormawa Visit 'HMSI ITS x HMD Eksternal' yang keliru dihapus.",
      "Skema versi diseragamkan menjadi v1.x.y dan matriks hak akses membedakan akses penuh, hanya-lihat, dan tanpa akses.",
    ],
  },
  {
    version: "1.4.0",
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
