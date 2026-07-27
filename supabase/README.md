# Database — cara pakai

## Ringkas

| Mau apa | Jalankan |
|---|---|
| Menyiapkan project Supabase (baru maupun yang sudah ada) | **`setup.sql`** — satu file, satu kali |
| Mengisi data awal untuk project yang benar-benar kosong | `seed.sql`, setelah `setup.sql` |
| Menyiapkan project **demo** | `setup.sql` → `demo/demo-open-access.sql` → `demo/demo-seed.sql` |

Cukup itu. **`migrations/` tidak perlu dijalankan lagi** — lihat di bawah.

## `setup.sql`

Satu file berisi seluruh keadaan database saat ini: tabel, index, constraint,
fungsi, trigger, RLS, dan hak kolom. Setara menjalankan migrasi 0001–0028
berurutan, tapi cukup sekali tempel ke Supabase SQL Editor.

- **Idempotent.** Aman dijalankan berulang kali (diuji otomatis).
- **Non-destruktif.** Tidak ada satu pun `delete` / `update` data di dalamnya,
  jadi aman ditempel di database produksi yang sudah terisi.
- **Berfungsi sebagai penyusul.** Semua DDL memakai `if not exists`, jadi file
  yang sama membangun project baru dari nol *dan* melengkapi project lama.
- Diakhiri query verifikasi — semua kolom hasilnya harus `true`.

Yang **sengaja tidak** ada di dalamnya: migrasi data sekali-jalan (isi FAQ,
perbaikan URL Super Link, penghapusan RAB HMD, roster asli HMSI) dan backfill
sekali-jalan. Semuanya sudah dijalankan di produksi; mengulangnya akan menimpa
data yang sekarang.

## `migrations/`

Disimpan sebagai **riwayat**, bukan sebagai langkah pemasangan. Isinya
menjelaskan *kenapa* skema jadi seperti sekarang — beberapa keputusan penting
(dan dua bug yang mahal) hanya terekam di komentar file-file itu.

Kalau nanti ada perubahan skema baru, tulis migrasi bernomor seperti biasa
**dan** perbarui `setup.sql` di perubahan yang sama, lalu jalankan `npm run
db:test`.

## Menguji SQL sebelum ditempel

```bash
npm run db:lint
```

```bash
npm run db:test
```

`db:lint` menangkap SQL yang tidak bisa di-parse — ia ada karena dua kelas bug
pernah lolos langsung ke SQL editor: nilai yang menutup literal `'…'` lebih awal
(tanda kutipnya tetap seimbang, jadi tidak ada yang lain yang menangkapnya), dan
komentar `--` berisi `$$` di dalam blok `do $$ … $$`, yang mengakhiri blok lebih
awal karena **dollar-quoting bersifat leksikal dan komentar tidak melindunginya**.

`db:test` menjalankan `setup.sql` di Postgres sungguhan (PGlite — Postgres yang
dikompilasi ke WASM; tanpa Docker, tanpa server) lalu menguji 47 perilaku
keamanannya dari kursi penyerang: siapa boleh menulis apa, kunci arsip, dan
celah angkat-diri-jadi-admin. Ini ada karena **RLS adalah satu-satunya batas
keamanan yang nyata** — anon key bersifat publik dan token sesi ada di browser
pengguna, jadi penyerang memanggil PostgREST langsung tanpa lewat aplikasi.
Kesalahan policy tidak terlihat oleh `tsc`, `eslint`, maupun Vitest, dan sudah
dua kali lolos ke produksi.
