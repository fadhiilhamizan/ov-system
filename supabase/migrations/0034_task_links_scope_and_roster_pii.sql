-- ============================================================
-- 0034 - Dua celah RLS yang tersisa di jalur migrasi (bukan di setup.sql).
--
-- A. task_links: kunci arsip bisa ditembus.
--    Migrasi 0025 membuat policy `task_links_write` (FOR ALL, hanya cek peran,
--    TANPA scope edisi). Migrasi 0028 menambah policy baru task_links_insert/
--    update/delete yang ter-scope lewat writable_event(), TAPI lupa men-drop
--    `task_links_write` yang lama. Policy permissive di-OR - jadi policy lama
--    yang longgar itu masih hidup dan tetap mengizinkan tulis di Ormawa Visit
--    yang sudah DIARSIPKAN. Perbaikannya: buang policy basi itu.
--    (setup.sql sudah benar sejak awal; ini hanya menutup jalur migrasi.)
--
-- B. Roster (members, teams) = PII bagi Tamu.
--    Nama + NRP mahasiswa adalah data pribadi. Read policy-nya masih
--    `auth.uid() is not null`, jadi Tamu - sesi anonim maupun akun terdaftar
--    ber-peran 'viewer' - bisa menariknya. Diperketat ke has_role(): hanya
--    akun dengan peran nyata (admin/koordinator/staff/intern) yang boleh baca.
--    teams ikut ditutup karena coordinator/fungsionaris/intern juga nama.
--
-- Jalankan SETELAH 0033. Idempotent, non-destruktif (tidak menghapus data),
-- dan tiap statement berdiri sendiri (aman di SQL editor Supabase).
-- ============================================================

begin;

-- ---- A. Buang policy task_links yang tidak ter-scope ----
-- Aman kalau tabelnya belum ada (project belum sampai 0025) atau policy-nya
-- sudah tidak ada.
do $do$
begin
  if to_regclass('public.task_links') is not null then
    execute 'drop policy if exists "task_links_write" on task_links';
  end if;
end $do$;

-- Pastikan versi ter-scope-nya ada (idempotent: 0028 sudah membuatnya, tapi ini
-- menjamin keadaan akhir walau 0028 belum jalan di database ini).
do $do$
begin
  if to_regclass('public.task_links') is null then
    return;
  end if;
  execute 'drop policy if exists "task_links_insert" on task_links';
  execute $p$create policy "task_links_insert" on task_links for insert to authenticated
    with check (has_role()
      and writable_event((select t.event_id from tasks t where t.id = task_links.task_id)));$p$;
  execute 'drop policy if exists "task_links_update" on task_links';
  execute $p$create policy "task_links_update" on task_links for update to authenticated
    using (has_role()
      and writable_event((select t.event_id from tasks t where t.id = task_links.task_id)))
    with check (has_role()
      and writable_event((select t.event_id from tasks t where t.id = task_links.task_id)));$p$;
  execute 'drop policy if exists "task_links_delete" on task_links';
  execute $p$create policy "task_links_delete" on task_links for delete to authenticated
    using (has_role()
      and writable_event((select t.event_id from tasks t where t.id = task_links.task_id)));$p$;
end $do$;

-- ---- B. Roster hanya untuk akun berperan ----
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

commit;

-- ------------------------------------------------------------------
-- Verifikasi. Kedua baris harus mengembalikan hasil yang diharapkan.
-- ------------------------------------------------------------------
-- 1) Policy task_links_write yang basi harus SUDAH TIDAK ADA (0 baris).
select policyname
from pg_policies
where schemaname = 'public' and tablename = 'task_links' and policyname = 'task_links_write';

-- 2) Read members/teams harus memakai has_role() (2 baris, qual memuat has_role).
select tablename, policyname, qual
from pg_policies
where schemaname = 'public' and tablename in ('members', 'teams') and cmd = 'SELECT'
order by tablename;
