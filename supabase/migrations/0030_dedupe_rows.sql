-- ============================================================
-- 0030 — Buang baris duplikat hasil menjalankan skrip seed/SQL lebih dari sekali.
--
-- Cara kerjanya: dua baris dianggap KEMBAR hanya kalau SELURUH isinya identik
-- setelah `id` (dan kolom waktu otomatis) dikeluarkan. Jadi dua tugas yang
-- kebetulan berjudul sama tapi beda PIC / tanggal / divisi TIDAK akan tersentuh —
-- yang dibuang hanya salinan yang benar-benar persis sama.
--
-- Dari tiap kelompok kembar, satu baris dipertahankan (yang tertua secara fisik,
-- lewat ctid). Baris yang dipertahankan mempertahankan id-nya, sehingga semua
-- foreign key yang menunjuk ke sana tetap utuh.
--
-- Urutan: induk dulu (events tidak disentuh sama sekali), lalu anak. Menghapus
-- budget_plans kembar otomatis menghapus item-nya lewat cascade.
--
-- Jalankan SETELAH 0029. Idempotent: menjalankannya dua kali tidak menghapus
-- apa pun lagi, karena setelah lolos sekali tidak ada kembar tersisa.
--
-- Laporan jumlah yang dibuang per tabel ditampilkan di akhir.
-- ============================================================

begin;

create temporary table if not exists dedupe_report (
  tabel text primary key,
  sebelum bigint,
  sesudah bigint
) on commit drop;

do $do$
declare
  t text;
  -- Kolom yang HARUS diabaikan saat membandingkan: kunci baris dan stempel
  -- waktu, yang memang selalu berbeda antar salinan.
  ignored text[] := array['id', 'created_at', 'updated_at'];
  ign text;
  expr text;
  n_before bigint;
  n_after bigint;
begin
  foreach t in array array[
    'divisions', 'members', 'teams', 'tasks', 'task_links',
    'prospects', 'links', 'budget_plans', 'budget_items',
    'rundown', 'job_harih', 'faqs'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    -- to_jsonb(baris) dikurangi kolom yang diabaikan = "isi" baris.
    expr := format('to_jsonb(%I)', t);
    foreach ign in array ignored loop
      expr := expr || format(' - %L', ign);
    end loop;

    execute format('select count(*) from %I', t) into n_before;

    execute format(
      'delete from %I a using %I b where a.ctid > b.ctid and %s = %s',
      t, t,
      replace(expr, format('to_jsonb(%I)', t), 'to_jsonb(a)'),
      replace(expr, format('to_jsonb(%I)', t), 'to_jsonb(b)')
    );

    execute format('select count(*) from %I', t) into n_after;
    insert into dedupe_report(tabel, sebelum, sesudah) values (t, n_before, n_after);
  end loop;
end $do$;

-- ------------------------------------------------------------------
-- Laporan: berapa baris kembar yang dibuang per tabel.
-- ------------------------------------------------------------------
select
  tabel,
  sebelum,
  sesudah,
  (sebelum - sesudah) as dibuang
from dedupe_report
order by (sebelum - sesudah) desc, tabel;

commit;
