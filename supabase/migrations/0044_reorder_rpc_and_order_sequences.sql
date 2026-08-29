-- ============================================================
-- 0044 - Dua hal tentang kolom "order".
--
-- (A) MENGURUTKAN ULANG jadi SATU perintah.
--     Menyeret satu item mengirim seluruh urutan baru, dan aplikasi
--     menuliskannya sebagai satu UPDATE per baris. Satu RAB berisi 80 item
--     berarti 80 permintaan HTTP paralel ke Supabase untuk satu kali seret.
--     `reorder_rows()` melakukannya dalam satu pernyataan.
--
-- (B) NOMOR URUT BARU tidak lagi berebut.
--     `createFaq`, `createBudgetItem`, `createEvent`, dan `createDivision`
--     membaca max("order") lalu menulis max+1 sebagai dua perintah terpisah.
--     Dua orang yang menambah item pada saat bersamaan sama-sama membaca angka
--     yang sama dan menulis nomor kembar; urutannya jadi acak di antara
--     keduanya. Solusinya SEQUENCE, bukan trigger: nilai berikutnya diambil
--     atomik tanpa penguncian, dan karena "order" hanya dipakai untuk
--     MENGURUTKAN, lompatan angka sama sekali tidak masalah.
--
--     Kenapa bukan trigger: kolomnya `not null default 0`, jadi trigger tidak
--     bisa membedakan "0 karena tidak diisi" dari "0 karena memang nol". Salin
--     data antar-edisi menulis order 0,1,2,... secara eksplisit, dan trigger
--     yang menganggap 0 sebagai "isikan otomatis" akan merusak urutan salinan.
--
-- Aman dijalankan berulang (idempotent). Jalankan SETELAH 0043.
-- ============================================================

-- ---------- (A) reorder_rows -------------------------------------------------
drop function if exists reorder_rows(text, uuid[]);

create or replace function reorder_rows(kind text, ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  touched integer := 0;
begin
  if ids is null or array_length(ids, 1) is null then
    return 0;
  end if;

  -- Whitelist. `kind` names a behaviour, not a table, so no identifier from the
  -- caller ever reaches SQL: each branch is written out in full.
  if kind = 'budget_items' then
    update budget_items b
       set "order" = i.pos - 1                 -- 0-based, as the RAB table renders
      from unnest(ids) with ordinality as i(id, pos)
     where b.id = i.id;
  elsif kind = 'faqs' then
    update faqs f
       set "order" = i.pos                     -- 1-based
      from unnest(ids) with ordinality as i(id, pos)
     where f.id = i.id;
  elsif kind = 'job_harih' then
    update job_harih j
       set no = i.pos::text                    -- `no` is text on this table
      from unnest(ids) with ordinality as i(id, pos)
     where j.id = i.id;
  else
    raise exception 'unknown reorder kind: %', kind using errcode = '22023';
  end if;

  get diagnostics touched = row_count;
  return touched;
end; $fn$;

revoke all on function reorder_rows(text, uuid[]) from public, anon;
grant execute on function reorder_rows(text, uuid[]) to authenticated;

comment on function reorder_rows(text, uuid[]) is
  'Tulis ulang kolom urutan untuk daftar id, dalam satu pernyataan. RLS tetap berlaku (security invoker).';

-- ---------- (B) sequence untuk nomor urut baru -------------------------------
-- Satu sequence per tabel. Di-seed di atas nilai tertinggi yang ada supaya
-- baris baru mendarat di AKHIR daftar, bukan di awal.
do $do$
declare
  t   text;
  seq text;
  hi  bigint;
begin
  foreach t in array array['faqs', 'events', 'divisions', 'budget_items']
  loop
    seq := t || '_order_seq';
    execute format('create sequence if not exists %I', seq);
    execute format('alter table %I alter column "order" set default nextval(%L)', t, seq);
    execute format('alter sequence %I owned by %I."order"', seq, t);

    -- Idempotent: naikkan seed hanya kalau data yang ada sudah melewatinya.
    execute format('select coalesce(max("order"), 0) from %I', t) into hi;
    execute format('select setval(%L, greatest(%s, (select last_value from %I)) + 1, false)',
                   seq, hi, seq);

    -- Pelajaran dari error_log (0039): sebuah default nextval() tidak berguna
    -- kalau perannya tidak boleh memakai sequence-nya.
    execute format('grant usage, select on sequence %I to authenticated', seq);
  end loop;
end $do$;
