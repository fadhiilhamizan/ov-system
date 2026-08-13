-- ============================================================
-- Referensi tugas: tautan yang DIPAKAI tugas, bukan hasil tugas.
--
-- Jangan tertukar dengan `task_links` (0025). Arahnya berlawanan:
--
--   task_links : hasil tugas, DITERBITKAN ke Super Link.
--                Satu baris Super Link dimiliki tepat satu tugas, itu sebabnya
--                ada unique index pada link_id.
--
--   task_refs  : bahan rujukan yang DIPAKAI tugas. Boleh menunjuk baris Super
--                Link yang sudah ada, dan SATU baris Super Link boleh dirujuk
--                BANYAK tugas. Jadi TIDAK ADA unique index pada link_id di
--                sini, dan itu memang disengaja.
--
-- link_id null = tautan diketik manual, tidak terhubung ke Super Link.
-- ON DELETE SET NULL: menghapus entri Super Link tidak menghapus referensinya,
-- tautannya tetap tersimpan di kolom `url` sebagai teks biasa.
-- ============================================================
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

alter table task_refs enable row level security;

-- Baca: sama seperti tabel operasional lain, cukup punya sesi.
drop policy if exists task_refs_read on task_refs;
create policy task_refs_read on task_refs
  for select to authenticated using (auth.uid() is not null);

-- Tulis: mengikuti tugas induknya, bentuknya disamakan persis dengan policy
-- task_links di 0034. Dipecah per-verb (bukan FOR ALL) supaya tiap aturan bisa
-- di-DROP dengan namanya sendiri; policy permissive itu di-OR, jadi aturan lama
-- yang tertinggal akan menang. Itu persis celah yang dibayar 0034.
-- `writable_event()` (0028) yang menegakkan kunci arsip.
drop policy if exists task_refs_write on task_refs;
drop policy if exists task_refs_insert on task_refs;
drop policy if exists task_refs_update on task_refs;
drop policy if exists task_refs_delete on task_refs;
create policy task_refs_insert on task_refs for insert to authenticated
  with check (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_refs.task_id)));
create policy task_refs_update on task_refs for update to authenticated
  using (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_refs.task_id)))
  with check (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_refs.task_id)));
create policy task_refs_delete on task_refs for delete to authenticated
  using (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_refs.task_id)));
