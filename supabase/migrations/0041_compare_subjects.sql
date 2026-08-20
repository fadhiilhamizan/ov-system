-- ============================================================
-- Compare: perbandingan dibuat SECARA SENGAJA, bukan muncul sendiri.
--
-- Sebelumnya kartu perbandingan diturunkan langsung dari daftar prospek yang
-- berstatus DITERIMA: begitu sebuah himpunan menerima, kartunya langsung ada,
-- dan tidak ada cara untuk menghapusnya. Dua akibatnya nyata: menerima lima
-- himpunan berarti lima kartu kosong yang harus diabaikan, dan kartu yang
-- terlanjur diisi tidak bisa disingkirkan tanpa menghapus satu per satu isinya.
--
-- Sekarang perbandingan punya barisnya sendiri (`compare_subjects`). Tombol
-- "Buat perbandingan" menawarkan himpunan yang menerima DAN belum dibuatkan,
-- dan menghapus perbandingan membuang seluruh penilaiannya lewat cascade.
--
-- `compare_entries` jadi anak dari subjek. Kolom prospect_id dan org_name di
-- entri dibiarkan (sudah diisi oleh 0040) supaya migrasi ini tidak merusak
-- data yang sudah ada, tapi aplikasi membacanya dari subjeknya.
-- ============================================================

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
