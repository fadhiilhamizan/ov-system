-- ============================================================
-- 0030 - Buang baris duplikat hasil menjalankan skrip seed/SQL lebih dari sekali.
--
-- Cara kerjanya: dua baris dianggap KEMBAR hanya kalau SELURUH isinya identik
-- setelah `id` dan stempel waktu dikeluarkan. Jadi dua tugas yang kebetulan
-- berjudul sama tapi beda PIC / tanggal / divisi TIDAK tersentuh - yang dibuang
-- hanya salinan yang benar-benar persis sama. Baris identik milik EDISI berbeda
-- juga aman, karena event_id ikut dibandingkan.
--
-- Dari tiap kelompok kembar, satu baris dipertahankan (yang tertua secara fisik,
-- lewat ctid) beserta id-nya, sehingga semua foreign key tetap utuh.
--
-- CATATAN PENTING (versi sebelumnya gagal karena ini):
--   Migrasi ini TIDAK memakai tabel sementara. Sebuah `create temporary table`
--   hanya hidup dalam satu sesi, dan SQL editor Supabase berjalan lewat
--   connection pooler - statement berikutnya bisa mendarat di koneksi lain,
--   sehingga tabelnya "tidak ada". Semua kerja di sini muat dalam SATU statement
--   (blok DO), lalu satu SELECT laporan yang berdiri sendiri.
--
-- Rincian berapa baris yang dibuang per tabel muncul sebagai NOTICE di panel
-- hasil SQL editor. Tabel di bawahnya menampilkan jumlah baris yang tersisa.
--
-- Jalankan SETELAH 0029. Idempotent: dijalankan dua kali tidak menghapus lagi.
-- ============================================================

begin;

do $do$
declare
  t text;
  n_before bigint;
  n_after bigint;
  total bigint := 0;
begin
  foreach t in array array[
    'divisions', 'members', 'teams', 'tasks', 'task_links',
    'prospects', 'links', 'budget_plans', 'budget_items',
    'rundown', 'job_harih', 'faqs'
  ]
  loop
    -- task_links lahir di 0025 dan tidak dipasang di project demo.
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('select count(*) from %I', t) into n_before;

    -- to_jsonb(baris) dikurangi id + stempel waktu = "isi" baris.
    -- Mengurangi kunci yang tidak ada di sebuah tabel tidak apa-apa: jsonb
    -- mengabaikannya, jadi satu ekspresi ini cocok untuk semua tabel.
    execute format(
      'delete from %I a using %I b
       where a.ctid > b.ctid
         and to_jsonb(a) - ''id'' - ''created_at'' - ''updated_at''
           = to_jsonb(b) - ''id'' - ''created_at'' - ''updated_at''',
      t, t
    );

    execute format('select count(*) from %I', t) into n_after;
    if n_before <> n_after then
      total := total + (n_before - n_after);
      raise notice '% : % baris kembar dibuang (% -> %)', t, n_before - n_after, n_before, n_after;
    end if;
  end loop;

  if total = 0 then
    raise notice 'Tidak ada baris kembar. Tidak ada yang dihapus.';
  else
    raise notice 'TOTAL % baris kembar dibuang.', total;
  end if;
end $do$;

commit;

-- ------------------------------------------------------------------
-- Laporan: jumlah baris yang TERSISA di tiap tabel setelah dedupe.
-- (Berapa yang dibuang ada di NOTICE panel hasil, lihat di atas.)
-- ------------------------------------------------------------------
select 'divisions'    as tabel, count(*) as sisa from divisions
union all select 'members',      count(*) from members
union all select 'teams',        count(*) from teams
union all select 'tasks',        count(*) from tasks
union all select 'prospects',    count(*) from prospects
union all select 'links',        count(*) from links
union all select 'budget_plans', count(*) from budget_plans
union all select 'budget_items', count(*) from budget_items
union all select 'rundown',      count(*) from rundown
union all select 'job_harih',    count(*) from job_harih
union all select 'faqs',         count(*) from faqs
order by 1;
