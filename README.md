# Ormawa Visit Management System

Sistem manajemen program kerja **Ormawa Visit** untuk Departemen **External Affairs HMSI ITS**. Aplikasi web ini menggantikan alur *Main Sheet Ormawa Visit* (eks Google Sheets) dengan pusat kendali yang terintegrasi, real-time, dan mudah dipakai lintas divisi.

**Aplikasi langsung pakai: https://ov-system.vercel.app/**

Ormawa Visit adalah program kunjungan benchmarking antar organisasi mahasiswa. Setiap gelaran (edisi) memiliki tugas (WBS), pembagian divisi, rundown acara, anggaran, prospek himpunan, dan dokumen pendukung yang perlu dikelola bersama oleh banyak orang. Sistem ini menyatukan semuanya dalam satu sumber kebenaran.

---

## Fitur

| Modul | Keterangan |
|-------|-----------|
| Dashboard | Ringkasan progres, KPI, pipeline prospek, progres per divisi, dan deadline terdekat. |
| Work Breakdown (WBS) | Seluruh tugas dalam tampilan Tabel, Kanban (drag-drop status), dan Timeline (Gantt). Cari, filter, pilih banyak sekaligus, dan CRUD penuh. |
| Papan Divisi | Tugas tersaring otomatis per divisi, lengkap dengan progres dan struktur tim. |
| Reach & Offer | Database dan pipeline himpunan target (belum dihubungi sampai diterima/ditolak). |
| Anggaran (RAB) | Itemisasi biaya per kategori dan skenario, subtotal dan total, dapat diedit langsung. |
| Super Link | Direktori dokumen, form, dan tautan penting yang dikelompokkan per edisi dan divisi. |
| Kalender | Deadline tugas dan hari pelaksanaan dalam tampilan bulanan; klik tanggal untuk detail atau menambah tugas. |
| Rundown | Susunan acara (juklak-juknis) berupa tabel: tiap divisi menjadi kolom yang bisa diisi kegiatannya langsung, dengan catatan evaluasi. |
| Hari-H | Pembagian tugas panitia saat hari pelaksanaan. |
| Anggota & Tim | Direktori fungsionaris dan intern, struktur tim per divisi, angkatan otomatis dari NRP. |
| Ormawa Visit | Riwayat dan rencana seluruh gelaran lintas kabinet. Edisi baru bisa dibuat dari template edisi sebelumnya. |
| FAQ | Pertanyaan umum dengan CRUD penuh (tambah/edit/hapus oleh admin). |
| Panduan | Flowchart alur penggunaan website dari awal sampai akhir. |
| Pengaturan | Status backend, matriks hak akses tiga tingkat, changelog, serta backup dan rollback. |

## Peran dan Hak Akses

Sistem memakai hak akses berjenjang (RBAC). Matriks lengkapnya dapat dilihat di halaman **Pengaturan**, dengan tiga tingkat akses per modul: akses penuh (kelola), hanya lihat, dan tanpa akses.

| Peran | Ringkasan |
|-------|-----------|
| Admin / PIC OV | Akses penuh ke seluruh fitur dan pengaturan. |
| Koordinator | Kelola divisi, tugas, rundown, job hari-H, dan anggaran. |
| Staff | Perbarui status dan hasil tugasnya, serta kelola Reach & Offer. |
| Intern | Perbarui status dan hasil tugasnya. |
| Tamu | Hanya melihat (tanpa akun). |

## Cara Memakai

1. **Masuk.** Buka https://ov-system.vercel.app/ lalu login dengan email dan kata sandi yang didaftarkan admin. Belum punya akun tetapi ingin melihat-lihat? Gunakan **Mode Tamu** di halaman login (hanya bisa melihat).
2. **Pilih Ormawa Visit.** Gunakan pemilih edisi di kanan atas untuk berpindah antar gelaran. Semua modul menyesuaikan dengan edisi yang sedang dipilih.
3. **Coba dulu lewat Mode Demo.** Di halaman login ada tombol **Coba Mode Demo** (jika diaktifkan). Mode ini berjalan di **database Supabase yang benar-benar terpisah** berisi data contoh, tanpa perlu akun. Karena databasenya berbeda, apa pun yang Anda lakukan di Mode Demo tidak dapat menyentuh data asli, dan sebaliknya. Ada indikator "Mode Demo" di atas layar dengan tombol Keluar untuk kembali ke halaman login. Penyiapannya dijelaskan di bawah pada bagian Mode Demo.
4. **Kelola tugas.** Buka Work Breakdown, tambah atau ubah tugas, pilih PIC langsung dari daftar anggota, lalu pantau progres lewat Tabel, Kanban, atau Timeline.
5. **Buat Ormawa Visit baru dari template.** Saat menambah edisi baru, pilih "Salin data dari Ormawa Visit lain" untuk menyalin tugas, rundown, job hari-H, dan/atau anggaran dari edisi sebelumnya sebagai kerangka awal, sehingga tidak perlu mengisi semuanya satu per satu.
6. **Fokus per divisi.** Gunakan filter "Fokus divisi" agar tampilan menyoroti satu divisi saja.
7. **Ganti bahasa dan tema.** Tombol bahasa (Indonesia/English) dan tema (terang/gelap) tersedia di kanan atas.

## Teknologi

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS v4 dengan komponen berbasis Radix UI
- @dnd-kit (Kanban), grafik SVG custom, sonner (notifikasi), next-themes (mode gelap)
- Supabase (Postgres, Auth, Row Level Security) untuk mode cloud
- Zod untuk validasi input pada seluruh Server Action
- Vitest untuk pengujian unit

## Menjalankan Secara Lokal

Butuh Node.js 20 atau lebih baru.

```bash
cd ov-system
npm install
npm run dev
# buka http://localhost:3000
```

Tanpa konfigurasi Supabase, aplikasi berjalan penuh dalam mode demo lokal: data awal berasal dari `src/lib/seed/seed.json` dan tersimpan di `.data/db.json`. Semua operasi CRUD berfungsi dan persisten. Berganti peran untuk menguji hak akses tersedia di menu kanan atas.

Perintah lain:

```bash
npm run build      # build produksi
npm test           # jalankan unit test (Vitest)
npm run lint       # ESLint
npm run db:seed    # regenerasi supabase/seed.sql dari seed.json
npm run db:demo    # regenerasi seed & skrip akses untuk project Supabase demo
```

## Konfigurasi Supabase (Cloud)

1. Buat proyek di [supabase.com](https://supabase.com) (free tier mencukupi).
2. Di **SQL Editor**, jalankan berurutan file pada `supabase/migrations/` (0001 hingga 0015), lalu `supabase/seed.sql` untuk data awal. Untuk instalasi yang sudah berjalan, jalankan hanya migrasi baru yang belum pernah dijalankan (0012 hingga 0015).
3. Salin `.env.example` menjadi `.env.local`, lalu isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings > API pada dashboard Supabase).
4. Buat user pertama (Authentication > Users), kemudian set `role = 'admin'` pada tabel `profiles`.
5. `npm run dev` — `proxy.ts` menyegarkan sesi dan RLS menegakkan hak akses di level database.

Selama variabel Supabase kosong, aplikasi tetap berjalan penuh dalam mode demo lokal.

## Mode Demo (database terpisah)

Mode Demo memungkinkan siapa pun mencoba sistem tanpa akun dan tanpa risiko, karena berjalan di **project Supabase yang benar-benar terpisah** dari produksi. Data demo dan data asli tidak dapat saling mengakses. Fitur ini opsional dan hanya muncul bila dikonfigurasi.

1. Buat **project Supabase kedua** khusus demo.
2. Di SQL Editor project demo, jalankan skema `supabase/migrations/` (0001 hingga 0011, plus 0014 & 0015), lalu:
   - `supabase/demo/demo-open-access.sql` — menonaktifkan RLS agar demo bisa dipakai tanpa login (jalankan **hanya** di project demo, jangan di produksi).
   - `supabase/demo/demo-seed.sql` — mengisi data mockup contoh.
   - Berkas ini dihasilkan oleh `npm run db:demo`.
3. Tambahkan env berikut (di `.env.local` dan di Vercel) dari **Settings > API project demo**:
   - `NEXT_PUBLIC_SUPABASE_DEMO_URL`
   - `NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY`
4. Setelah env terisi, tombol **Coba Mode Demo** otomatis muncul di halaman login. Klik untuk masuk (tanpa akun); tombol **Keluar** pada bilah "Mode Demo" mengembalikan ke halaman login.

## Struktur Proyek

```
ov-system/
  src/
    app/(app)/            # halaman tiap modul (server components)
    components/           # UI kit (Radix), layout shell, komponen per modul
    lib/
      types.ts            # model domain (sumber kebenaran tunggal)
      data/store.ts       # backend lokal (JSON, persisten)
      data/repo.ts        # repository: query, CRUD, dan agregasi (Supabase atau lokal)
      actions/*.ts        # server actions (mutasi + guard hak akses + validasi Zod)
      permissions.ts      # aturan RBAC (pure, dipakai client dan server)
      auth.ts, session.ts # identitas dan edisi aktif (cookie/Supabase Auth)
      demo.ts             # Mode Demo (pemilihan database demo vs produksi)
      seed/seed.json      # data awal
  supabase/               # migrasi, RLS, dan seed.sql
```

Sumber kebenaran tunggal ada pada satu tabel `tasks`; "papan divisi" hanyalah tampilan tersaring, pengganti fitur *Mirroring* pada spreadsheet lama.

## Versioning

Sistem memakai skema `v1.x.y`: angka mayor `1` bersifat tetap, `x` untuk pembaruan besar, dan `y` untuk pembaruan kecil. Versi terbaru dan riwayat perubahan lengkap dapat dilihat pada halaman **Pengaturan > Changelog**.

## Dukungan

Menemukan bug atau punya masukan? Hubungi tim melalui tautan WhatsApp yang tersedia di halaman Pengaturan.

---

Dibuat untuk Departemen External Affairs HMSI ITS.
