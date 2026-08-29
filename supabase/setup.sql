-- ============================================================
-- Ormawa Visit Management System - SETUP LENGKAP (satu file)
-- Setara migrasi 0001–0028 · v1.20.0
--
-- CARA PAKAI: tempel SELURUH isi file ini ke Supabase SQL Editor, lalu Run.
-- Cukup SEKALI. Tidak perlu lagi menjalankan file 0001–0028 satu per satu.
--
-- AMAN DIJALANKAN ULANG (idempotent) dan aman dijalankan di database yang
-- SUDAH terisi: semua DDL memakai `if not exists` / `drop … if exists`, dan
-- file ini TIDAK memuat satu pun perintah yang menghapus atau menimpa data.
--
-- Yang TIDAK ada di sini, dan memang tidak boleh ada:
--   * Migrasi data sekali-jalan - 0004 (isi FAQ), 0007 (perbaikan URL Super
--     Link), 0013 (hapus RAB HMD), 0019 (roster asli HMSI). Semuanya sudah
--     dijalankan di produksi; mengulangnya akan menimpa data yang sekarang.
--   * Backfill sekali-jalan (0005/0012/0014/0018/0027) - hanya relevan untuk
--     database yang isinya masih berformat lama. Kalau kamu memang menyiapkan
--     project baru dari nol, jalankan `supabase/seed.sql` setelah file ini.
--   * 0006 (bucket Storage) - fiturnya sudah dicabut, bucketnya tidak dipakai.
--
-- SETELAH menjalankan file ini:
--   1. Supabase → Authentication → Providers → aktifkan "Anonymous sign-ins"
--      (dipakai tombol "Masuk sebagai Tamu").
--   2. Untuk login Google: aktifkan provider Google, callback
--      https://<domain-kamu>/auth/callback
--   3. Project DEMO saja: lanjutkan dengan supabase/demo/demo-open-access.sql
--      (mematikan RLS - JANGAN PERNAH dijalankan di produksi).
-- ============================================================

begin;

-- ------------------------------------------------------------------
-- 1. Ekstensi & tipe
-- ------------------------------------------------------------------
create extension if not exists "pgcrypto";

do $do$ begin
  create type task_status as enum ('todo', 'ongoing', 'done', 'overtime');
exception when duplicate_object then null; end $do$;

do $do$ begin
  create type app_role as enum ('admin', 'coordinator', 'staff', 'intern', 'viewer');
exception when duplicate_object then null; end $do$;

-- ------------------------------------------------------------------
-- 2. Tabel
--    Urutan mengikuti ketergantungan foreign key: events dulu, lalu sisanya.
--    Blok `alter … add column if not exists` di bawah tiap tabel membuat file
--    ini juga berfungsi sebagai penyusul untuk database lama.
-- ------------------------------------------------------------------

-- 2.1 events (edisi Ormawa Visit) ----------------------------------
create table if not exists events (
  id text primary key,
  code text not null,
  title text not null,
  partner text,
  campus text,
  type text check (type in ('internal', 'external')),
  mode text check (mode in ('offline', 'online')),
  cabinet text,
  event_date date,
  plan_start date,
  plan_end date,
  location text,
  status text check (status in ('planning', 'active', 'done')) default 'planning',
  locked boolean not null default false,
  -- Performance Measurement: angka hasil evaluasi setelah acara, diisi dari
  -- form Ormawa Visit dan ditampilkan di Dashboard. NULL = belum diisi.
  attendance_hmsi int,
  feedback_hmsi_count int,
  feedback_hmsi_rating numeric(3, 2),
  feedback_partner_count int,
  feedback_partner_rating numeric(3, 2),
  report_url text,
  "order" int not null default 0
);
alter table events add column if not exists plan_start date;
alter table events add column if not exists plan_end date;
alter table events add column if not exists locked boolean not null default false;
alter table events add column if not exists attendance_hmsi int;
alter table events add column if not exists feedback_hmsi_count int;
alter table events add column if not exists feedback_hmsi_rating numeric(3, 2);
alter table events add column if not exists feedback_partner_count int;
alter table events add column if not exists feedback_partner_rating numeric(3, 2);
alter table events add column if not exists report_url text;
comment on column events.locked is
  'Arsip terkunci: selain admin, tidak ada peran yang boleh menulis data milik Ormawa Visit ini.';

-- Nilai mustahil ditolak di database, bukan cuma di form: aplikasi bukan
-- satu-satunya yang bisa menulis ke sini.
alter table events drop constraint if exists events_attendance_hmsi_nonneg;
alter table events add constraint events_attendance_hmsi_nonneg
  check (attendance_hmsi is null or attendance_hmsi >= 0);
alter table events drop constraint if exists events_feedback_hmsi_count_nonneg;
alter table events add constraint events_feedback_hmsi_count_nonneg
  check (feedback_hmsi_count is null or feedback_hmsi_count >= 0);
alter table events drop constraint if exists events_feedback_partner_count_nonneg;
alter table events add constraint events_feedback_partner_count_nonneg
  check (feedback_partner_count is null or feedback_partner_count >= 0);
alter table events drop constraint if exists events_feedback_hmsi_rating_range;
alter table events add constraint events_feedback_hmsi_rating_range
  check (feedback_hmsi_rating is null or (feedback_hmsi_rating >= 0 and feedback_hmsi_rating <= 5));
alter table events drop constraint if exists events_feedback_partner_rating_range;
alter table events add constraint events_feedback_partner_rating_range
  check (feedback_partner_rating is null or (feedback_partner_rating >= 0 and feedback_partner_rating <= 5));
alter table events drop constraint if exists events_report_url_http;
alter table events add constraint events_report_url_http
  check (report_url is null or report_url = '' or report_url ~* '^https?://');

-- 2.2 profiles (terhubung ke auth.users) ---------------------------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  email text,
  role app_role not null default 'viewer',
  division text,
  event_id text references events(id) on delete set null,
  avatar_color text,
  created_at timestamptz not null default now()
);
-- Ditinggalkan sejak 0028: peran bersifat global, tidak terikat divisi/edisi.
-- Kolomnya dibiarkan ada (tidak dihapus) supaya migrasi ini non-destruktif.
alter table profiles add column if not exists event_id text references events(id) on delete set null;

-- 2.3 divisions (per Ormawa Visit) ---------------------------------
create table if not exists divisions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  key text not null,
  name text not null,
  short text not null,
  color text not null,
  "order" int not null default 0,
  exclude_from_rundown boolean not null default false,
  constraint divisions_event_key_uniq unique (event_id, key)
);
alter table divisions add column if not exists exclude_from_rundown boolean not null default false;
create index if not exists divisions_event_idx on divisions(event_id);

-- 2.4 members ------------------------------------------------------
-- `divisions` (array) adalah sumber kebenaran; `division` hanya divisi utama
-- (= divisions[1]) yang dipertahankan untuk pembaca lama.
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete set null,
  name text not null,
  nickname text,
  nrp text,
  type text check (type in ('fungsionaris', 'intern')) not null,
  year int,
  division text,
  divisions text[] not null default '{}'
);
alter table members add column if not exists event_id text references events(id) on delete set null;
alter table members add column if not exists divisions text[] not null default '{}';
create index if not exists members_event_idx on members(event_id);
create index if not exists members_divisions_idx on members using gin (divisions);

-- 2.5 tasks (Work Breakdown) ---------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  division text,
  no text,
  pic text default '',
  title text not null,
  start_date date,
  start_raw text default '',
  end_date date,
  end_raw text default '',
  notes text default '',
  result text default '',
  status task_status not null default 'todo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ID warisan dari spreadsheet, dibuang di 0008.
alter table tasks drop column if exists source_id;
-- Sejak 0018 sebuah key divisi boleh berulang antar edisi, jadi tasks.division
-- bukan lagi foreign key - relasinya diselesaikan di aplikasi via (event_id, key).
alter table tasks drop constraint if exists tasks_division_fkey;
alter table members drop constraint if exists members_division_fkey;
create index if not exists tasks_event_idx on tasks(event_id);
create index if not exists tasks_division_idx on tasks(division);
create index if not exists tasks_status_idx on tasks(status);

-- 2.6 links (Super Link) -------------------------------------------
create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete set null,
  section text default '',
  division text default '',
  name text not null,
  url text default '',
  note text default '',
  source text default 'manual'
);
alter table links add column if not exists event_id text references events(id) on delete set null;
create index if not exists links_event_idx on links(event_id);
-- Setiap entri Super Link wajib punya URL sungguhan.
alter table links drop constraint if exists links_url_required;
alter table links add constraint links_url_required check (url ~* '^https?://');

-- 2.7 task_links (tautan hasil tugas) ------------------------------
create table if not exists task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  url text not null,
  label text default '',
  in_super_link boolean not null default false,
  link_id uuid references links(id) on delete set null,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_links_task_idx on task_links(task_id);
create index if not exists task_links_link_idx on task_links(link_id);
create unique index if not exists task_links_link_uniq on task_links(link_id) where link_id is not null;

-- 2.7b task_refs (0037): tautan yang DIPAKAI tugas sebagai rujukan.
-- Arahnya berlawanan dengan task_links di atas: task_links adalah hasil tugas
-- yang diterbitkan ke Super Link (satu baris Super Link milik satu tugas, itu
-- sebabnya ada unique index). task_refs menunjuk ke Super Link, dan SATU baris
-- Super Link boleh dirujuk BANYAK tugas, jadi di sini sengaja TIDAK ada unique
-- index pada link_id. link_id null = tautan diketik manual.
create table if not exists task_refs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  url text not null,
  label text default '',
  link_id uuid references links(id) on delete set null,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_refs_task_idx on task_refs(task_id);
create index if not exists task_refs_link_idx on task_refs(link_id);

-- 2.8 prospects (Reach & Offer) ------------------------------------
create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete set null,
  batch text default '',
  no text,
  date_text text default '',
  month text default '',
  contact text default '',
  org_name text default '',
  campus text default '',
  location text default '',
  mode text,
  pic text default '',
  contact_status text default '',
  their_response text default '',
  our_response text default '',
  done boolean default false,
  is_primary boolean not null default false,
  source text default 'manual'
);
alter table prospects add column if not exists event_id text references events(id) on delete set null;
alter table prospects add column if not exists mode text;
alter table prospects add column if not exists is_primary boolean not null default false;
-- 0036: catatan per prospek. Kolom `link*` di bawahnya WARISAN sejak 0038 -
-- aplikasi tidak lagi membacanya, tautan prospek pindah ke tabel
-- prospect_links (2.8b) karena satu himpunan sering mengirim beberapa berkas.
-- Dibiarkan ada supaya baris lama tetap terbaca.
alter table prospects add column if not exists notes text default '';
alter table prospects add column if not exists link text default '';
alter table prospects add column if not exists link_label text default '';
alter table prospects add column if not exists link_in_super_link boolean not null default false;
alter table prospects add column if not exists link_id uuid references links(id) on delete set null;
create index if not exists prospects_event_idx on prospects(event_id);
-- Paling banyak satu prospek utama per Ormawa Visit.
create unique index if not exists prospects_primary_uniq on prospects(event_id) where is_primary;
-- Satu baris Super Link hanya boleh dimiliki satu prospek (warisan 0036).
create unique index if not exists prospects_link_uniq on prospects(link_id) where link_id is not null;

-- 2.8b prospect_links (0038): tautan milik himpunan yang dihubungi.
-- Bentuknya sama persis dengan task_links: `in_super_link` menerbitkan tautan
-- ke Super Link dan `link_id` mengingat baris mana yang dimilikinya, sehingga
-- menyimpan ulang memperbarui baris itu alih-alih menambah duplikat.
create table if not exists prospect_links (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  url text not null,
  label text default '',
  in_super_link boolean not null default false,
  link_id uuid references links(id) on delete set null,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists prospect_links_prospect_idx on prospect_links(prospect_id);
create index if not exists prospect_links_link_idx on prospect_links(link_id);
create unique index if not exists prospect_links_link_uniq
  on prospect_links(link_id) where link_id is not null;

-- 2.9 budget -------------------------------------------------------
create table if not exists budget_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_id text references events(id) on delete set null
);
create table if not exists budget_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references budget_plans(id) on delete cascade,
  category text default 'LAIN-LAIN',
  no int,
  name text not null,
  qty numeric,
  unit text,
  unit_price numeric,
  total numeric,
  category_color text,
  "order" int default 0
);
alter table budget_items add column if not exists category_color text;
alter table budget_items drop constraint if exists budget_items_category_color_hex;
alter table budget_items add constraint budget_items_category_color_hex
  check (category_color is null or category_color ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$');
create index if not exists budget_items_plan_idx on budget_items(plan_id);

-- 2.10 rundown -----------------------------------------------------
-- job_lo … job_opr adalah kolom warisan: tidak lagi ditulis, tapi masih dibaca
-- saat menyalin rundown ke edisi baru. division_jobs yang dipakai sekarang.
create table if not exists rundown (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  variant text default 'A',
  no int,
  time_start text,
  time_end text,
  duration text,
  activity text,
  keterangan text,
  mc text,
  operator text default '',
  division_jobs jsonb not null default '{}'::jsonb,
  -- Rowspan per kolom, disimpan di baris teratas: {"mc":3} = sel MC membentang
  -- 3 baris. Kunci: 'mc', 'operator', atau key divisi. Lihat lib/rundown-merge.ts.
  merges jsonb not null default '{}'::jsonb,
  host text,
  opr_link text,
  job_lo text,
  job_event text,
  job_consump text,
  job_creative text,
  job_opr text
);
alter table rundown add column if not exists operator text default '';
alter table rundown add column if not exists division_jobs jsonb not null default '{}'::jsonb;
alter table rundown add column if not exists merges jsonb not null default '{}'::jsonb;
alter table rundown drop constraint if exists rundown_merges_object;
alter table rundown add constraint rundown_merges_object
  check (jsonb_typeof(merges) = 'object');

-- 2.11 job_harih (Hari-H) ------------------------------------------
create table if not exists job_harih (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  no text,
  pic text,
  job text,
  notes text
);

-- 2.12 faqs --------------------------------------------------------
create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  "order" int default 0
);

-- 2.13 teams -------------------------------------------------------
-- fungsionaris/intern adalah kolom warisan: tidak pernah ditulis lagi (roster
-- diturunkan dari members.divisions), tapi masih ditampilkan sebagai cadangan
-- selama sebuah divisi belum punya anggota. Jangan dikosongkan.
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  division text,
  coordinator text default '',
  fungsionaris text default '',
  intern text default ''
);
alter table teams add column if not exists coordinator text default '';
alter table teams drop constraint if exists teams_division_fkey;

-- 2.14 backups -----------------------------------------------------
create table if not exists backups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('manual', 'auto', 'pre_restore')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists backups_created_at_idx on backups(created_at desc);

-- 2.15 role_requests -----------------------------------------------
create table if not exists role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Didenormalisasi supaya daftar admin tidak perlu join ke profiles
  -- (yang policy bacanya sengaja sempit).
  name text not null default '',
  email text not null default '',
  requested_role app_role not null,
  division text,
  event_id text references events(id) on delete set null,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'ignored')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  constraint role_requests_requestable check (requested_role in ('coordinator', 'staff', 'intern'))
);
create unique index if not exists role_requests_one_pending
  on role_requests(user_id) where status = 'pending';
create index if not exists role_requests_status_idx on role_requests(status, created_at desc);
comment on column role_requests.event_id is
  'Deprecated sejak 0024: peran bersifat global, tidak pernah dibatasi satu Ormawa Visit.';

-- ------------------------------------------------------------------
-- 3. Fungsi
-- ------------------------------------------------------------------

-- Buat profil otomatis untuk setiap akun baru. Berlaku juga untuk sesi
-- ANONIM (tombol Tamu), yang emailnya NULL - karena itu ada cadangan 'Tamu',
-- sebab profiles.name NOT NULL dan kegagalan di sini membatalkan seluruh
-- proses pendaftaran. Google menaruh nama di `full_name`.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Tamu'
    ),
    new.email,
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end; $fn$;

create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $fn$
  select role from public.profiles where id = auth.uid();
$fn$;

-- Ditinggalkan (peran tidak terikat divisi), dipertahankan supaya objek lain
-- yang mungkin masih menyebutnya tidak patah.
create or replace function auth_division() returns text
language sql stable security definer set search_path = public as $fn$
  select division from public.profiles where id = auth.uid();
$fn$;

-- Apakah sesi ini sesi anonim (Tamu tanpa akun)?
create or replace function is_anon() returns boolean
language sql stable set search_path = public as $fn$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$fn$;

-- Akun sungguhan dengan peran yang boleh menulis. Menolak sesi anonim DAN akun
-- terdaftar yang perannya masih 'viewer' (belum disetujui admin).
-- Fail closed: profil yang tidak ada membuat auth_role() NULL -> false.
create or replace function has_role() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(auth_role()::text in ('admin', 'coordinator', 'staff', 'intern'), false)
     and not is_anon();
$fn$;

-- Boleh menulis baris milik Ormawa Visit ini? Admin selalu boleh, termasuk di
-- arsip terkunci, supaya ia bisa memperbaiki lalu membuka kuncinya.
-- event_id NULL / edisi terhapus dianggap TIDAK terkunci.
create or replace function writable_event(row_event text) returns boolean
language sql stable security definer set search_path = public as $fn$
  select auth_role() = 'admin'
      or not coalesce((select e.locked from public.events e where e.id = row_event), false);
$fn$;

-- Mengubah peran harus lewat fungsi ini: UPDATE pada profiles.role sengaja
-- dicabut dari `authenticated` (lihat bagian 6) karena RLS bersifat per-BARIS,
-- sehingga tanpa itu siapa pun bisa mengangkat dirinya sendiri jadi admin.
create or replace function set_user_role(target uuid, new_role app_role, new_division text default null)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if auth_role() <> 'admin' or is_anon() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'cannot change your own role' using errcode = '42501';
  end if;
  update public.profiles
     set role = new_role,
         division = coalesce(new_division, division)
   where id = target;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
end; $fn$;
revoke all on function set_user_role(uuid, app_role, text) from public, anon;
grant execute on function set_user_role(uuid, app_role, text) to authenticated;

-- Menyetujui / mengabaikan pengajuan peran. Hanya menulis kolom `role`:
-- peran bersifat global, tidak membawa divisi maupun edisi.
create or replace function decide_role_request(request_id uuid, approve boolean)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  req role_requests%rowtype;
begin
  if auth_role() <> 'admin' or is_anon() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into req from role_requests where id = request_id;
  if not found then
    raise exception 'role request not found' using errcode = 'P0002';
  end if;
  if req.status <> 'pending' then
    raise exception 'role request already decided' using errcode = '22023';
  end if;

  if approve then
    update public.profiles set role = req.requested_role where id = req.user_id;
    if not found then
      raise exception 'profile not found' using errcode = 'P0002';
    end if;
  end if;

  update role_requests
     set status     = case when approve then 'approved' else 'ignored' end,
         decided_at = now(),
         decided_by = auth.uid()
   where id = request_id;
end; $fn$;
revoke all on function decide_role_request(uuid, boolean) from public, anon;
grant execute on function decide_role_request(uuid, boolean) to authenticated;

-- Restore backup, dalam SATU transaksi (0043).
--
-- Dulu aplikasi mengirim 16 DELETE lalu 16 INSERT lewat PostgREST, masing-
-- masing transaksinya sendiri, jadi kegagalan di tengah meninggalkan database
-- setengah dipulihkan tanpa jalan kembali. Badan fungsi plpgsql berjalan dalam
-- satu transaksi: gagal di mana pun membatalkan seluruhnya.
--
-- SECURITY INVOKER, bukan definer: RLS tetap berlaku, tidak ada jalur yang
-- melewatinya. Admin tetap bisa menyentuh edisi terkunci semata karena
-- `writable_event()` memang selalu true untuk admin.
drop function if exists restore_snapshot(jsonb);
create or replace function restore_snapshot(payload jsonb)
returns jsonb
language plpgsql security invoker set search_path = public as $fn$
declare
  tbl       text;
  i         int;
  deleted   bigint;
  inserted  bigint;
  cols      text;
  report    jsonb := '{}'::jsonb;
  -- Urutan HAPUS: anak dulu. INSERT menyusuri terbalik. Kembar dengan
  -- DELETE_ORDER di src/lib/backup.ts.
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

  -- Ribuan baris hapus dan tulis: mencatat tiap barisnya akan mengubur riwayat
  -- asli. Jejaknya tetap ada lewat baris pre_restore di tabel backups.
  perform set_config('app.audit', 'off', true);

  foreach tbl in array del_order loop
    execute format('delete from public.%I', tbl);
    get diagnostics deleted = row_count;
    report := jsonb_set(report, array[tbl],
      jsonb_build_object('deleted', deleted, 'inserted', 0), true);
  end loop;

  for i in reverse array_length(del_order, 1) .. 1 loop
    tbl := del_order[i];
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
revoke all on function restore_snapshot(jsonb) from public, anon;
grant execute on function restore_snapshot(jsonb) to authenticated;

-- Urutan baris: satu perintah untuk menyeret, sequence untuk nomor baru (0044).
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

-- Penomoran otomatis. Advisory lock membuat dua insert bersamaan dalam lingkup
-- yang sama tidak bisa menghasilkan nomor kembar.
create or replace function assign_task_no() returns trigger
language plpgsql as $fn$
declare next_no int;
begin
  if NEW.no is null or NEW.no = '' then
    perform pg_advisory_xact_lock(hashtext(coalesce(NEW.event_id, '') || '|' || coalesce(NEW.division, '')));
    select coalesce(max(no::int), 0) + 1 into next_no
      from tasks
      where event_id = NEW.event_id and division = NEW.division and no ~ '^\d+$';
    NEW.no := next_no::text;
  end if;
  return NEW;
end; $fn$;

create or replace function assign_job_no() returns trigger
language plpgsql as $fn$
declare next_no int;
begin
  if NEW.no is null or NEW.no = '' then
    perform pg_advisory_xact_lock(hashtext('job|' || coalesce(NEW.event_id, '')));
    select coalesce(max(no::int), 0) + 1 into next_no
      from job_harih
      where event_id = NEW.event_id and no ~ '^\d+$';
    NEW.no := next_no::text;
  end if;
  return NEW;
end; $fn$;

create or replace function set_updated_at() returns trigger
language plpgsql as $fn$
begin new.updated_at = now(); return new; end; $fn$;

-- ------------------------------------------------------------------
-- 4. Trigger
-- ------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

drop trigger if exists trg_assign_task_no on tasks;
create trigger trg_assign_task_no before insert on tasks
  for each row execute function assign_task_no();

drop trigger if exists trg_assign_job_no on job_harih;
create trigger trg_assign_job_no before insert on job_harih
  for each row execute function assign_job_no();

-- ------------------------------------------------------------------
-- 5. Row Level Security
--
-- PENTING: kunci anon key BERSIFAT PUBLIK dan token sesi ada di browser
-- pengguna, jadi penyerang tidak perlu lewat aplikasi - ia memanggil PostgREST
-- langsung. Artinya RLS adalah SATU-SATUNYA batas keamanan yang nyata;
-- pemeriksaan `can.*` di src/lib/permissions.ts hanya untuk pengalaman
-- pengguna. Setiap tabel baru WAJIB datang bersama policy-nya di sini.
--
-- Aturan tulis mengikuti MODULE_ACCESS_LEVEL di src/lib/constants.ts, dan
-- HANYA berdasarkan PERAN - tidak ada penyaringan per divisi maupun per edisi
-- (lihat 0028: asumsi itu membuat semua penyimpanan gagal diam-diam).
-- ------------------------------------------------------------------

do $do$
declare t text;
begin
  foreach t in array array['profiles', 'divisions', 'events', 'members', 'tasks', 'task_links', 'task_refs',
                           'prospects', 'prospect_links', 'links', 'budget_plans', 'budget_items', 'rundown',
                           'job_harih', 'faqs', 'teams', 'backups', 'role_requests']
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $do$;

-- 5.1 Baca ---------------------------------------------------------
-- Tabel operasional: setiap sesi masuk, termasuk Tamu anonim.
-- members & teams SENGAJA TIDAK di sini - roster memuat nama + NRP (PII), lihat
-- blok berikutnya.
do $do$
declare t text;
begin
  foreach t in array array['divisions', 'events', 'tasks', 'task_links', 'task_refs',
                           'prospects', 'prospect_links', 'rundown', 'job_harih', 'faqs']
  loop
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('drop policy if exists "read_public" on %I;', t);
    execute format('drop policy if exists "read_auth" on %I;', t);
    execute format('drop policy if exists "%s_read" on %I;', t, t);
    execute format('create policy "read_auth" on %I for select using (auth.uid() is not null);', t);
  end loop;
end $do$;

-- Roster (members, teams): hanya akun BERPERAN yang boleh membacanya. Nama dan
-- NRP mahasiswa adalah data pribadi, jadi Tamu - baik sesi anonim maupun akun
-- terdaftar yang perannya masih 'viewer' - tidak boleh menariknya (has_role()
-- menolak keduanya). Kolom teams.coordinator/fungsionaris/intern juga nama, jadi
-- teams ikut ditutup, bukan cuma members.
do $do$
declare t text;
begin
  foreach t in array array['members', 'teams']
  loop
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('drop policy if exists "read_public" on %I;', t);
    execute format('drop policy if exists "read_auth" on %I;', t);
    execute format('drop policy if exists "%s_read" on %I;', t, t);
    execute format('create policy "read_auth" on %I for select to authenticated using (has_role());', t);
  end loop;
end $do$;

-- Anggaran & Super Link: matriks menyebut Tamu TIDAK punya akses. Itu berarti
-- dua-duanya: Tamu anonim DAN akun terdaftar yang perannya masih 'viewer'.
do $do$
declare t text;
begin
  foreach t in array array['budget_plans', 'budget_items', 'links']
  loop
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('drop policy if exists "read_public" on %I;', t);
    execute format('drop policy if exists "read_auth" on %I;', t);
    execute format('create policy "read_auth" on %I for select to authenticated using (has_role());', t);
  end loop;
end $do$;

-- profiles: profil sendiri selalu; profil orang lain hanya untuk akun non-anonim
-- (mencegah Tamu tanpa kredensial memanen seluruh nama & email).
drop policy if exists "profiles_read" on profiles;
create policy "profiles_read" on profiles for select to authenticated
  using (id = auth.uid() or (auth.uid() is not null and not is_anon()));

drop policy if exists "backups_admin_all" on backups;
create policy "backups_admin_all" on backups for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

drop policy if exists "role_requests_read" on role_requests;
create policy "role_requests_read" on role_requests for select to authenticated
  using (user_id = auth.uid() or auth_role() = 'admin');

-- 5.2 Tulis: modul "limited" ---------------------------------------
-- Admin, Koordinator, Staff, Intern boleh membuat & mengubah; hanya Admin dan
-- Koordinator boleh menghapus. Semuanya tunduk pada kunci arsip.
do $do$
declare t text;
begin
  foreach t in array array['tasks', 'rundown', 'job_harih', 'links']
  loop
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format('drop policy if exists "%s_admin_write" on %I;', t, t);
    execute format('drop policy if exists "%s_insert" on %I;', t, t);
    execute format('drop policy if exists "%s_update" on %I;', t, t);
    execute format('drop policy if exists "%s_delete" on %I;', t, t);

    execute format($p$create policy "%s_insert" on %I for insert to authenticated
      with check (has_role() and writable_event(event_id));$p$, t, t);

    -- WITH CHECK wajib: USING menentukan baris mana yang boleh disasar,
    -- WITH CHECK menentukan bentuk baris SESUDAHNYA. Tanpa itu sebuah baris
    -- bisa dipindahkan ke Ormawa Visit terkunci dalam satu perintah.
    execute format($p$create policy "%s_update" on %I for update to authenticated
      using (has_role() and writable_event(event_id))
      with check (has_role() and writable_event(event_id));$p$, t, t);

    execute format($p$create policy "%s_delete" on %I for delete to authenticated
      using (auth_role()::text in ('admin', 'coordinator') and not is_anon()
             and writable_event(event_id));$p$, t, t);
  end loop;
end $do$;

-- task_links ikut tugas induknya (tabel ini tidak punya event_id sendiri).
drop policy if exists "task_links_write" on task_links;
drop policy if exists "task_links_insert" on task_links;
drop policy if exists "task_links_update" on task_links;
drop policy if exists "task_links_delete" on task_links;
create policy "task_links_insert" on task_links for insert to authenticated
  with check (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_links.task_id)));
create policy "task_links_update" on task_links for update to authenticated
  using (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_links.task_id)))
  with check (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_links.task_id)));
create policy "task_links_delete" on task_links for delete to authenticated
  using (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_links.task_id)));

-- task_refs (0037) ikut tugas induknya juga, aturannya sama persis.
drop policy if exists "task_refs_write" on task_refs;
drop policy if exists "task_refs_insert" on task_refs;
drop policy if exists "task_refs_update" on task_refs;
drop policy if exists "task_refs_delete" on task_refs;
create policy "task_refs_insert" on task_refs for insert to authenticated
  with check (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_refs.task_id)));
create policy "task_refs_update" on task_refs for update to authenticated
  using (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_refs.task_id)))
  with check (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_refs.task_id)));
create policy "task_refs_delete" on task_refs for delete to authenticated
  using (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_refs.task_id)));

-- prospect_links (0038) ikut prospek induknya, aturannya sama persis.
drop policy if exists "prospect_links_write" on prospect_links;
drop policy if exists "prospect_links_insert" on prospect_links;
drop policy if exists "prospect_links_update" on prospect_links;
drop policy if exists "prospect_links_delete" on prospect_links;
create policy "prospect_links_insert" on prospect_links for insert to authenticated
  with check (has_role()
    and writable_event((select p.event_id from prospects p where p.id = prospect_links.prospect_id)));
create policy "prospect_links_update" on prospect_links for update to authenticated
  using (has_role()
    and writable_event((select p.event_id from prospects p where p.id = prospect_links.prospect_id)))
  with check (has_role()
    and writable_event((select p.event_id from prospects p where p.id = prospect_links.prospect_id)));
create policy "prospect_links_delete" on prospect_links for delete to authenticated
  using (has_role()
    and writable_event((select p.event_id from prospects p where p.id = prospect_links.prospect_id)));

-- 5.3 Tulis: modul "admin saja" ------------------------------------
do $do$
declare t text;
begin
  foreach t in array array['divisions', 'events', 'members', 'teams', 'prospects',
                           'budget_plans', 'budget_items', 'faqs']
  loop
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format('drop policy if exists "%s_admin_write" on %I;', t, t);
    execute format('drop policy if exists "%s_insert" on %I;', t, t);
    execute format('drop policy if exists "%s_update" on %I;', t, t);
    execute format('drop policy if exists "%s_delete" on %I;', t, t);
    execute format($p$create policy "%s_write" on %I for all to authenticated
      using (auth_role() = 'admin' and not is_anon())
      with check (auth_role() = 'admin' and not is_anon());$p$, t, t);
  end loop;
end $do$;

-- 5.4 profiles: tidak boleh mengangkat diri sendiri ----------------
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles for update to authenticated
  using (id = auth.uid() and not is_anon())
  with check (
    id = auth.uid()
    and role     is not distinct from (select p.role     from profiles p where p.id = auth.uid())
    and division is not distinct from (select p.division from profiles p where p.id = auth.uid())
  );

-- 5.5 role_requests ------------------------------------------------
drop policy if exists "role_requests_insert" on role_requests;
create policy "role_requests_insert" on role_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and not is_anon());

drop policy if exists "role_requests_update_own_pending" on role_requests;
create policy "role_requests_update_own_pending" on role_requests for update to authenticated
  using (user_id = auth.uid() and status = 'pending' and not is_anon())
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "role_requests_admin_write" on role_requests;
create policy "role_requests_admin_write" on role_requests for delete to authenticated
  using (auth_role() = 'admin');

-- 5.6 Sesi anonim = baca saja, di mana pun ------------------------
-- RESTRICTIVE: di-AND-kan dengan policy lain, jadi tidak bisa dilonggarkan
-- dengan menambah policy permissive baru di kemudian hari. Dipecah per perintah
-- karena policy restrictive FOR ALL akan menerapkan USING pada SELECT (memutus
-- baca Tamu) sementara DELETE mengabaikan WITH CHECK.
do $do$
declare t text;
begin
  foreach t in array array['divisions', 'events', 'members', 'tasks', 'task_links', 'prospects',
                           'links', 'budget_plans', 'budget_items', 'rundown', 'job_harih',
                           'faqs', 'teams', 'backups', 'profiles', 'role_requests']
  loop
    execute format('drop policy if exists "%s_no_anon_write" on %I;', t, t);
    execute format('drop policy if exists "%s_no_anon_insert" on %I;', t, t);
    execute format('drop policy if exists "%s_no_anon_update" on %I;', t, t);
    execute format('drop policy if exists "%s_no_anon_delete" on %I;', t, t);
    execute format($p$create policy "%s_no_anon_insert" on %I as restrictive
      for insert to authenticated with check (not is_anon());$p$, t, t);
    execute format($p$create policy "%s_no_anon_update" on %I as restrictive
      for update to authenticated using (not is_anon()) with check (not is_anon());$p$, t, t);
    execute format($p$create policy "%s_no_anon_delete" on %I as restrictive
      for delete to authenticated using (not is_anon());$p$, t, t);
  end loop;
end $do$;

-- ------------------------------------------------------------------
-- 6. Hak kolom
--    RLS tidak bisa menyatakan "semua kolom KECUALI yang ini" - itu urusan
--    GRANT. Inilah perbaikan sesungguhnya untuk celah angkat-diri-jadi-admin.
-- ------------------------------------------------------------------
revoke update on public.profiles from authenticated, anon;
grant update (name, avatar_color) on public.profiles to authenticated;

-- tasks: pembatasan kolom dari 0020/0026 dicabut. Batasan itu dulu menahan
-- Staff/Intern pada kolom status+hasil saja; matriks sekarang memberi mereka
-- "limited" (buat & ubah penuh, tanpa hapus).
grant update on public.tasks to authenticated;

-- ------------------------------------------------------------------
-- 6b. Perkakas developer (0039)
--
--    Peran Developer BUKAN nilai enum app_role: menambahkannya ke enum akan
--    memunculkannya di matriks hak akses, di pengajuan peran, dan di Panduan.
--    Ia hidup sebagai lapisan email di atas peran biasa, dan satu-satunya
--    yang didapat adalah menu /developer yang tidak terdaftar di mana pun.
--
--    Jejak audit ditegakkan lewat TRIGGER, bukan lewat Server Action: kunci
--    anon itu publik, jadi PostgREST bisa dipanggil langsung tanpa melewati
--    aplikasi. Instrumentasi di sisi aplikasi hanya mencatat yang sopan.
--
--    Emailnya tidak ada di file ini dengan sengaja (repo ini publik).
--    Daftarkan lewat supabase/developers.local.sql.
-- ------------------------------------------------------------------
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
-- 6c. Menu Himpunan + perbaikan kehadiran + penghitung akses (0040)
-- ------------------------------------------------------------------
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

-- ------------------------------------------------------------------
-- 6d. Compare: subjek perbandingan eksplisit (0041)
-- ------------------------------------------------------------------
create table if not exists compare_subjects (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  -- ON DELETE SET NULL, bukan cascade: menghapus prospek tidak boleh ikut
  -- membuang penilaian yang sudah susah payah ditulis. `org_name` yang tetap
  -- membuatnya terbaca, alasan yang sama dengan `label` di activity_log.
  prospect_id uuid references prospects(id) on delete set null,
  org_name text not null default '',
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists compare_subjects_event_idx on compare_subjects(event_id);

-- "Tidak bisa duplikat kalau perbandingannya sudah dibuat", ditegakkan di
-- database dan bukan cuma dengan menyembunyikan tombolnya. Dua index karena
-- ada dua cara sebuah subjek dikenali: lewat prospeknya, atau lewat namanya
-- (subjek hasil impor tidak punya prospek).
create unique index if not exists compare_subjects_prospect_uniq
  on compare_subjects(event_id, prospect_id) where prospect_id is not null;
create unique index if not exists compare_subjects_name_uniq
  on compare_subjects(event_id, lower(btrim(org_name))) where btrim(org_name) <> '';

alter table compare_entries add column if not exists subject_id uuid
  references compare_subjects(id) on delete cascade;
-- Judul kelompok, mis. "A. ASPEK PELAKSANAAN KEGIATAN BENCHMARKING". Kosong
-- untuk penilaian yang tidak dikelompokkan.
alter table compare_entries add column if not exists section text default '';
-- Nomor urut sebagaimana tertulis di sumbernya, supaya penomoran manual yang
-- melompat (mis. 11 lalu 13) tetap apa adanya alih-alih dirapikan diam-diam.
alter table compare_entries add column if not exists no text default '';
create index if not exists compare_entries_subject_idx on compare_entries(subject_id);

-- Backfill: tiap (edisi, nama himpunan) yang sudah punya penilaian menjadi
-- satu subjek, lalu penilaiannya diarahkan ke sana. Idempoten.
insert into compare_subjects (event_id, prospect_id, org_name, "order")
select e.event_id,
       (array_agg(e.prospect_id) filter (where e.prospect_id is not null))[1],
       coalesce(nullif(btrim(e.org_name), ''), '(tanpa nama)'),
       row_number() over (partition by e.event_id order by min(e."order"))
  from compare_entries e
 where e.subject_id is null
 group by e.event_id, coalesce(nullif(btrim(e.org_name), ''), '(tanpa nama)')
on conflict do nothing;

update compare_entries e
   set subject_id = s.id
  from compare_subjects s
 where e.subject_id is null
   and s.event_id = e.event_id
   and lower(btrim(s.org_name)) = lower(coalesce(nullif(btrim(e.org_name), ''), '(tanpa nama)'));

alter table compare_subjects enable row level security;

drop policy if exists compare_subjects_read on compare_subjects;
create policy compare_subjects_read on compare_subjects for select
  using (auth.uid() is not null);

-- Tulis: sama persis dengan compare_entries (menu Himpunan = full untuk admin,
-- koordinator, staff). `writable_event()` yang menegakkan kunci arsip.
drop policy if exists compare_subjects_insert on compare_subjects;
drop policy if exists compare_subjects_update on compare_subjects;
drop policy if exists compare_subjects_delete on compare_subjects;
create policy compare_subjects_insert on compare_subjects for insert to authenticated
  with check (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
              and writable_event(event_id));
create policy compare_subjects_update on compare_subjects for update to authenticated
  using (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
         and writable_event(event_id))
  with check (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
              and writable_event(event_id));
create policy compare_subjects_delete on compare_subjects for delete to authenticated
  using (auth_role()::text in ('admin','coordinator','staff') and not is_anon()
         and writable_event(event_id));

drop trigger if exists audit_compare_subjects on compare_subjects;
create trigger audit_compare_subjects after insert or update or delete on compare_subjects
  for each row execute function audit_row();



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

commit;

-- ------------------------------------------------------------------
-- 7. Verifikasi - semuanya harus mengembalikan `true`.
-- ------------------------------------------------------------------
select
  (select count(*) from pg_tables where schemaname = 'public') >= 16            as tabel_lengkap,
  (select bool_and(rowsecurity) from pg_tables where schemaname = 'public')     as rls_aktif_semua,
  (select count(*) from pg_policies where schemaname = 'public') >= 70          as policy_terpasang,
  (select count(*) from pg_policies where schemaname = 'public'
     and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'owns_scope') = 0   as tanpa_scoping_lama,
  (select has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')) = false
                                                                                as profiles_role_terkunci;
