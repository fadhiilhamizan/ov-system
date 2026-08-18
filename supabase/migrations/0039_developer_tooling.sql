-- ============================================================
-- Perkakas developer: jejak audit, kehadiran, dan catatan error.
--
-- KENAPA DI DATABASE, BUKAN DI APLIKASI.
-- Jejak "siapa mengubah apa" sempat direncanakan lewat lapisan Server Action,
-- tapi itu berarti menyisipkan pemanggilan di sekitar 60 action, dan setiap
-- action baru yang lupa memanggilnya akan diam-diam hilang dari catatan. Lebih
-- buruk lagi: kunci anon itu publik, jadi PostgREST bisa dipanggil langsung
-- tanpa melewati aplikasi sama sekali (alasan yang sama kenapa RLS adalah
-- satu-satunya batas otorisasi yang nyata di sini). Trigger menangkap SEMUA
-- penulisan, dari mana pun asalnya, dan tidak bisa dilupakan saat menambah
-- fitur.
--
-- SIAPA YANG BOLEH MELIHAT. Hanya akun yang emailnya terdaftar di tabel
-- `developers`. Peran Developer sengaja BUKAN nilai baru pada enum app_role:
-- menambahnya ke enum akan memunculkannya di matriks hak akses, di daftar
-- pengajuan peran, dan di Panduan. Peran ini harus tidak terlihat, jadi ia
-- hidup sebagai lapisan terpisah di atas peran biasa: seorang developer tetap
-- Admin (atau apa pun) untuk seluruh sistem, dan hanya mendapat SATU menu
-- tambahan yang tidak tercatat di mana-mana.
--
-- Emailnya TIDAK ada di file ini dengan sengaja: repositori ini publik.
-- Daftarkan lewat supabase/developers.local.sql (tidak ikut git).
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Daftar developer + penjaganya
-- ------------------------------------------------------------------
create table if not exists developers (
  email text primary key,
  note text default '',
  created_at timestamptz not null default now()
);
alter table developers enable row level security;

-- SECURITY DEFINER, jadi ia membaca `developers` melewati RLS. Tanpa itu policy
-- di bawah akan memanggil dirinya sendiri lewat tabel yang sedang dijaganya.
-- Pola yang sama dipakai auth_role() dan has_role().
create or replace function is_developer() returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.developers d
    where lower(d.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$fn$;

-- Kamu boleh melihat barisMU SENDIRI (itulah cara aplikasi tahu kamu developer
-- tanpa harus jadi developer dulu), dan developer melihat semuanya.
drop policy if exists developers_read on developers;
create policy developers_read on developers for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) or is_developer());

-- Menulis daftar ini HANYA lewat SQL editor. Sengaja tidak ada policy insert,
-- update, maupun delete: siapa pun yang bisa menambahkan dirinya ke sini akan
-- mendapat seluruh jejak audit setiap orang.
drop policy if exists developers_write on developers;

-- ------------------------------------------------------------------
-- 2. Jejak audit
-- ------------------------------------------------------------------
create table if not exists activity_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text default '',
  actor_role text default '',
  table_name text not null,
  row_id text default '',
  -- Judul baris pada saat itu, supaya daftarnya bisa dibaca tanpa menyusuri id
  -- ke tabel aslinya, yang barisnya mungkin sudah dihapus.
  label text default '',
  action text not null check (action in ('insert', 'update', 'delete')),
  event_id text,
  -- Hanya kolom yang BERUBAH, bentuknya kolom -> dari/jadi.
  changed jsonb,
  -- Baris utuh, hanya untuk insert dan delete. Untuk update sudah terwakili
  -- oleh `changed`, dan menyimpan dua salinan penuh tiap kali akan membengkak.
  snapshot jsonb
);
create index if not exists activity_log_at_idx on activity_log(at desc);
create index if not exists activity_log_actor_idx on activity_log(actor_id);
create index if not exists activity_log_table_idx on activity_log(table_name, at desc);
create index if not exists activity_log_row_idx on activity_log(table_name, row_id);

alter table activity_log enable row level security;
drop policy if exists activity_log_read on activity_log;
create policy activity_log_read on activity_log for select to authenticated
  using (is_developer());
-- Tidak ada policy tulis: satu-satunya penulis adalah trigger di bawah, yang
-- SECURITY DEFINER sehingga tidak tunduk pada RLS. Jejak audit yang bisa
-- ditulis atau dihapus oleh yang diaudit bukan jejak audit.
drop policy if exists activity_log_write on activity_log;

-- Nama yang paling masuk akal untuk sebuah baris, apa pun tabelnya.
create or replace function audit_label(row_json jsonb) returns text
language sql immutable as $fn$
  select left(coalesce(
    nullif(btrim(row_json ->> 'title'), ''),
    nullif(btrim(row_json ->> 'name'), ''),
    nullif(btrim(row_json ->> 'org_name'), ''),
    nullif(btrim(row_json ->> 'activity'), ''),
    nullif(btrim(row_json ->> 'job'), ''),
    nullif(btrim(row_json ->> 'question'), ''),
    nullif(btrim(row_json ->> 'label'), ''),
    nullif(btrim(row_json ->> 'url'), ''),
    ''
  ), 200);
$fn$;

create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  old_json jsonb;
  new_json jsonb;
  diff jsonb;
  row_json jsonb;
begin
  -- Klep darurat untuk pemuatan massal (seed.sql, reset-data.sql). Tanpa ini
  -- satu kali seed menambah ratusan baris jejak yang tidak menjelaskan apa pun.
  if coalesce(current_setting('app.audit', true), 'on') = 'off' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    -- Kolom pembukuan dibuang SEBELUM dibandingkan. Tabel yang punya trigger
    -- updated_at mengubah kolom itu pada SETIAP penyimpanan, jadi tanpa ini
    -- menyimpan form tanpa mengetik apa pun tetap tercatat sebagai perubahan,
    -- dan isinya cuma updated_at. Jejak audit yang penuh baris semacam itu
    -- sama saja dengan tidak punya jejak audit.
    -- `snapshot` (insert/delete) tetap memuat baris utuh apa adanya.
    old_json := to_jsonb(old) - 'updated_at' - 'created_at';
    new_json := to_jsonb(new) - 'updated_at' - 'created_at';
    select jsonb_object_agg(k, jsonb_build_object('dari', old_json -> k, 'jadi', new_json -> k))
      into diff
      from jsonb_object_keys(new_json) as k
     where new_json -> k is distinct from old_json -> k;
    -- Penulisan yang tidak mengubah apa pun, misalnya menyimpan form tanpa
    -- mengetik apa-apa, tidak layak masuk catatan.
    if diff is null then
      return null;
    end if;
    row_json := new_json;
  elsif tg_op = 'INSERT' then
    row_json := to_jsonb(new);
  else
    row_json := to_jsonb(old);
  end if;

  insert into activity_log (actor_id, actor_email, actor_role, table_name, row_id,
                            label, action, event_id, changed, snapshot)
  values (
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', ''),
    coalesce((select p.role::text from profiles p where p.id = auth.uid()), ''),
    tg_table_name,
    coalesce(row_json ->> 'id', ''),
    audit_label(row_json),
    lower(tg_op),
    row_json ->> 'event_id',
    diff,
    case when tg_op = 'UPDATE' then null else row_json end
  );
  return null;
end $fn$;

-- Dipasang ke setiap tabel data. Yang SENGAJA dilewati: activity_log sendiri
-- (rekursi), presence (denyut per menit, isinya bukan perubahan data),
-- error_log, dan developers (menambah developer dilakukan di SQL editor dan
-- justru akan membocorkan emailnya ke jejak yang dibaca semua developer).
do $do$
declare t text;
begin
  foreach t in array array['events', 'divisions', 'members', 'tasks', 'task_links', 'task_refs',
                           'prospects', 'prospect_links', 'links', 'budget_plans', 'budget_items',
                           'rundown', 'job_harih', 'faqs', 'teams', 'profiles', 'role_requests']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop trigger if exists %I on %I;', 'audit_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on %I for each row execute function audit_row();',
      'audit_' || t, t);
  end loop;
end $do$;

-- ------------------------------------------------------------------
-- 3. Kehadiran (siapa sedang online)
-- ------------------------------------------------------------------
create table if not exists presence (
  user_id uuid primary key,
  email text default '',
  name text default '',
  role text default '',
  path text default '',
  last_seen timestamptz not null default now()
);
create index if not exists presence_seen_idx on presence(last_seen desc);
alter table presence enable row level security;

-- Denyutnya ditulis oleh setiap akun untuk dirinya sendiri; yang MEMBACA hanya
-- developer. Daftar siapa sedang online adalah informasi pengawasan, bukan
-- fitur sosial, jadi tidak boleh terlihat oleh sesama pengguna.
drop policy if exists presence_read on presence;
create policy presence_read on presence for select to authenticated
  using (is_developer());
drop policy if exists presence_upsert on presence;
create policy presence_upsert on presence for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists presence_update on presence;
create policy presence_update on presence for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------
-- 4. Catatan error
-- ------------------------------------------------------------------
create table if not exists error_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null default 'client' check (kind in ('client', 'boundary', 'server')),
  message text not null,
  stack text default '',
  path text default '',
  user_agent text default '',
  user_id uuid default auth.uid(),
  user_email text default (auth.jwt() ->> 'email'),
  resolved boolean not null default false
);
create index if not exists error_log_at_idx on error_log(at desc);
create index if not exists error_log_open_idx on error_log(resolved, at desc);
alter table error_log enable row level security;

drop policy if exists error_log_read on error_log;
create policy error_log_read on error_log for select to authenticated
  using (is_developer());

-- Siapa pun yang punya sesi boleh MELAPORKAN error: kalau hanya developer yang
-- bisa, satu-satunya error yang tercatat adalah milik developer, padahal
-- gunanya justru mendengar dari pengguna lain. Dibatasi 20 laporan per menit
-- per akun supaya jalur ini tidak jadi cara membanjiri tabel.
drop policy if exists error_log_insert on error_log;
create policy error_log_insert on error_log for insert to authenticated
  with check (
    auth.uid() is not null
    and (select count(*) from error_log e
          where e.user_id = auth.uid() and e.at > now() - interval '1 minute') < 20
  );

-- Menandai selesai dan menghapus hanya boleh oleh developer.
drop policy if exists error_log_update on error_log;
create policy error_log_update on error_log for update to authenticated
  using (is_developer()) with check (is_developer());
drop policy if exists error_log_delete on error_log;
create policy error_log_delete on error_log for delete to authenticated
  using (is_developer());

-- Identitas pelapor tidak boleh datang dari klien: kolomnya diisi default dari
-- token. Tanpa pencabutan ini siapa pun bisa menulis error atas nama orang lain.
revoke insert on public.error_log from authenticated, anon;
grant insert (kind, message, stack, path, user_agent) on public.error_log to authenticated;

-- bigserial: menulis baris juga butuh izin ke SEQUENCE-nya, dan itu TIDAK ikut
-- dalam grant tabel. Tanpa baris ini setiap laporan error gagal dengan
-- "permission denied for sequence error_log_id_seq", artinya fitur pelaporan
-- error tidak akan pernah mencatat apa pun. Ditemukan oleh npm run db:test.
grant usage, select on sequence error_log_id_seq to authenticated;

-- ------------------------------------------------------------------
-- 5. Pemangkasan dan ringkasan
--    Jejak audit tumbuh selamanya kalau dibiarkan. Fungsinya SECURITY DEFINER
--    (tabelnya memang tidak punya policy delete) dan memeriksa sendiri bahwa
--    pemanggilnya developer.
-- ------------------------------------------------------------------
create or replace function prune_activity_log(keep_days int default 90) returns bigint
language plpgsql security definer set search_path = public as $fn$
declare n bigint;
begin
  if not is_developer() then
    raise exception 'hanya developer';
  end if;
  delete from activity_log where at < now() - make_interval(days => greatest(keep_days, 1));
  get diagnostics n = row_count;
  return n;
end $fn$;

create or replace function prune_error_log(keep_days int default 30) returns bigint
language plpgsql security definer set search_path = public as $fn$
declare n bigint;
begin
  if not is_developer() then
    raise exception 'hanya developer';
  end if;
  delete from error_log where at < now() - make_interval(days => greatest(keep_days, 1));
  get diagnostics n = row_count;
  return n;
end $fn$;

-- Ringkasan per akun. Dibuat sebagai fungsi, bukan view, supaya is_developer()
-- diperiksa sekali di sini alih-alih diandalkan pada RLS tiap tabel.
create or replace function activity_by_actor()
returns table (actor_id uuid, actor_email text, actor_role text, edits bigint,
               inserts bigint, updates bigint, deletes bigint, last_edit timestamptz)
language sql stable security definer set search_path = public as $fn$
  select a.actor_id,
         max(a.actor_email) as actor_email,
         max(a.actor_role)  as actor_role,
         count(*)                                    as edits,
         count(*) filter (where a.action = 'insert') as inserts,
         count(*) filter (where a.action = 'update') as updates,
         count(*) filter (where a.action = 'delete') as deletes,
         max(a.at)                                   as last_edit
    from activity_log a
   where is_developer()
   group by a.actor_id
   order by count(*) desc;
$fn$;

-- Jumlah baris per tabel, untuk panel kesehatan database. Dihitung sungguhan
-- (bukan dari statistik planner) karena tabel di sini kecil dan angka yang
-- meleset justru bikin ragu saat sedang menelusuri masalah.
create or replace function table_counts()
returns table (table_name text, rows bigint)
language plpgsql stable security definer set search_path = public as $fn$
declare t text; n bigint;
begin
  if not is_developer() then
    raise exception 'hanya developer';
  end if;
  foreach t in array array['events', 'divisions', 'members', 'tasks', 'task_links', 'task_refs',
                           'prospects', 'prospect_links', 'links', 'budget_plans', 'budget_items',
                           'rundown', 'job_harih', 'faqs', 'teams', 'profiles', 'role_requests',
                           'backups', 'activity_log', 'error_log', 'presence']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('select count(*) from %I', t) into n;
    table_name := t;
    rows := n;
    return next;
  end loop;
end $fn$;
