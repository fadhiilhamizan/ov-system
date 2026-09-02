-- ============================================================
-- 0047 - Memindahkan item RAB antar kategori, dan mengurutkan baris FGD.
--
-- (A) move_budget_item: menyeret satu item Anggaran ke KATEGORI LAIN sekarang
--     mengubah dua hal sekaligus, kategori barisnya dan urutan seluruh item di
--     rencana itu. Lewat PostgREST itu dua perintah, masing-masing transaksinya
--     sendiri: kalau yang kedua gagal, itemnya sudah pindah kategori tapi
--     urutannya tertinggal, dan judul kategori di tabel RAB diturunkan DARI
--     urutan itu, jadi satu kategori terbelah dua di layar. Alasan yang sama
--     dengan create_fgd_plan di 0045 dan restore_snapshot di 0043.
--
--     Warna kategori ikut diurus di sini. Titik warna itu milik KATEGORI, bukan
--     milik satu baris (lihat setCategoryColor), jadi item yang pindah harus
--     mengambil warna kategori tujuan. Tanpa itu satu kategori bisa menampilkan
--     dua titik warna berbeda, tergantung baris mana yang kebetulan paling atas.
--
-- (B) reorder_rows kenal 'fgd_rows': baris plotting FGD sekarang bisa diseret,
--     sama seperti item RAB, FAQ dan Hari-H. Nomor urutnya 0-based, mengikuti
--     kolom "order" yang sudah dipakai create_fgd_plan.
--
-- Keduanya security invoker: RLS tetap berlaku, jadi kunci arsip dan pembatasan
-- peran di policy tetap yang menentukan, bukan fungsi ini.
-- ============================================================

-- ---------- (A) reorder_rows + fgd_rows --------------------------------------
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

  if kind = 'budget_items' then
    update budget_items b
       set "order" = i.pos - 1
      from unnest(ids) with ordinality as i(id, pos)
     where b.id = i.id;
  elsif kind = 'faqs' then
    update faqs f
       set "order" = i.pos
      from unnest(ids) with ordinality as i(id, pos)
     where f.id = i.id;
  elsif kind = 'job_harih' then
    update job_harih j
       set no = i.pos::text
      from unnest(ids) with ordinality as i(id, pos)
     where j.id = i.id;
  elsif kind = 'fgd_rows' then
    update fgd_rows r
       set "order" = i.pos - 1
      from unnest(ids) with ordinality as i(id, pos)
     where r.id = i.id;
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

-- ---------- (B) move_budget_item ---------------------------------------------
drop function if exists move_budget_item(uuid, text, uuid[]);

create or replace function move_budget_item(
  p_item_id uuid,
  p_category text,
  p_ids uuid[] default '{}'
)
returns integer
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_plan   uuid;
  v_colour text;
  touched  integer := 0;
begin
  select plan_id into v_plan from budget_items where id = p_item_id;
  if v_plan is null then
    raise exception 'item anggaran tidak ditemukan' using errcode = '22023';
  end if;

  -- Warna kategori tujuan, diambil dari baris yang sudah ada di sana. NULL
  -- kalau kategori itu belum pernah diberi warna: pemanggil jatuh ke palet
  -- preset, persis seperti kategori baru.
  select b.category_color into v_colour
    from budget_items b
   where b.plan_id = v_plan
     and b.category = p_category
     and b.id <> p_item_id
     and b.category_color is not null
   limit 1;

  update budget_items
     set category = p_category,
         category_color = v_colour
   where id = p_item_id;

  if p_ids is not null and array_length(p_ids, 1) is not null then
    update budget_items b
       set "order" = i.pos - 1
      from unnest(p_ids) with ordinality as i(id, pos)
     where b.id = i.id
       and b.plan_id = v_plan;
    get diagnostics touched = row_count;
  end if;

  return touched;
end; $fn$;

revoke all on function move_budget_item(uuid, text, uuid[]) from public, anon;
grant execute on function move_budget_item(uuid, text, uuid[]) to authenticated;

comment on function move_budget_item(uuid, text, uuid[]) is
  'Pindahkan satu item RAB ke kategori lain sekaligus tulis ulang urutan rencananya, dalam satu transaksi. RLS tetap berlaku (security invoker).';
