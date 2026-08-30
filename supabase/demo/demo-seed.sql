-- ============================================================
-- MOCKUP SEED for the SEPARATE demo Supabase project.
-- Run this ONLY on the demo project (never on production), AFTER the schema
-- migrations and demo-open-access.sql.
--
-- Which migrations the demo needs: 0001-0018 and 0027, but NOT 0019 (it wipes
-- the roster and inserts HMSI's real people - production only). 0027 adds the
-- teams.coordinator column that 0019 would otherwise have provided. Columns
-- from 0029/0031 are added by the "Part 0" catch-up below, so the demo never
-- needs to run those migrations by hand.
--
-- RE-RUNNABLE: this script first deletes the demo edition's rows, so running it
-- again restores the sample data instead of duplicating it.
-- All data here is fictional/example data - safe to modify freely.
-- ============================================================
begin;

-- ------------------------------------------------------------------
-- Part 0: schema catch-up. The demo project is at migrations 0001-0018 + 0027
-- and never runs 0028+, but the APP has kept adding columns since (perf
-- measurement in 0029, rundown.merges in 0031, prospect link/notes in 0036, task_refs in 0037, prospect_links in 0038, menu Himpunan in 0040-0041). Without them the demo's own
-- Ormawa Visit form and rundown merge fail with "Could not find the '…' column".
-- These add-column statements are idempotent no-ops on a caught-up schema, so
-- re-running demo-seed silently heals an out-of-date demo project.
-- ------------------------------------------------------------------
alter table events add column if not exists attendance_hmsi int;
alter table events add column if not exists feedback_hmsi_count int;
alter table events add column if not exists feedback_hmsi_rating numeric(3, 2);
alter table events add column if not exists feedback_partner_count int;
alter table events add column if not exists feedback_partner_rating numeric(3, 2);
alter table events add column if not exists report_url text;
alter table rundown add column if not exists merges jsonb not null default '{}'::jsonb;
-- 0036: Reach & Offer link + notes.
alter table prospects add column if not exists link text default '';
alter table prospects add column if not exists link_label text default '';
alter table prospects add column if not exists notes text default '';
alter table prospects add column if not exists link_in_super_link boolean not null default false;
alter table prospects add column if not exists link_id uuid references links(id) on delete set null;
-- 0037: tabel referensi tugas (tidak ada sama sekali di project demo lama).
create table if not exists task_refs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  url text not null,
  label text default '',
  link_id uuid references links(id) on delete set null,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
-- 0038: banyak tautan per prospek, juga belum pernah ada di project demo.
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
-- 0040 (menu Himpunan) + 0041 (subjek Compare): tabel-tabel ini tidak pernah
-- ada di project demo lama. Dibuat tanpa RLS di sini karena demo memang berjalan
-- dengan RLS dimatikan (demo-open-access.sql).
create table if not exists fgd_plans (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  title text default '',
  partner_name text default '',
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists fgd_rows (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references fgd_plans(id) on delete cascade,
  ours text default '',
  theirs text default '',
  "order" int not null default 0
);
create table if not exists compare_subjects (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete set null,
  org_name text not null default '',
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists compare_entries (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  subject_id uuid references compare_subjects(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  org_name text default '',
  section text default '',
  "no" text default '',
  aspect text default '',
  indicator text default '',
  plus text default '',
  minus text default '',
  "order" int not null default 0
);
-- If compare_entries predates 0041 in the demo, add the newer columns. Wrapped
-- in a DO block (not bare ALTERs) so it only runs when the table is already
-- there, and so the demo catch-up self-test does not try it in isolation.
do $ce$ begin
  if to_regclass('public.compare_entries') is not null then
    alter table compare_entries add column if not exists subject_id uuid references compare_subjects(id) on delete cascade;
    alter table compare_entries add column if not exists section text default '';
    alter table compare_entries add column if not exists "no" text default '';
  end if;
end $ce$;

-- 0044: mengurutkan ulang lewat satu perintah, dan sequence untuk nomor urut.
-- Wajib ada di sini: FAQ, Hari-H dan RAB semuanya bisa dibuka dan diseret di
-- mode demo, jadi tanpa fungsi ini menyeret satu baris gagal dengan
-- "Could not find the function public.reorder_rows".
create or replace function reorder_rows(kind text, ids uuid[])
returns integer
language plpgsql security invoker set search_path = public as $rr$
declare touched integer := 0;
begin
  if ids is null or array_length(ids, 1) is null then return 0; end if;
  if kind = 'budget_items' then
    update budget_items b set "order" = i.pos - 1
      from unnest(ids) with ordinality as i(id, pos) where b.id = i.id;
  elsif kind = 'faqs' then
    update faqs f set "order" = i.pos
      from unnest(ids) with ordinality as i(id, pos) where f.id = i.id;
  elsif kind = 'job_harih' then
    update job_harih j set no = i.pos::text
      from unnest(ids) with ordinality as i(id, pos) where j.id = i.id;
  else
    raise exception 'unknown reorder kind: %', kind using errcode = '22023';
  end if;
  get diagnostics touched = row_count;
  return touched;
end; $rr$;
grant execute on function reorder_rows(text, uuid[]) to authenticated, anon;

-- 0045: membuat tabel plotting FGD dalam satu transaksi. Menu Himpunan hidup di
-- mode demo (tabelnya dibuat di atas), jadi tanpa fungsi ini tombol "Tambah
-- tabel" gagal dengan "Could not find the function public.create_fgd_plan".
create or replace function create_fgd_plan(
  p_event_id text, p_title text default '', p_partner text default '',
  p_rows text[] default '{}'
) returns uuid
language plpgsql security invoker set search_path = public as $cfp$
declare new_id uuid; next_order int;
begin
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
end; $cfp$;
grant execute on function create_fgd_plan(text, text, text, text[]) to authenticated, anon;

-- The create paths stopped sending "order" once it came from a sequence, so the
-- demo needs the same defaults or new rows all land on 0.
do $seq$
declare t text; seq text; hi bigint;
begin
  foreach t in array array['faqs', 'events', 'divisions', 'budget_items']
  loop
    seq := t || '_order_seq';
    execute format('create sequence if not exists %I', seq);
    execute format('alter table %I alter column "order" set default nextval(%L)', t, seq);
    execute format('select coalesce(max("order"), 0) from %I', t) into hi;
    execute format('select setval(%L, greatest(%s, (select last_value from %I)) + 1, false)', seq, hi, seq);
    execute format('grant usage, select on sequence %I to authenticated, anon', seq);
  end loop;
end $seq$;

-- Clear this edition's data first (FK-safe order) so the seed is idempotent.
-- task_links is guarded: it only exists once migration 0025 has been applied.
-- NOTE: the body below is dollar-quoted, and dollar-quoting is LEXICAL - a
-- doubled-dollar sequence ends it even inside what looks like a comment. So
-- keep every explanation out here, and dollar-quote the inner statement with a
-- distinct tag because it contains its own single quotes.
do $do$ begin
  if to_regclass('public.task_links') is not null then
    execute $sql$delete from public.task_links where task_id in (select id from public.tasks where event_id = 'demo-ov')$sql$;
  end if;
end $do$;
delete from teams where event_id = 'demo-ov';
delete from job_harih where event_id = 'demo-ov';
delete from rundown where event_id = 'demo-ov';
delete from budget_items where plan_id in (select id from budget_plans where event_id = 'demo-ov');
delete from budget_plans where event_id = 'demo-ov';
delete from links where event_id = 'demo-ov';
delete from compare_entries where event_id = 'demo-ov';
delete from compare_subjects where event_id = 'demo-ov';
delete from fgd_rows where plan_id in (select id from fgd_plans where event_id = 'demo-ov');
delete from fgd_plans where event_id = 'demo-ov';
delete from prospect_links where prospect_id in (select id from prospects where event_id = 'demo-ov');
delete from prospects where event_id = 'demo-ov';
delete from tasks where event_id = 'demo-ov';
delete from members where event_id = 'demo-ov';
delete from divisions where event_id = 'demo-ov';

-- demo edition (active = the landing edition) - created first so divisions can
-- reference it (divisions are per-event since migration 0018).
insert into events(id,code,title,partner,campus,type,mode,cabinet,event_date,plan_start,plan_end,location,status,"order")
values ('demo-ov','DEMO','Ormawa Visit Demo','Himpunan Demo','Universitas Contoh','external','offline','Sandbox','2026-09-20','2026-08-01','2026-09-19','Ruang Demo, Gedung Contoh','active',1)
on conflict (id) do nothing;

-- divisions (scoped to the demo edition)
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','PIC','PIC Ormawa Visit','PIC','#6366f1',1,true) on conflict (event_id,key) do nothing;
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','COORDINATOR','Coordinator','CORD','#8b5cf6',2,true) on conflict (event_id,key) do nothing;
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','SECRETARY','Secretary','SEC','#ec4899',3,true) on conflict (event_id,key) do nothing;
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','TREASURER','Treasurer','TRE','#f59e0b',4,true) on conflict (event_id,key) do nothing;
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','LO','Liaison Officer','LO','#0ea5e9',5,false) on conflict (event_id,key) do nothing;
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','EVENT','Event','EVE','#10b981',6,false) on conflict (event_id,key) do nothing;
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','CONSUMPTION','Consumption','CON','#f97316',7,false) on conflict (event_id,key) do nothing;
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','OPERATIONAL','Operational','OPR','#64748b',8,false) on conflict (event_id,key) do nothing;
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','CREATIVE','Creative','CRE','#d946ef',9,false) on conflict (event_id,key) do nothing;
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','MARKETING','Marketing','MRT','#f43f5e',10,false) on conflict (event_id,key) do nothing;
insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values ('demo-ov','OUTSOURCE','Outsource','OUT','#14b8a6',11,false) on conflict (event_id,key) do nothing;

-- members
insert into members(event_id,name,nickname,nrp,type,year,division,divisions) values ('demo-ov','Budi Santoso','Budi','5026221001','fungsionaris',2022,'EVENT',array['EVENT']::text[]);
insert into members(event_id,name,nickname,nrp,type,year,division,divisions) values ('demo-ov','Siti Rahma','Siti','5026221002','fungsionaris',2022,'SECRETARY',array['SECRETARY']::text[]);
insert into members(event_id,name,nickname,nrp,type,year,division,divisions) values ('demo-ov','Andi Wijaya','Andi','5026231003','fungsionaris',2023,'LO',array['LO']::text[]);
insert into members(event_id,name,nickname,nrp,type,year,division,divisions) values ('demo-ov','Dewi Lestari','Dewi','5026231004','fungsionaris',2023,'CREATIVE',array['CREATIVE','MARKETING']::text[]);
insert into members(event_id,name,nickname,nrp,type,year,division,divisions) values ('demo-ov','Rizky Pratama','Rizky','5026231005','fungsionaris',2023,'MARKETING',array['MARKETING']::text[]);
insert into members(event_id,name,nickname,nrp,type,year,division,divisions) values ('demo-ov','Putri Anggraini','Putri','5026241006','intern',2024,'CONSUMPTION',array['CONSUMPTION']::text[]);
insert into members(event_id,name,nickname,nrp,type,year,division,divisions) values ('demo-ov','Fajar Nugroho','Fajar','5026241007','intern',2024,'OPERATIONAL',array['OPERATIONAL']::text[]);
insert into members(event_id,name,nickname,nrp,type,year,division,divisions) values ('demo-ov','Maya Kusuma','Maya','5026241008','intern',2024,'EVENT',array['EVENT']::text[]);

-- tasks
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','EVENT','1','Budi','Susun konsep acara Ormawa Visit Demo','2026-08-01','','2026-08-10','','','','ongoing');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','EVENT','2','Maya','Buat rundown acara','2026-08-11','','2026-08-20','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','EVENT','3','Budi','Evaluasi & laporan akhir','2026-09-21','','2026-09-30','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','SECRETARY','1','Siti','Buat proposal & surat-menyurat','2026-08-01','','2026-08-08','','','','done');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','SECRETARY','2','Siti','Notulensi & absensi peserta','2026-09-20','','2026-09-20','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','LO','1','Andi','Koordinasi dengan himpunan partner','2026-08-05','','2026-08-25','','','','ongoing');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','LO','2','Andi','Follow up konfirmasi kehadiran','2026-09-01','','2026-09-15','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','CREATIVE','1','Dewi','Desain feeds & poster publikasi','2026-08-10','','2026-08-18','','','','done');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','CREATIVE','2','Dewi','Siapkan dokumentasi acara','2026-09-19','','2026-09-20','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','MARKETING','1','Rizky','Publikasi di media sosial','2026-08-18','','2026-09-18','','','','ongoing');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','CONSUMPTION','1','Putri','Pesan konsumsi peserta','2026-09-10','','2026-09-19','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','OPERATIONAL','1','Fajar','Siapkan perlengkapan & ruangan','2026-09-15','','2026-09-19','','','','overtime');

-- budget
with p as (insert into budget_plans(name,event_id) values ('RAB Ormawa Visit Demo','demo-ov') returning id)
  insert into budget_items(plan_id,category,no,name,qty,unit,unit_price,total,"order")
  select p.id, v.* from p, (values
    ('KONSUMSI',1,'Snack peserta',30,'box',15000,450000,0),
    ('KONSUMSI',2,'Air mineral',5,'dus',20000,100000,1),
    ('KESEKRETARIATAN',3,'Cetak proposal',3,'eksemplar',25000,75000,2),
    ('ACARA',4,'Plakat / cinderamata',1,'buah',150000,150000,3),
    ('KREATIF',5,'Cetak banner',1,'buah',120000,120000,4),
    ('OPERASIONAL',6,'Sewa perlengkapan',1,'paket',200000,200000,5)
  ) as v(category,no,name,qty,unit,unit_price,total,ord);

-- rundown
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,mc,operator,division_jobs) values ('demo-ov','A',1,'08:00','08:30','','Registrasi peserta','Semua panitia','','','{}'::jsonb);
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,mc,operator,division_jobs) values ('demo-ov','A',2,'08:30','09:00','','Pembukaan & sambutan','MC','','','{}'::jsonb);
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,mc,operator,division_jobs) values ('demo-ov','A',3,'09:00','10:30','','Sesi sharing & FGD','Moderator','','','{}'::jsonb);
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,mc,operator,division_jobs) values ('demo-ov','A',4,'10:30','11:30','','Games & networking','Event','','','{}'::jsonb);
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,mc,operator,division_jobs) values ('demo-ov','A',5,'11:30','12:00','','Penutupan & dokumentasi','MC','','','{}'::jsonb);

-- job hari-h
insert into job_harih(event_id,no,pic,job,notes) values ('demo-ov','1','Maya','MC Acara','');
insert into job_harih(event_id,no,pic,job,notes) values ('demo-ov','2','Siti','Registrasi & absensi','');
insert into job_harih(event_id,no,pic,job,notes) values ('demo-ov','3','Dewi','Dokumentasi foto/video','');
insert into job_harih(event_id,no,pic,job,notes) values ('demo-ov','4','Andi','LO himpunan partner','');
insert into job_harih(event_id,no,pic,job,notes) values ('demo-ov','5','Putri, Fajar','Konsumsi & perlengkapan','');

-- teams (coordinator only; fungsionaris/intern derive from members)
insert into teams(event_id,division,coordinator,fungsionaris,intern) values ('demo-ov','EVENT','Budi','','');
insert into teams(event_id,division,coordinator,fungsionaris,intern) values ('demo-ov','SECRETARY','Siti','','');
insert into teams(event_id,division,coordinator,fungsionaris,intern) values ('demo-ov','LO','Andi','','');
insert into teams(event_id,division,coordinator,fungsionaris,intern) values ('demo-ov','CREATIVE','Dewi','','');
insert into teams(event_id,division,coordinator,fungsionaris,intern) values ('demo-ov','MARKETING','Rizky','','');
insert into teams(event_id,division,coordinator,fungsionaris,intern) values ('demo-ov','CONSUMPTION',null,'','');
insert into teams(event_id,division,coordinator,fungsionaris,intern) values ('demo-ov','OPERATIONAL',null,'','');

-- prospects
insert into prospects(event_id,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('demo-ov','1','','','','Himpunan Demo A','Universitas Contoh','','Andi','DIHUBUNGI','DITERIMA','',false,'demo');
insert into prospects(event_id,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('demo-ov','2','','','','Himpunan Demo B','Institut Sample','','Andi','MENGHUBUNGI','DITUNGGU','',false,'demo');
insert into prospects(event_id,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('demo-ov','3','','','','Himpunan Demo C','Politeknik Uji','','Budi','DIHUBUNGI','DITOLAK','',false,'demo');
insert into prospects(event_id,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('demo-ov','4','','','','Himpunan Demo D','Universitas Placeholder','',null,null,null,'',false,'demo');

-- links
insert into links(event_id,section,division,name,url,note,source) values ('demo-ov','Proposal','SECRETARY','Proposal Ormawa Visit Demo','https://example.com/proposal-demo','','demo');
insert into links(event_id,section,division,name,url,note,source) values ('demo-ov','Desain','CREATIVE','Folder Desain','https://example.com/desain-demo','','demo');
insert into links(event_id,section,division,name,url,note,source) values ('demo-ov','Dokumentasi','CREATIVE','Drive Dokumentasi','https://example.com/dokumentasi-demo','','demo');
insert into links(event_id,section,division,name,url,note,source) values ('demo-ov','Formulir','EVENT','Form Pendaftaran Peserta','https://example.com/form-demo','','demo');

commit;
