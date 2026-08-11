# Production readiness review - ov-system v1.19.0

> **Status per 2026-07-28 (v1.20.0).** P0-1, P0-2, P1-1, P1-2, P1-5, P2-1, P2-2,
> P2-3, P2-4 dan P2-7 sudah diperbaiki dan diverifikasi; ringkasannya di bagian
> [Status perbaikan](#status-perbaikan) di akhir dokumen. Isi laporan di bawah
> sengaja dibiarkan apa adanya sebagai catatan temuan awal.

Tanggal: 2026-07-27 · Cakupan: seluruh `ov-system/` (frontend + backend + migrasi SQL)
Metode: build/typecheck/test/lint, pembacaan kode, pengujian fitur langsung di browser
(mode demo, database Supabase demo), dan probe read-only skema produksi.

## Verdict

**Belum siap production untuk peran non-admin. Siap untuk pemakaian admin-only.**

Yang sehat: `tsc --noEmit` bersih, `next build` sukses (25 route), `npm test` 201/201 lulus,
`eslint` 0 error, tidak ada XSS sink, service-role key tidak pernah dipakai di kode aplikasi,
validasi Zod konsisten di seluruh Server Action, semua route render 200 tanpa error boundary,
tidak ada horizontal overflow di viewport 375px.

Yang memblokir: **matriks akses aplikasi dan RLS di database sudah tidak sinkron**, dan
**37 fungsi tulis di `repo.ts` menelan error Supabase**, sehingga penolakan RLS itu tidak
terlihat sama sekali oleh pengguna. Kombinasi keduanya = kehilangan data diam-diam.

Semua migrasi 0014–0027 sudah terpasang di produksi (diverifikasi lewat probe skema
read-only), jadi temuan di bawah bersifat **live**, bukan hipotetis.

---

## P0 - Blocker

### P0-1 Matriks akses aplikasi ≠ policy RLS produksi

`MODULE_ACCESS_LEVEL` (`src/lib/constants.ts:107`) memberi Staff & Intern level `limited`
(buat / ubah / isi hasil) pada **tasks, rundown, jobs, links**. RLS produksi tidak setuju:

| Aksi | Diizinkan aplikasi | Diizinkan RLS produksi | Akibat |
|---|---|---|---|
| INSERT `tasks` | admin, coord, staff, intern | admin, atau coord + `owns_scope` (0026:37) | Staff/Intern **tidak bisa membuat tugas** |
| UPDATE `tasks` | semua peran menulis, semua divisi | admin, atau coord/staff/intern + `owns_scope(event_id, division)` (0026:43) | Hanya bisa mengubah tugas **divisi & OV-nya sendiri** |
| WRITE `rundown` / `job_harih` / `teams` | admin, coord, staff, intern | admin, atau coord dengan `event_id = auth_event()` (0020:183) | Staff/Intern **ditolak total** |
| UPDATE/DELETE `links` | admin, coord, staff, intern | admin, coord saja (0016:61) | Edit link oleh Staff/Intern ditolak |

`owns_scope()` (0020:103) **fail closed**: `false` bila `profiles.event_id` ATAU
`profiles.division` NULL. Migrasi 0026 mem-backfill `event_id` tapi **tidak** `division` -
query verifikasi di 0026:71 justru memang mendaftar akun yang masih lumpuh, tanpa langkah
perbaikan. Jadi setiap akun coordinator/staff/intern yang `profiles.division`-nya kosong
**tidak bisa menulis tugas sama sekali**.

Ini persis bug yang dilaporkan user di v1.16.0 ("Staff/Intern cuma bisa edit SEBAGIAN
tugas"), yang saat itu diperbaiki di sisi aplikasi dengan membuang scoping divisi dari
`can.*`. Perbaikan itu tidak pernah diikuti di sisi database - 0026 malah menegakkannya lagi.
`AGENTS.md:20` menulis "jangan reintroduce division filter di `can.*`", sementara DB
melakukannya.

**Keputusan yang harus diambil user dulu:** apakah Staff/Intern boleh menyentuh tugas lintas
divisi (sesuai matriks sekarang) atau tidak? Lalu selaraskan satu sisi ke sisi lain. Jangan
tambal sebelah.

### P0-2 37 fungsi tulis `repo.ts` menelan error Supabase

Setiap penolakan P0-1 tidak menghasilkan pesan apa pun - nilai tetap tampil di layar,
lalu hilang saat reload.

```
bulkDeleteBudgetItems  bulkDeleteDivisions  bulkDeleteLinks   bulkDeleteProspects
bulkDeleteTasks        bulkUpdateDivisions  cloneEventData    createBudgetPlan
createDivision         createEvent          createFaq         createJob
createLink             createProspect       createRundown     createTask
deleteBudgetItem       deleteBudgetPlan     deleteDivision    deleteEvent
deleteFaq              deleteJob            deleteLink        deleteProspect
deleteRundown          deleteTeam           purgeTaskLinks    reorderJobs
setPrimaryProspect     syncTaskLinks        unsetPrimaryProspect
updateDivision         updateEvent          updateFaq         updateJob
updateLink             updateProspect       updateRundown
```

Ini kelas bug yang sama persis dengan CRITICAL FIX v1.13.0 ("status/hasil tugas tidak
melakukan apa-apa"). Saat itu hanya `updateTask` / `deleteTask` / `bulkUpdateTasks` yang
diperbaiki - `createTask` dan `bulkDeleteTasks` pun masih menelan error.

**Perbaikan:** samakan polanya dengan `updateTask` (`repo.ts:174`) - `if (error) throw new
Error(error.message)` di semua fungsi di atas, lalu bungkus action-nya dengan try/catch →
`errMsg(e)`.

Diverifikasi langsung: pengeditan sel rundown menyimpan tanpa **toast sukses maupun gagal**
sama sekali. Di produksi, penolakan RLS pada peran Staff/Intern (P0-1) akan tampak persis
seperti berhasil.

---

## P1 - High

### P1-1 Backup terjadwal tidak pernah berhasil (temuan H4 audit 2026-07-21, belum diperbaiki)

`src/lib/backup.ts:33` memanggil `createClient()` (cookie-scoped). Request Vercel Cron tidak
membawa cookie → `auth.uid()` NULL → sejak 0016 `captureSnapshot()` membaca **0 baris dari
setiap tabel**, dan insert ke `backups` ditolak. Tidak ada disaster recovery yang berfungsi.
`CRON_SECRET` juga tidak ada di `.env.local` (perlu dicek di Vercel - kalau kosong, route
mengembalikan 501 dan cron tidak pernah jalan sama sekali).

Perbaikan sudah ditulis lengkap di `docs/SECURITY-AUDIT.md:307` (buat
`src/lib/supabase/admin.ts` dengan service-role key, dipakai **hanya** oleh route cron ini).

### P1-2 Restore backup menghapus permanen semua tautan hasil tugas

`DELETE_ORDER` di `backup.ts:5` tidak memuat `task_links` (tabel ditambahkan migrasi 0025)
maupun `role_requests` (0023). `restoreSnapshot()` menghapus seluruh baris `tasks`, yang
**cascade-delete `task_links`** (`0025:18 on delete cascade`), lalu memasukkan kembali tasks
tanpa link-nya. Setiap restore = seluruh tautan hasil tugas hilang selamanya, tanpa peringatan.

### P1-3 Pendaftaran mandiri terbuka + roster ber-PII bisa dibaca siapa pun

`/signup` (ditambahkan v1.15.0, **setelah** audit) membuka registrasi ke publik. Setelah punya
akun apa pun:
- `profiles_read` (0020:84) → membaca **seluruh** nama, email, peran, divisi.
- `members` `read_auth` (0016:37) = `auth.uid() is not null` → membaca **seluruh roster
  119 anggota termasuk NRP** (PII mahasiswa).

Lebih jauh: `read_auth` juga dipenuhi sesi **anonim**, jadi cukup klik "Masuk sebagai Tamu"
tanpa kredensial apa pun untuk meng-enumerate seluruh roster + NRP. Audit menutup celah ini
untuk `profiles` (M4) tapi tidak untuk `members`.

Pilihan: matikan public signup di Supabase Auth, atau batasi domain email, atau keluarkan
`nrp` dari policy baca untuk sesi anon/tanpa peran.

### P1-4 Tiga kerentanan dependensi severity HIGH

`npm audit --omit=dev`: `postcss` (3 advisory: XSS, arbitrary file read, path traversal) dan
`sharp` (<0.35.0, CVE libvips) - keduanya transitif lewat `next@16.2.10`.
Perbaikan: naikkan ke `next@16.2.12` (patch bump dalam 16.2.x).

### P1-5 Tidak ada security header sama sekali

`next.config.ts` hanya berisi `devIndicators: false`. Tidak ada CSP, HSTS, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`. Konfigurasi siap-pakai ada di
`docs/SECURITY-AUDIT.md:387`.

---

## P2 - Medium

| # | Temuan | Lokasi |
|---|---|---|
| P2-1 | Secret cron diterima lewat **query string** (bocor ke access log & header `Referer`) dan dibandingkan dengan `!==` (bukan constant-time). Tidak ada rate limit. | `api/cron/backup/route.ts:16` |
| P2-2 | `setRole()` tidak dijaga `demoActive()` - inert di produksi hanya karena urutan cabang di `auth.ts`, bukan karena ada pengecekan. Satu refactor dari jadi privilege escalation. | `actions/session.ts:12` |
| P2-3 | Cookie aplikasi tanpa `httpOnly` / `secure`. `document.cookie = "ov_guest=1"` melewati proxy. `proxy.ts` adalah redirect UX, **bukan** access control - belum didokumentasikan sebagai itu. | `actions/session.ts:15-40`, `proxy.ts:69` |
| P2-4 | `<button>` bersarang di dalam `<button>` → **hydration error di setiap load `/budget`** (dikonfirmasi di konsol browser). Fungsional pulih setelah hydration, tapi klik sebelum hydration berperilaku salah dan ini invalid HTML + masalah a11y. | `budget-view.tsx:391` + `:410` |
| P2-5 | Action budget/prospect/faq/division/event/link tanpa try/catch → begitu P0-2 diperbaiki, error jadi unhandled rejection (layar error Next) alih-alih toast. | `actions/budget.ts:83,114,123,132` dll. |
| P2-6 | Autosave inline (rundown, jobs, budget) tidak memberi indikator tersimpan **maupun** gagal. | `rundown-view.tsx:166` |
| P2-7 | `deleteTaskAction(id)` memakai `id` mentah tanpa `parse(idSchema, …)`, satu-satunya action tasks yang begitu. `duplicateTaskAction` juga tanpa try/catch. | `actions/tasks.ts:153`, `:129` |
| P2-8 | `isAssignedTo()` mencocokkan substring nama depan pada teks bebas `pic` - "Ali" cocok dengan tugas milik "Alifia". Akar masalahnya penyimpanan nama gabungan koma. | `permissions.ts:25` |
| P2-9 | Cabang `onlyProgress` di `updateTaskAction` adalah **dead code**: `can.editTask` dan `can.editTaskProgress` sama-sama `atLeast(…,"limited")`, jadi Staff/Intern boleh mengubah field tugas apa pun. Sudah dipin oleh test, tapi belum diputuskan sebagai produk. | `actions/tasks.ts:72` |
| P2-10 | `task_links` tidak masuk daftar policy restrictive `no_anon_write` di 0020:199, dan write policy-nya tanpa scope event sama sekali. | `0025_task_links.sql:44` |
| P2-11 | Tidak ada rate limiting pada `/signup` dan route cron. | - |

---

## P3 - Low / utang teknis

- **37 tap target < 24px** pada viewport 375px di `/tasks` (dari 85 elemen interaktif) - di bawah rekomendasi WCAG 2.5.8.
- **Refactor `DataSource` masih tertunda**: `repo.ts` (954 baris) + `local.ts` (718 baris),
  71 cabang `if (!USE_SUPABASE)`, **nol test di layer repo**. Ini yang membuat P0-2 bisa
  lolos sejauh ini. Tulis test layer repo dulu, baru refactor.
- **Payload RSC berat**: `/settings` 232KB, `/panduan` 85KB (changelog + guide dikirim penuh).
- Dependensi tertinggal: seluruh Radix, `lucide-react`, `react` 19.2.4→19.2.8, `next` →16.2.12.
- `legal.ts:24` masih `TODO(dept)` - alamat departemen resmi belum diisi di Kebijakan Privasi.
- Kalau di-deploy tanpa env Supabase, `store.ts:42` menelan kegagalan tulis filesystem dan
  berjalan in-memory: data hilang setiap cold start, tanpa peringatan.

---

## Status perbaikan

Dikerjakan pada v1.20.0 (2026-07-28).

| # | Temuan | Status | Bukti |
|---|---|---|---|
| P0-1 | Matriks akses ≠ RLS | **Selesai** | `setup.sql` + migrasi 0028; `npm run db:test` 47/47 |
| P0-2 | 37 penulisan menelan error | **Selesai** | helper `must()` di `repo.ts`; diverifikasi di browser (toast merah muncul saat kolom hilang) |
| P1-1 | Backup cron tidak pernah berhasil | **Selesai** | `lib/supabase/admin.ts` (service role) + penolakan snapshot kosong |
| P1-2 | Restore menghapus tautan hasil tugas | **Selesai** | `task_links` masuk `DELETE_ORDER` paling depan |
| P1-3 | Signup terbuka + roster ber-PII | **Sebagian** | Anggaran & Super Link kini tertutup untuk akun belum-berperan. Roster (nama, NRP) masih terbaca Tamu - **keputusan produk, menunggu Anda** |
| P1-4 | 3 CVE dependensi | **Tidak bisa ditutup** | Advisory mencakup SELURUH Next 16 (`9.3.4-canary.0`–`16.3.0-preview.7`); `audit fix --force` menurunkan ke next@9. Sudah di 16.2.12. Paparan nyata rendah: `sharp` hanya dipakai `next/image` (nol pemakaian, kini `images.unoptimized`), `postcss` hanya saat build |
| P1-5 | Tanpa security header | **Selesai** | CSP, HSTS, X-Frame-Options, dll. di `next.config.ts`; diverifikasi lewat respons HTTP |
| P2-1 | Secret cron lewat query string | **Selesai** | header saja + `timingSafeEqual` |
| P2-2 | `setRole` tak dijaga | **Selesai** | guard `demoActive()` |
| P2-3 | Cookie tanpa httpOnly/secure | **Selesai** | `COOKIE_OPTS`; `ov_demo` sengaja tetap terbaca skrip |
| P2-4 | `<button>` bersarang di /budget | **Selesai** | konsol bersih, 0 nested button |
| P2-7 | `deleteTaskAction` tanpa validasi id | **Selesai** | `parse(idSchema, …)` + try/catch |
| P2-5 | Action tanpa try/catch | **Selesai** | seluruh action kini membungkus repo |
| P2-6 | Autosave tanpa indikator | **Belum** | error kini tampil; indikator "tersimpan" belum ada |
| P2-8/9/10/11 | PIC fuzzy, dead code, scope task_links, rate limit | **Belum** | - |
| P3-* | Tap target, refactor DataSource, payload RSC, dll. | **Belum** | - |

## Urutan pengerjaan yang disarankan

1. **Putuskan model izin** - Staff/Intern lintas divisi atau tidak (P0-1). Ini keputusan
   produk, bukan teknis, dan semua langkah berikutnya bergantung padanya.
2. Tulis migrasi yang menyelaraskan RLS dengan keputusan itu; sertakan backfill
   `profiles.division` + `profiles.event_id`, atau buang `owns_scope` dari policy tugas.
3. `throw` di 37 fungsi tulis repo + try/catch di action-nya (P0-2, P2-5). Kerjakan bersama
   langkah 2 supaya tiap penolakan langsung terlihat saat diuji.
4. `npm i next@16.2.12` (P1-4) - paling murah, kerjakan kapan saja.
5. Perbaiki cron backup dengan client service-role + tambahkan `task_links` dan
   `role_requests` ke daftar tabel backup (P1-1, P1-2). Verifikasi satu backup benar-benar
   masuk, lalu uji restore di project demo.
6. Security header + hardening cron/cookie (P1-5, P2-1, P2-2, P2-3).
7. Putuskan kebijakan signup & PII roster (P1-3).
8. Perbaiki nested button `/budget` (P2-4) dan tambahkan indikator simpan (P2-6).
9. Test layer repo, lalu refactor `DataSource` (P3).
