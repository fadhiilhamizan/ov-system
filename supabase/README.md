# Database — cara pakai

## Ringkas

| Mau apa | Jalankan |
|---|---|
| Menyiapkan project Supabase (baru maupun yang sudah ada) | **`setup.sql`** — satu file, satu kali |
| Mengisi data awal untuk project yang benar-benar kosong | `seed.sql`, setelah `setup.sql` |
| **Membangun ulang data dari nol** (menyembuhkan duplikat) | lihat [Rebuild data](#rebuild-data) |
| Membuat akun default Koordinator/Staff/Intern | `default-accounts.sql`, setelah `setup.sql` |
| Menyembuhkan rundown yang tampil ganda (versi A & B lama) | `migrations/0035_rundown_single_version.sql` |
| Menyiapkan project **demo** | `setup.sql` → `demo/demo-open-access.sql` → `demo/demo-seed.sql` |

Cukup itu. **`migrations/` tidak perlu dijalankan lagi** — lihat di bawah.

## Rebuild data

`seed.sql` berisi **529 `INSERT` tanpa klausa `on conflict`**. Artinya
menjalankannya dua kali **menggandakan** tasks, members, links, prospects,
rundown, job_harih, faqs, dan teams. (`events` dan `divisions` punya
`on conflict` sehingga aman.) Itu sumber baris kembar yang muncul berulang —
bukan bug aplikasi.

Kalau data sudah kotor, jangan tambal sedikit-sedikit; kosongkan lalu isi sekali:

1. **Backup manual** dari Pengaturan → Backup & Rollback → "Backup Sekarang",
   lalu unduh JSON-nya. Jangan lewati langkah ini.
2. `reset-data.sql` — mengosongkan seluruh data Ormawa Visit.
   **`profiles`, akun, dan `backups` TIDAK disentuh**, jadi tidak ada yang perlu
   mendaftar ulang atau minta peran lagi.
3. `setup.sql` — memastikan skemanya lengkap (aman diulang).
4. `seed.sql` — data awal. **Jalankan tepat sekali.**
5. `migrations/0019_real_roster.sql` — divisi, anggota, dan tim **asli per edisi**.
6. `migrations/0032_import_superlink_from_sheet.sql` — Super Link dari Excel.
7. `migrations/0033_performance_measurement_data.sql` — Performance Measurement.
8. (opsional) `default-accounts.sql` — akun login siap pakai untuk Koordinator,
   Staff, dan Intern.

`seed.sql` kini hanya menulis rundown **satu versi (A)**, jadi rebuild dari nol
tidak lagi menghasilkan rundown ganda. Untuk database **yang sudah ada** dan
masih menyimpan baris versi B lama, jalankan
`migrations/0035_rundown_single_version.sql` sekali untuk menyatukannya ke versi A.

### Kenapa langkah 5 wajib

`getProspects(eventId)` dan `getMembers(eventId)` menyaring secara **longgar**:
baris yang `event_id`-nya null dianggap milik SEMUA edisi. Itu memang disengaja
(baris legacy tanpa edisi tetap tampil), tapi akibatnya baris tanpa edisi
**merembes** ke mana-mana.

Dua hal yang pernah salah karena ini:

- **Reach & Offer** — seluruh 61 prospek ditulis dengan `event_id` null, jadi
  tiap Ormawa Visit menampilkan 61 padahal miliknya sendiri hanya 12–19.
  Sudah diperbaiki: generator sekarang menurunkan edisi dari teks `batch` dan
  **menolak jalan** kalau ada batch yang tidak dikenal.
- **Anggota EA** — 44 anggota di `seed.json` adalah roster lama tanpa edisi dan
  tanpa divisi. `seed.sql` sekarang sengaja tidak menulis anggota sama sekali;
  roster asli per edisi (119 orang, 17 divisi, 17 tim) datang dari
  `0019_real_roster.sql`. Melewatkan langkah 5 berarti daftar anggota kosong.

Kedua skrip di langkah 2 dan 4 menampilkan verifikasi di akhir. Kalau angka di
langkah 2 tidak semuanya 0, berhenti dan periksa dulu sebelum lanjut.

Untuk project **demo**: `demo/demo-seed.sql` sudah re-runnable (ia menghapus
baris edisi `demo-ov` lebih dulu), jadi cukup jalankan ulang file itu — tidak
perlu `reset-data.sql`.

Seluruh alur ini diuji otomatis di Postgres asli oleh `npm run db:test`,
termasuk pembuktian bahwa seed dua kali memang menggandakan dan reset
menyembuhkannya.

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
