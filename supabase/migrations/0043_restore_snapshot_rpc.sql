-- ============================================================
-- 0043 - Restore backup jadi SATU transaksi.
--
-- MASALAHNYA. Restore dulu dikerjakan dari aplikasi: 16 perintah DELETE lewat
-- PostgREST, lalu 16 perintah INSERT. Tiap perintah adalah transaksinya
-- sendiri. Jadi kalau perintah ke-9 gagal (kolom baru yang belum ada di
-- snapshot lama, constraint, penolakan RLS, koneksi putus), yang tersisa
-- adalah database SETENGAH DIPULIHKAN: sebagian tabel sudah kosong, sebagian
-- sudah terisi, dan tidak ada satu pun cara otomatis untuk kembali. Satu-
-- satunya mitigasi adalah prosedur manual (ambil backup pre_restore dulu).
--
-- PERBAIKANNYA. Semua DELETE dan INSERT pindah ke dalam satu fungsi. Badan
-- fungsi plpgsql berjalan di dalam satu transaksi, jadi kegagalan apa pun
-- membatalkan seluruhnya dan data lama tetap utuh. Yang tadinya "mudah-mudahan
-- tidak gagal di tengah" jadi "tidak bisa gagal di tengah".
--
-- SECURITY INVOKER, BUKAN DEFINER. Ini penting dan disengaja: fungsi berjalan
-- sebagai pemanggilnya, jadi RLS tetap berlaku persis seperti sebelumnya.
-- Tidak ada jalur di aplikasi ini yang boleh melewati RLS. Admin tetap bisa
-- menyentuh edisi yang diarsipkan karena `writable_event()` memang selalu
-- true untuk admin, bukan karena fungsinya mengangkat hak.
--
-- Aman dijalankan berulang. Jalankan SETELAH 0042.
-- ============================================================

-- Dijatuhkan dulu supaya perubahan tipe kembalian tidak ditolak.
drop function if exists restore_snapshot(jsonb);

create or replace function restore_snapshot(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  tbl       text;
  i         int;
  deleted   bigint;
  inserted  bigint;
  cols      text;
  report    jsonb := '{}'::jsonb;
  -- Urutan HAPUS: anak dulu, induk belakangan. INSERT menyusuri terbalik.
  -- Sama persis dengan DELETE_ORDER di src/lib/backup.ts; kalau salah satu
  -- berubah, yang lain wajib ikut.
  del_order constant text[] := array[
    'task_links', 'task_refs', 'prospect_links', 'budget_items',
    'tasks', 'members', 'teams', 'rundown', 'job_harih',
    'prospects', 'links', 'budget_plans', 'faqs', 'divisions', 'events'
  ];
begin
  if auth_role() <> 'admin' or is_anon() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'snapshot payload must be a json object' using errcode = '22023';
  end if;

  -- Satu restore adalah ribuan baris hapus dan tulis. Mencatat tiap barisnya
  -- akan mengubur riwayat asli di bawah kebisingan restore itu sendiri, sama
  -- alasannya dengan reset-data.sql. Jejaknya tetap ada: baris `pre_restore`
  -- di tabel `backups` yang diambil sesaat sebelum ini.
  perform set_config('app.audit', 'off', true);

  foreach tbl in array del_order loop
    execute format('delete from public.%I', tbl);
    get diagnostics deleted = row_count;
    report := jsonb_set(
      report, array[tbl],
      jsonb_build_object('deleted', deleted, 'inserted', 0), true);
  end loop;

  for i in reverse array_length(del_order, 1) .. 1 loop
    tbl := del_order[i];
    -- Tabel yang tidak ada di berkas diperlakukan sebagai kosong: snapshot
    -- lama dibuat sebelum sebagian tabel ini ada.
    if payload ? tbl and jsonb_typeof(payload -> tbl) = 'array' then
      -- Kolom yang BENAR-BENAR disebut berkas dan memang ada di tabel.
      -- Kunci asing hilang di sini (bukan di JavaScript), dan yang lebih
      -- penting: kolom yang tidak disebut sama sekali TIDAK ikut di-insert,
      -- jadi nilainya jatuh ke DEFAULT kolom. Versi pertama memakai
      -- `select *`, yang menulis NULL untuk kolom yang tidak ada di berkas
      -- dan menimpa default - satu snapshot lama yang dibuat sebelum sebuah
      -- kolom NOT NULL ditambahkan akan menggagalkan seluruh restore.
      select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
        into cols
        from information_schema.columns c
       where c.table_schema = 'public'
         and c.table_name = tbl
         and exists (
           select 1 from jsonb_array_elements(payload -> tbl) e where e ? c.column_name
         );

      if cols is not null then
        execute format(
          'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)',
          tbl, cols, cols, tbl
        ) using payload -> tbl;
        get diagnostics inserted = row_count;
        report := jsonb_set(report, array[tbl, 'inserted'], to_jsonb(inserted), true);
      end if;
    end if;
  end loop;

  return report;
end; $fn$;

grant execute on function restore_snapshot(jsonb) to authenticated;

comment on function restore_snapshot(jsonb) is
  'Ganti seluruh data aplikasi dengan isi snapshot, dalam satu transaksi. Admin saja; RLS tetap berlaku (security invoker).';
