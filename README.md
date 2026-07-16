# Ormawa Visit — Command Center

Sistem manajemen terintegrasi untuk program kerja **Ormawa Visit**, Departemen **External Affairs HMSI ITS**. Dibangun dari digitalisasi *Main Sheet Ormawa Visit* (eks Google Sheets) menjadi web app modern, operasional, dan *fully customizable*.

> Menggantikan alur spreadsheet lama — termasuk fitur **"Mirroring"** (WBS ⇄ sheet divisi) yang dulu rapuh & lambat (Apps Script, delay 4–5 detik), kini menjadi *query* real-time tanpa duplikasi.

## ✨ Fitur

| Modul | Keterangan |
|-------|-----------|
| **Dashboard** | KPI, donut progres, pipeline prospek, progres per divisi, deadline terdekat, ringkasan edisi |
| **Work Breakdown (WBS)** | Semua tugas dalam 3 tampilan: **Tabel**, **Kanban** (drag-drop status), **Timeline** (Gantt). Filter, cari, CRUD |
| **Papan Divisi** | Tampilan tugas tersaring per divisi (mirroring otomatis) + progres & struktur tim |
| **Prospek Himpunan** | Database + **pipeline** himpunan target (belum → proses → menunggu → diterima/ditolak) |
| **Anggaran (RAB)** | Itemisasi per kategori & skenario min/maks, subtotal, total; angka bisa diedit inline |
| **Super Link** | Direktori dokumen/form/drive terkelompok per edisi & divisi |
| **Kalender** | Deadline tugas & hari-H dalam grid bulanan |
| **Rundown** | Juklak-juknis susunan acara (multi-versi) + job per divisi |
| **Job Hari-H** | Pembagian tugas panitia saat pelaksanaan |
| **Anggota & Tim** | Direktori fungsionaris/intern + struktur tim per divisi |
| **Edisi OV** | Riwayat & rencana seluruh gelaran lintas kabinet |
| **FAQ** | Panduan & pertanyaan umum |
| **Pengaturan** | Status backend, matriks hak akses, reset data |

### Hak akses berjenjang (RBAC)
`Admin / PIC OV` → `Koordinator` → `Staff` → `Intern` → `Viewer`.
Coba langsung lewat **pengalih peran** di kanan atas (mode demo).

## 🛠 Teknologi
- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** + komponen custom berbasis **Radix UI**
- **@dnd-kit** (Kanban), grafik SVG custom, **sonner** (toast), **next-themes** (dark mode)
- **Supabase** (Postgres + Auth + RLS) untuk mode cloud

## 🚀 Menjalankan (mode demo lokal — langsung jalan)

```bash
cd ov-system
npm install
npm run dev
# buka http://localhost:3000
```

Mode demo memakai data asli dari kedua file Excel (`../MAIN SHEET ORMAWA VISIT.xlsx`, `../ORMAWA VISIT 2026.xlsx`), tersimpan di `.data/db.json`. Semua CRUD berfungsi & persisten. Ganti peran dari menu kanan atas untuk menguji hak akses.

## ☁️ Mengaktifkan Supabase (cloud, akun + real-time)

1. Buat proyek di [supabase.com](https://supabase.com) (free tier cukup).
2. Di **SQL Editor**, jalankan berurutan:
   - `supabase/migrations/0001_init.sql` (skema)
   - `supabase/migrations/0002_rls.sql` (RLS + auth trigger)
   - `supabase/seed.sql` (data awal dari Excel — di-generate `node scripts/gen-seed-sql.mjs`)
3. Salin `.env.example` → `.env.local`, isi `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API).
4. Buat user pertama (Authentication → Users), lalu set `role = 'admin'` di tabel `profiles`.
5. `npm run dev` — `proxy.ts` menyegarkan sesi; RLS menegakkan hak akses di level database.

> Berkas integrasi (`src/lib/supabase/*`, `proxy.ts`) sudah disiapkan. Selama env Supabase kosong, aplikasi berjalan penuh di mode demo lokal.

## 🧭 Arsitektur

```
src/
  app/(app)/…            # halaman tiap modul (server components)
  components/            # UI kit (Radix), layout shell, komponen per modul
  lib/
    types.ts             # model domain (single source of truth)
    data/store.ts        # backend lokal (JSON, persisten)
    data/repo.ts         # repository: query + CRUD + agregasi
    actions/*.ts         # server actions (mutasi + guard hak akses)
    permissions.ts       # aturan RBAC (pure, dipakai client & server)
    auth.ts / session.ts # identitas & edisi aktif (cookie)
    seed/seed.json       # data hasil ekstraksi Excel
supabase/                # migrations + RLS + seed.sql
```

**Sumber kebenaran tunggal:** satu tabel `tasks`; "papan divisi" hanyalah *filter* — pengganti sempurna fitur *Mirroring* di spreadsheet lama.

---
Dibuat untuk External Affairs HMSI ITS · v1.0
