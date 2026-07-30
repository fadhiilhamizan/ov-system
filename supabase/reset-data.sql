-- ============================================================
-- RESET DATA — kosongkan seluruh data aplikasi, siap diisi ulang dari seed.
--
-- ⚠️  SKRIP INI MENGHAPUS DATA. Ambil backup manual dulu lewat
--     Pengaturan → Backup & Rollback → "Backup Sekarang", dan unduh JSON-nya.
--
-- KENAPA ADA: `supabase/seed.sql` berisi 529 perintah INSERT tanpa klausa
-- `on conflict`, jadi menjalankannya dua kali MENGGANDAKAN seluruh isinya.
-- Itulah sumber baris kembar yang muncul berulang. Alur yang benar adalah
-- mengosongkan dulu, lalu seed SEKALI.
--
-- YANG DIHAPUS: seluruh data operasional Ormawa Visit —
--   task_links, budget_items, tasks, members, teams, rundown, job_harih,
--   prospects, links, budget_plans, faqs, divisions, events.
--
-- YANG TIDAK DISENTUH (sengaja):
--   * profiles / auth.users  — akun & peran orang tetap utuh, jadi tidak ada
--     yang perlu mendaftar ulang atau minta peran lagi.
--   * backups                — riwayat backup justru penyelamatmu di sini.
--   * role_requests          — pengajuan peran bukan data Ormawa Visit.
--
-- URUTAN LENGKAP REBUILD (lihat supabase/README.md):
--   1. Backup manual dari Pengaturan.
--   2. reset-data.sql   <-- file ini
--   3. setup.sql        (skema; aman diulang)
--   4. seed.sql         (data awal, jalankan SEKALI)
--   5. migrations/0019_real_roster.sql   (divisi + anggota + tim ASLI per edisi)
--   6. migrations/0032_import_superlink_from_sheet.sql
--   7. migrations/0033_performance_measurement_data.sql
--
-- Langkah 5 penting: `seed.json` masih memuat roster lama (44 orang tanpa edisi),
-- dan anggota tanpa edisi akan muncul di SEMUA Ormawa Visit. Karena itu seed.sql
-- sengaja TIDAK menulis anggota sama sekali — roster asli per edisi (119 orang,
-- 17 divisi, 17 tim) datang dari 0019.
--
-- Semua penghapusan ada di SATU blok DO: tidak memakai tabel sementara, dan
-- tidak bergantung pada state antar-statement (SQL editor Supabase lewat
-- connection pooler — lihat catatan di AGENTS.md).
-- ============================================================

begin;

do $do$
declare
  t text;
  n bigint;
  total bigint := 0;
begin
  -- Urutan anak-dulu. Sebagian sudah ikut terhapus lewat ON DELETE CASCADE,
  -- tapi menyebutkannya eksplisit membuat laporannya jujur dan urutannya jelas.
  foreach t in array array[
    'task_links', 'budget_items', 'tasks', 'members', 'teams',
    'rundown', 'job_harih', 'prospects', 'links', 'budget_plans',
    'faqs', 'divisions', 'events'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice '% : tabel tidak ada, dilewati.', t;
      continue;
    end if;

    execute format('select count(*) from %I', t) into n;
    -- `delete` (bukan truncate): truncate butuh lock yang lebih berat dan
    -- melewati aturan RLS/trigger dengan cara yang tidak kita inginkan di sini.
    execute format('delete from %I', t);
    total := total + n;
    raise notice '% : % baris dihapus.', t, n;
  end loop;

  raise notice 'TOTAL % baris data aplikasi dihapus. profiles/auth/backups tidak disentuh.', total;
end $do$;

commit;

-- ------------------------------------------------------------------
-- Verifikasi: semua kolom harus 0. Kalau ada yang bukan 0, jangan lanjut
-- ke seed.sql — laporkan dulu.
-- ------------------------------------------------------------------
select
  (select count(*) from events)       as events,
  (select count(*) from divisions)    as divisions,
  (select count(*) from members)      as members,
  (select count(*) from teams)        as teams,
  (select count(*) from tasks)        as tasks,
  (select count(*) from prospects)    as prospects,
  (select count(*) from links)        as links,
  (select count(*) from budget_plans) as budget_plans,
  (select count(*) from budget_items) as budget_items,
  (select count(*) from rundown)      as rundown,
  (select count(*) from job_harih)    as job_harih,
  (select count(*) from faqs)         as faqs,
  (select count(*) from profiles)     as profiles_TETAP_UTUH;
