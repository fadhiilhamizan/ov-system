-- ============================================================
-- Ormawa Visit Management System — SETUP LENGKAP (satu file)
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
--   * Migrasi data sekali-jalan — 0004 (isi FAQ), 0007 (perbaikan URL Super
--     Link), 0013 (hapus RAB HMD), 0019 (roster asli HMSI). Semuanya sudah
--     dijalankan di produksi; mengulangnya akan menimpa data yang sekarang.
--   * Backfill sekali-jalan (0005/0012/0014/0018/0027) — hanya relevan untuk
--     database yang isinya masih berformat lama. Kalau kamu memang menyiapkan
--     project baru dari nol, jalankan `supabase/seed.sql` setelah file ini.
--   * 0006 (bucket Storage) — fiturnya sudah dicabut, bucketnya tidak dipakai.
--
-- SETELAH menjalankan file ini:
--   1. Supabase → Authentication → Providers → aktifkan "Anonymous sign-ins"
--      (dipakai tombol "Masuk sebagai Tamu").
--   2. Untuk login Google: aktifkan provider Google, callback
--      https://<domain-kamu>/auth/callback
--   3. Project DEMO saja: lanjutkan dengan supabase/demo/demo-open-access.sql
--      (mematikan RLS — JANGAN PERNAH dijalankan di produksi).
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
-- bukan lagi foreign key — relasinya diselesaikan di aplikasi via (event_id, key).
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
create index if not exists prospects_event_idx on prospects(event_id);
-- Paling banyak satu prospek utama per Ormawa Visit.
create unique index if not exists prospects_primary_uniq on prospects(event_id) where is_primary;

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
-- ANONIM (tombol Tamu), yang emailnya NULL — karena itu ada cadangan 'Tamu',
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
-- pengguna, jadi penyerang tidak perlu lewat aplikasi — ia memanggil PostgREST
-- langsung. Artinya RLS adalah SATU-SATUNYA batas keamanan yang nyata;
-- pemeriksaan `can.*` di src/lib/permissions.ts hanya untuk pengalaman
-- pengguna. Setiap tabel baru WAJIB datang bersama policy-nya di sini.
--
-- Aturan tulis mengikuti MODULE_ACCESS_LEVEL di src/lib/constants.ts, dan
-- HANYA berdasarkan PERAN — tidak ada penyaringan per divisi maupun per edisi
-- (lihat 0028: asumsi itu membuat semua penyimpanan gagal diam-diam).
-- ------------------------------------------------------------------

do $do$
declare t text;
begin
  foreach t in array array['profiles', 'divisions', 'events', 'members', 'tasks', 'task_links',
                           'prospects', 'links', 'budget_plans', 'budget_items', 'rundown',
                           'job_harih', 'faqs', 'teams', 'backups', 'role_requests']
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $do$;

-- 5.1 Baca ---------------------------------------------------------
-- Tabel operasional: setiap sesi masuk, termasuk Tamu anonim.
-- members & teams SENGAJA TIDAK di sini — roster memuat nama + NRP (PII), lihat
-- blok berikutnya.
do $do$
declare t text;
begin
  foreach t in array array['divisions', 'events', 'tasks', 'task_links',
                           'prospects', 'rundown', 'job_harih', 'faqs']
  loop
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('drop policy if exists "read_public" on %I;', t);
    execute format('drop policy if exists "read_auth" on %I;', t);
    execute format('drop policy if exists "%s_read" on %I;', t, t);
    execute format('create policy "read_auth" on %I for select using (auth.uid() is not null);', t);
  end loop;
end $do$;

-- Roster (members, teams): hanya akun BERPERAN yang boleh membacanya. Nama dan
-- NRP mahasiswa adalah data pribadi, jadi Tamu — baik sesi anonim maupun akun
-- terdaftar yang perannya masih 'viewer' — tidak boleh menariknya (has_role()
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
--    RLS tidak bisa menyatakan "semua kolom KECUALI yang ini" — itu urusan
--    GRANT. Inilah perbaikan sesungguhnya untuk celah angkat-diri-jadi-admin.
-- ------------------------------------------------------------------
revoke update on public.profiles from authenticated, anon;
grant update (name, avatar_color) on public.profiles to authenticated;

-- tasks: pembatasan kolom dari 0020/0026 dicabut. Batasan itu dulu menahan
-- Staff/Intern pada kolom status+hasil saja; matriks sekarang memberi mereka
-- "limited" (buat & ubah penuh, tanpa hapus).
grant update on public.tasks to authenticated;

commit;

-- ------------------------------------------------------------------
-- 7. Verifikasi — semuanya harus mengembalikan `true`.
-- ------------------------------------------------------------------
select
  (select count(*) from pg_tables where schemaname = 'public') >= 16            as tabel_lengkap,
  (select bool_and(rowsecurity) from pg_tables where schemaname = 'public')     as rls_aktif_semua,
  (select count(*) from pg_policies where schemaname = 'public') >= 70          as policy_terpasang,
  (select count(*) from pg_policies where schemaname = 'public'
     and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'owns_scope') = 0   as tanpa_scoping_lama,
  (select has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')) = false
                                                                                as profiles_role_terkunci;
