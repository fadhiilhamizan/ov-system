-- ============================================================
-- 1. PERBAIKAN: kehadiran hanya mencatat developer.
-- 2. Penghitung masuk Tamu & Mode Demo.
-- 3. Menu Himpunan: plotting FGD + perbandingan himpunan.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Kehadiran: hanya developer yang pernah tercatat online
--
-- GEJALA: login dengan dua akun, yang muncul di daftar online cuma developer.
--
-- SEBAB: aplikasi menulis denyut dengan upsert, dan PostgREST menerjemahkannya
-- jadi `insert ... on conflict (user_id) do update`. Postgres mensyaratkan
-- policy SELECT pada baris sasaran untuk bentuk perintah itu, bahkan saat
-- belum ada baris yang bentrok. Policy baca `presence` di 0039 berbunyi
-- `is_developer()`, jadi bagi semua orang lain barisnya tidak terlihat dan
-- SETIAP denyut ditolak dengan "new row violates row-level security policy".
-- Developer lolos justru karena ia memang boleh melihat semua baris.
--
-- PERBAIKAN: setiap akun boleh melihat BARISNYA SENDIRI. Tidak ada yang bocor
-- (satu baris, miliknya sendiri, isinya identitasnya sendiri), dan daftar
-- lengkap tetap hanya untuk developer.
-- ------------------------------------------------------------------
drop policy if exists presence_read on presence;
create policy presence_read on presence for select to authenticated
  using (is_developer() or user_id = auth.uid());

-- ------------------------------------------------------------------
-- 2. Penghitung masuk Tamu & Mode Demo
--
-- Bentuknya PENGHITUNG HARIAN, bukan satu baris per kejadian, dan itu
-- disengaja: kedua tombol ini bisa ditekan tanpa akun sama sekali (Mode Demo
-- ditekan dari halaman login, jadi pemanggilnya adalah role `anon`), sehingga
-- jalur tulisnya terbuka untuk publik. Baris per kejadian berarti siapa pun
-- bisa menggelembungkan tabel sampai penuh; penghitung per hari berarti yang
-- paling buruk terjadi hanyalah satu angka yang dilebih-lebihkan.
--
-- Menulisnya hanya lewat fungsi SECURITY DEFINER di bawah: tabelnya sendiri
-- tidak punya policy tulis sama sekali.
-- ------------------------------------------------------------------
create table if not exists access_counter (
  day date not null,
  kind text not null check (kind in ('guest', 'demo')),
  hits bigint not null default 0,
  primary key (day, kind)
);
alter table access_counter enable row level security;

drop policy if exists access_counter_read on access_counter;
create policy access_counter_read on access_counter for select to authenticated
  using (is_developer());
drop policy if exists access_counter_write on access_counter;

create or replace function record_access(p_kind text) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  -- Diam-diam diabaikan, bukan raise: pemanggilnya adalah jalur masuk pengguna,
  -- dan penghitung yang gagal tidak boleh menggagalkan proses masuk.
  if p_kind is null or p_kind not in ('guest', 'demo') then
    return;
  end if;
  insert into access_counter (day, kind, hits)
  values (current_date, p_kind, 1)
  on conflict (day, kind) do update set hits = access_counter.hits + 1;
end $fn$;

grant execute on function record_access(text) to anon, authenticated;

-- ------------------------------------------------------------------
-- 3. Menu Himpunan
--
-- 3a. Plotting FGD: pasangan departemen HMSI dengan departemen himpunan mitra.
--     Satu Ormawa Visit boleh punya beberapa tabel (mitra bisa lebih dari satu,
--     dan satu mitra bisa punya beberapa skenario plotting).
-- ------------------------------------------------------------------
create table if not exists fgd_plans (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  title text default '',
  -- Judul kolom kanan. Sengaja teks bebas, bukan foreign key ke prospects:
  -- plotting FGD sering disusun sebelum mitranya resmi tercatat.
  partner_name text default '',
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists fgd_plans_event_idx on fgd_plans(event_id);

create table if not exists fgd_rows (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references fgd_plans(id) on delete cascade,
  -- `ours` = departemen HMSI ITS, `theirs` = padanannya di himpunan mitra.
  ours text default '',
  theirs text default '',
  "order" int not null default 0
);
create index if not exists fgd_rows_plan_idx on fgd_rows(plan_id);

-- 3b. Compare: penilaian himpunan yang MENERIMA ajakan, untuk memilih mitra.
create table if not exists compare_entries (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  -- Nama himpunan disalin ke sini supaya baris penilaian tetap terbaca kalau
  -- prospeknya dihapus, sama alasannya dengan `label` di activity_log.
  org_name text default '',
  aspect text default '',
  indicator text default '',
  plus text default '',
  minus text default '',
  "order" int not null default 0
);
create index if not exists compare_entries_event_idx on compare_entries(event_id);

alter table fgd_plans enable row level security;
alter table fgd_rows enable row level security;
alter table compare_entries enable row level security;

-- Baca: sama seperti tabel operasional lain, cukup punya sesi.
do $do$
declare t text;
begin
  foreach t in array array['fgd_plans', 'fgd_rows', 'compare_entries']
  loop
    execute format('drop policy if exists "%s_read" on %I;', t, t);
    execute format('create policy "%s_read" on %I for select using (auth.uid() is not null);', t, t);
  end loop;
end $do$;

-- Tulis: menu Himpunan = full untuk admin, koordinator, staff; sisanya lihat.
-- Ini menyalin MODULE_ACCESS_LEVEL di src/lib/constants.ts, seperti policy lain.
-- `writable_event()` yang menegakkan kunci arsip.
do $do$
declare t text;
begin
  foreach t in array array['fgd_plans', 'compare_entries']
  loop
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format('drop policy if exists "%s_insert" on %I;', t, t);
    execute format('drop policy if exists "%s_update" on %I;', t, t);
    execute format('drop policy if exists "%s_delete" on %I;', t, t);
    execute format($p$create policy "%s_insert" on %I for insert to authenticated
      with check (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
                  and writable_event(event_id));$p$, t, t);
    execute format($p$create policy "%s_update" on %I for update to authenticated
      using (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
             and writable_event(event_id))
      with check (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
                  and writable_event(event_id));$p$, t, t);
    execute format($p$create policy "%s_delete" on %I for delete to authenticated
      using (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
             and writable_event(event_id));$p$, t, t);
  end loop;
end $do$;

-- fgd_rows ikut tabel induknya (tidak punya event_id sendiri), pola yang sama
-- dengan task_links dan prospect_links.
drop policy if exists fgd_rows_write on fgd_rows;
drop policy if exists fgd_rows_insert on fgd_rows;
drop policy if exists fgd_rows_update on fgd_rows;
drop policy if exists fgd_rows_delete on fgd_rows;
create policy fgd_rows_insert on fgd_rows for insert to authenticated
  with check (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
    and writable_event((select p.event_id from fgd_plans p where p.id = fgd_rows.plan_id)));
create policy fgd_rows_update on fgd_rows for update to authenticated
  using (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
    and writable_event((select p.event_id from fgd_plans p where p.id = fgd_rows.plan_id)))
  with check (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
    and writable_event((select p.event_id from fgd_plans p where p.id = fgd_rows.plan_id)));
create policy fgd_rows_delete on fgd_rows for delete to authenticated
  using (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
    and writable_event((select p.event_id from fgd_plans p where p.id = fgd_rows.plan_id)));

-- Tabel baru ikut diaudit (0039). Penghitung akses sengaja TIDAK: isinya bukan
-- data Ormawa Visit, dan satu baris jejak per klik tombol Tamu itu derau.
do $do$
declare t text;
begin
  foreach t in array array['fgd_plans', 'fgd_rows', 'compare_entries']
  loop
    execute format('drop trigger if exists %I on %I;', 'audit_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on %I for each row execute function audit_row();',
      'audit_' || t, t);
  end loop;
end $do$;
