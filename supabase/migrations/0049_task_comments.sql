-- ============================================================
-- 0049 - Catatan/komentar per tugas (Work Breakdown Structure).
--
-- Satu tugas boleh punya BANYAK "komentar inisiasi" (akar thread, parent_id
-- null). Tiap thread bisa dibalas siapa pun yang punya akses tulis tugas,
-- termasuk intern - yang TIDAK boleh dilakukan intern adalah MEMULAI thread
-- baru. Aturan peran itu ditegakkan di src/lib/permissions.ts dan aksi server
-- (src/lib/actions/task-comments.ts); di sini RLS menegakkan lapis keduanya
-- yang biasa: "punya peran" + "edisi tidak diarsipkan", persis seperti
-- task_links (0025/0034) dan task_refs (0037).
--
-- KENAPA author_id TEXT, BUKAN uuid REFERENCES auth.users.
--   1. Mode Demo berjalan TANPA auth: identitasnya datang dari
--      src/lib/demo-users.ts dan id-nya bukan uuid ("admin", "staff", ...).
--      Kolom uuid ber-FK membuat setiap komentar di demo gagal ditulis.
--   2. Tabel ini IKUT DI-BACKUP (lihat src/lib/backup.ts). role_requests
--      sengaja TIDAK di-backup justru karena FK-nya ke auth.users: memulihkan
--      baris milik akun yang sudah dihapus menggagalkan seluruh restore.
--      Kolom teks membuat komentar aman dipulihkan.
-- Nama penulis ikut disimpan (denormalisasi, sama seperti role_requests.name)
-- supaya daftar komentar tampil tanpa menyentuh `profiles`, yang policy
-- bacanya memang sempit.
--
-- Aman dijalankan berulang. Jalankan SETELAH 0048.
-- ============================================================

begin;

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  -- null = komentar inisiasi (akar thread). Terisi = balasan atas thread itu.
  -- Balasan ikut terhapus bersama akarnya.
  parent_id uuid references task_comments(id) on delete cascade,
  body text not null,
  author_id text not null default '',
  author_name text not null default '',
  author_role text not null default '',
  -- "Selesai" adalah sifat THREAD, dan thread itu akarnya. Sebuah balasan
  -- tidak pernah punya centangnya sendiri: kalau boleh, satu balasan yang
  -- resolved akan ikut terhitung saat lencana notifikasi dihitung dan sebuah
  -- thread yang masih terbuka bisa tampak tertutup.
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by text not null default '',
  created_at timestamptz not null default now(),
  constraint task_comments_reply_not_resolved check (parent_id is null or resolved = false)
);

-- Ditambahkan terpisah supaya migrasi ini juga menyembuhkan database yang
-- sudah terlanjur punya tabelnya dalam bentuk lebih awal.
alter table task_comments add column if not exists author_role text not null default '';
alter table task_comments add column if not exists resolved_at timestamptz;
alter table task_comments add column if not exists resolved_by text not null default '';

create index if not exists task_comments_task_idx on task_comments(task_id, created_at);
create index if not exists task_comments_parent_idx on task_comments(parent_id);
-- Lencana notifikasi di Work Breakdown hanya peduli thread yang MASIH
-- terbuka, jadi indeks parsialnya persis sebesar pertanyaan yang ditanyakan.
create index if not exists task_comments_open_idx
  on task_comments(task_id) where parent_id is null and not resolved;

alter table task_comments enable row level security;

-- Baca: sama seperti tabel operasional lain, cukup punya sesi.
drop policy if exists task_comments_read on task_comments;
create policy task_comments_read on task_comments
  for select to authenticated using (auth.uid() is not null);

-- Tulis: mengikuti tugas induknya. Dipecah per-verb (bukan FOR ALL) supaya
-- tiap aturan bisa di-DROP dengan namanya sendiri; policy permissive itu
-- di-OR, jadi aturan lama yang tertinggal akan menang. Itu persis celah yang
-- dibayar 0034. `writable_event()` (0028) yang menegakkan kunci arsip.
drop policy if exists task_comments_write on task_comments;
drop policy if exists task_comments_insert on task_comments;
drop policy if exists task_comments_update on task_comments;
drop policy if exists task_comments_delete on task_comments;
create policy task_comments_insert on task_comments for insert to authenticated
  with check (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_comments.task_id)));
create policy task_comments_update on task_comments for update to authenticated
  using (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_comments.task_id)))
  with check (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_comments.task_id)));
create policy task_comments_delete on task_comments for delete to authenticated
  using (has_role()
    and writable_event((select t.event_id from tasks t where t.id = task_comments.task_id)));

-- ------------------------------------------------------------------
-- restore_snapshot() dibuat ulang, dengan task_comments di dalam urutannya.
--
-- Fungsi ini (0043) memegang SALINANNYA SENDIRI dari daftar tabel. Tanpa
-- perubahan ini komentar tidak ikut dihapus sebelum `tasks` dihapus, artinya
-- setiap restore menghapus seluruh komentar lewat ON DELETE CASCADE dan tidak
-- pernah menuliskannya kembali - persis kerusakan yang dialami task_links di
-- v1.20.0. Daftar di bawah WAJIB sama persis dengan DELETE_ORDER di
-- src/lib/backup.ts; src/lib/backup.test.ts yang memagarinya.
--
-- Badannya identik dengan 0043, hanya `del_order` yang bertambah. Lihat 0043
-- untuk alasan lengkapnya (satu transaksi, SECURITY INVOKER).
-- ------------------------------------------------------------------
drop function if exists restore_snapshot(jsonb);

create or replace function restore_snapshot(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  tbl       text;
  i         int;
  deleted   bigint;
  inserted  bigint;
  cols      text;
  report    jsonb := '{}'::jsonb;
  -- Urutan HAPUS: anak dulu, induk belakangan. INSERT menyusuri terbalik.
  -- Sama persis dengan DELETE_ORDER di src/lib/backup.ts; kalau salah satu
  -- berubah, yang lain wajib ikut.
  del_order constant text[] := array[
    'task_links', 'task_refs', 'task_comments', 'prospect_links', 'budget_items',
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

  perform set_config('app.audit', 'off', true);

  foreach tbl in array del_order loop
    execute format('delete from public.%I', tbl);
    get diagnostics deleted = row_count;
    report := jsonb_set(
      report, array[tbl],
      jsonb_build_object('deleted', deleted, 'inserted', 0), true);
  end loop;

  for i in reverse array_length(del_order, 1) .. 1 loop
    tbl := del_order[i];
    if payload ? tbl and jsonb_typeof(payload -> tbl) = 'array' then
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

grant execute on function restore_snapshot(jsonb) to authenticated;

comment on function restore_snapshot(jsonb) is
  'Ganti seluruh data aplikasi dengan isi snapshot, dalam satu transaksi. Admin saja; RLS tetap berlaku (security invoker).';

commit;
