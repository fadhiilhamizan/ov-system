-- ============================================================
-- Ormawa Visit Command Center — Schema
-- HMSI ITS External Affairs
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type task_status as enum ('todo','ongoing','done','overtime');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_role as enum ('admin','coordinator','staff','intern','viewer');
exception when duplicate_object then null; end $$;

-- ---------- profiles (linked to auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  email text,
  role app_role not null default 'viewer',
  division text,
  avatar_color text,
  created_at timestamptz not null default now()
);

-- ---------- divisions ----------
create table if not exists divisions (
  key text primary key,
  name text not null,
  short text not null,
  color text not null,
  "order" int not null default 0
);

-- ---------- events (OV editions) ----------
create table if not exists events (
  id text primary key,
  code text not null,
  title text not null,
  partner text,
  campus text,
  type text check (type in ('internal','external')),
  mode text check (mode in ('offline','online')),
  cabinet text,
  event_date date,
  location text,
  status text check (status in ('planning','active','done')) default 'planning',
  "order" int not null default 0
);

-- ---------- members ----------
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text,
  nrp text,
  type text check (type in ('fungsionaris','intern')) not null,
  year int,
  division text references divisions(key)
);

-- ---------- tasks (WBS) ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  division text references divisions(key),
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
create index if not exists tasks_event_idx on tasks(event_id);
create index if not exists tasks_division_idx on tasks(division);
create index if not exists tasks_status_idx on tasks(status);

-- ---------- prospects ----------
create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  batch text default '',
  no text,
  date_text text default '',
  month text default '',
  contact text default '',
  org_name text default '',
  campus text default '',
  location text default '',
  pic text default '',
  contact_status text default '',
  their_response text default '',
  our_response text default '',
  done boolean default false,
  source text default 'manual'
);

-- ---------- links ----------
create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  section text default '',
  division text default '',
  name text not null,
  url text default '',
  note text default '',
  source text default 'manual'
);

-- ---------- budget ----------
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
  "order" int default 0
);
create index if not exists budget_items_plan_idx on budget_items(plan_id);

-- ---------- rundown ----------
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
  host text,
  opr_link text,
  mc text,
  job_lo text,
  job_event text,
  job_consump text,
  job_creative text,
  job_opr text
);

-- ---------- job hari-h ----------
create table if not exists job_harih (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  no text,
  pic text,
  job text,
  notes text
);

-- ---------- faqs ----------
create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  "order" int default 0
);

-- ---------- teams ----------
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  division text references divisions(key),
  fungsionaris text default '',
  intern text default ''
);

-- ---------- updated_at trigger for tasks ----------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();
