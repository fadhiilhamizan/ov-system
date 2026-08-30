-- ============================================================
-- 0045 - Membuat tabel plotting FGD dalam SATU transaksi.
--
-- createFgdPlan mengirim dua perintah lewat PostgREST: insert satu baris ke
-- fgd_plans, lalu insert sepuluh baris departemen ke fgd_rows. Masing-masing
-- transaksinya sendiri. Kalau yang kedua gagal (kunci arsip baru menyala,
-- sesinya kedaluwarsa, koneksinya putus), yang pertama sudah terlanjur
-- tersimpan: muncul kartu FGD kosong tanpa satu baris pun, dan tidak ada yang
-- membatalkannya. Alasan yang sama dengan restore_snapshot di 0043.
--
-- Daftar departemennya dikirim dari aplikasi (HMSI_DEPARTMENTS di
-- src/lib/constants.ts) supaya namanya hanya ditulis di satu tempat. Menyalin
-- kesepuluh nama ke dalam SQL berarti dua daftar yang pelan-pelan berbeda.
--
-- security invoker: RLS tetap berlaku, jadi kunci arsip (writable_event) dan
-- pembatasan peran di policy fgd_plans_insert / fgd_rows_insert tetap yang
-- menentukan, bukan fungsi ini.
-- ============================================================

drop function if exists create_fgd_plan(text, text, text, text[]);

create or replace function create_fgd_plan(
  p_event_id text,
  p_title text default '',
  p_partner text default '',
  p_rows text[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  new_id uuid;
  next_order int;
begin
  -- Baris baru mendarat di akhir daftar.
  select coalesce(max("order") + 1, 0) into next_order
    from fgd_plans where event_id = p_event_id;

  insert into fgd_plans (event_id, title, partner_name, "order")
  values (p_event_id, coalesce(p_title, ''), coalesce(p_partner, ''), next_order)
  returning id into new_id;

  if p_rows is not null and array_length(p_rows, 1) is not null then
    insert into fgd_rows (plan_id, ours, theirs, "order")
    select new_id, d.name, '', d.pos - 1
      from unnest(p_rows) with ordinality as d(name, pos);
  end if;

  return new_id;
end; $fn$;

revoke all on function create_fgd_plan(text, text, text, text[]) from public, anon;
grant execute on function create_fgd_plan(text, text, text, text[]) to authenticated;

comment on function create_fgd_plan(text, text, text, text[]) is
  'Buat satu tabel plotting FGD beserta baris awalnya dalam satu transaksi. RLS tetap berlaku (security invoker).';
