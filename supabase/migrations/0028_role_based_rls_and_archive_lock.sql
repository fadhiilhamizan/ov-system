-- ============================================================
-- 0028 — Aturan tulis berbasis PERAN saja, + kunci arsip per Ormawa Visit.
-- Jalankan SETELAH 0001-0027.
--
-- LATAR BELAKANG (kenapa migrasi ini ada):
--   0020 dan 0026 mengunci penulisan dengan owns_scope(event_id, division),
--   yang membandingkan profiles.division dan profiles.event_id. Kedua kolom itu
--   ternyata TIDAK PERNAH dipakai produk ini: sebuah akun tidak mewakili orang
--   atau divisi tertentu, dan perannya berlaku untuk SEMUA Ormawa Visit. Satu
--   akun bahkan bisa dipakai bergantian oleh beberapa orang.
--   Akibatnya owns_scope() selalu gagal (fail closed saat kolomnya NULL), jadi
--   Koordinator/Staff/Intern tidak bisa menyimpan perubahan tugas sama sekali,
--   tanpa pesan error apa pun.
--   Migrasi ini menyamakan aturan database dengan MODULE_ACCESS_LEVEL di
--   src/lib/constants.ts: murni peran, tanpa divisi, tanpa edisi.
--
-- YANG TETAP DIPERTAHANKAN dari 0020 (jangan dihapus):
--   * pembatasan kolom pada profiles (perbaikan celah kritis self-promotion),
--   * policy restrictive "no_anon" (sesi anonim = baca saja).
--
-- YANG BARU:
--   * events.locked — Ormawa Visit yang diarsipkan. Selain Admin, tidak ada
--     peran yang bisa mengubah apa pun di dalamnya. Admin bisa membuka lagi.
--   * Anggaran & Super Link kini juga tertutup untuk akun TERDAFTAR yang belum
--     punya peran (role 'viewer'), bukan cuma untuk tamu anonim.
-- ============================================================

begin;

-- ------------------------------------------------------------------
-- 1) Kolom kunci arsip.
-- ------------------------------------------------------------------
alter table events add column if not exists locked boolean not null default false;

comment on column events.locked is
  'Arsip terkunci: selain admin, tidak ada peran yang boleh menulis data milik Ormawa Visit ini.';

-- ------------------------------------------------------------------
-- 2) Helper.
-- ------------------------------------------------------------------

-- Akun sungguhan dengan peran yang bisa menulis. Menolak sesi anonim (tamu)
-- DAN akun terdaftar yang perannya masih 'viewer' (belum di-approve admin).
-- Fail closed: profil yang tidak ada membuat auth_role() NULL -> false.
create or replace function has_role() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(auth_role()::text in ('admin', 'coordinator', 'staff', 'intern'), false)
     and not is_anon();
$fn$;

-- Boleh menulis baris milik Ormawa Visit ini? Admin selalu boleh (termasuk di
-- arsip terkunci, supaya ia bisa memperbaiki lalu membuka kuncinya).
-- event_id NULL / edisi yang sudah terhapus dianggap TIDAK terkunci, supaya
-- baris legacy tanpa scope tetap bisa disunting.
create or replace function writable_event(row_event text) returns boolean
language sql stable security definer set search_path = public as $fn$
  select auth_role() = 'admin'
      or not coalesce((select e.locked from public.events e where e.id = row_event), false);
$fn$;

-- ------------------------------------------------------------------
-- 3) Buang semua policy tulis lama (0002 / 0016 / 0020 / 0025 / 0026).
--    Policy baca dan policy restrictive "no_anon" TIDAK disentuh di sini.
-- ------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array['divisions', 'events', 'members', 'tasks', 'prospects', 'links',
                           'budget_plans', 'budget_items', 'rundown', 'job_harih', 'faqs',
                           'teams', 'task_links']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format('drop policy if exists "%s_admin_write" on %I;', t, t);
    execute format('drop policy if exists "%s_insert" on %I;', t, t);
    execute format('drop policy if exists "%s_update" on %I;', t, t);
    execute format('drop policy if exists "%s_delete" on %I;', t, t);
  end loop;
end $do$;

-- ------------------------------------------------------------------
-- 4) Modul "limited": Admin, Koordinator, Staff, Intern boleh membuat dan
--    mengubah; hanya Admin & Koordinator boleh menghapus.
--    Cocok dengan matriks: tasks / rundown / jobs / links.
-- ------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array['tasks', 'rundown', 'job_harih', 'links']
  loop
    execute format($p$create policy "%s_insert" on %I for insert to authenticated
      with check (has_role() and writable_event(event_id));$p$, t, t);

    -- WITH CHECK wajib: USING menentukan baris mana yang boleh disasar,
    -- WITH CHECK menentukan bentuk baris SESUDAHNYA. Tanpa itu sebuah baris
    -- bisa dipindahkan ke Ormawa Visit yang terkunci dalam satu perintah.
    execute format($p$create policy "%s_update" on %I for update to authenticated
      using (has_role() and writable_event(event_id))
      with check (has_role() and writable_event(event_id));$p$, t, t);

    execute format($p$create policy "%s_delete" on %I for delete to authenticated
      using (auth_role()::text in ('admin', 'coordinator') and not is_anon()
             and writable_event(event_id));$p$, t, t);
  end loop;
end $do$;

-- task_links mengikuti tugas induknya: siapa pun yang boleh mengisi hasil tugas
-- boleh menambah, mengubah, dan menghapus tautannya. Edisinya diambil lewat
-- tugas induk karena tabel ini tidak punya event_id sendiri.
-- Dijaga to_regclass: tabelnya lahir di 0025, yang tidak dipasang di project demo.
do $do$
begin
  if to_regclass('public.task_links') is null then
    raise notice 'task_links belum ada (project demo) - policy-nya dilewati.';
    return;
  end if;

  execute $p$create policy "task_links_insert" on task_links for insert to authenticated
    with check (
      has_role()
      and writable_event((select t.event_id from tasks t where t.id = task_links.task_id))
    );$p$;

  execute $p$create policy "task_links_update" on task_links for update to authenticated
    using (
      has_role()
      and writable_event((select t.event_id from tasks t where t.id = task_links.task_id))
    )
    with check (
      has_role()
      and writable_event((select t.event_id from tasks t where t.id = task_links.task_id))
    );$p$;

  execute $p$create policy "task_links_delete" on task_links for delete to authenticated
    using (
      has_role()
      and writable_event((select t.event_id from tasks t where t.id = task_links.task_id))
    );$p$;
end $do$;

-- ------------------------------------------------------------------
-- 5) Modul "full = admin saja" sesuai matriks: Divisi, Ormawa Visit, Anggota,
--    Tim, Reach & Offer, Anggaran, FAQ.
--    Admin melewati kunci arsip, jadi writable_event() tidak diperlukan.
-- ------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array['divisions', 'events', 'members', 'teams', 'prospects',
                           'budget_plans', 'budget_items', 'faqs']
  loop
    execute format($p$create policy "%s_write" on %I for all to authenticated
      using (auth_role() = 'admin' and not is_anon())
      with check (auth_role() = 'admin' and not is_anon());$p$, t, t);
  end loop;
end $do$;

-- ------------------------------------------------------------------
-- 6) Kolom tugas: batasan kolom dari 0020/0026 dicabut.
--    Alasannya, batasan itu dibuat untuk menahan Staff/Intern pada kolom
--    status+hasil saja. Matriks sekarang memberi mereka "limited" (buat & ubah
--    penuh, tanpa hapus), jadi pembatasan kolomnya justru salah — dan sempat
--    memblokir kolom yang memang perlu ditulis form tugas.
-- ------------------------------------------------------------------
grant update on public.tasks to authenticated;

-- ------------------------------------------------------------------
-- 7) Baca Anggaran & Super Link: hanya akun yang sudah punya peran.
--    0016 memakai `not is_anon()`, yang cukup ketika satu-satunya "Tamu"
--    adalah sesi anonim. Sejak pendaftaran mandiri (0023) ada Tamu jenis
--    kedua — akun terdaftar dengan role 'viewer' — dan akun itu lolos.
--    Matriks bilang Tamu tidak punya akses ke dua modul ini.
-- ------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array['budget_plans', 'budget_items', 'links']
  loop
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('drop policy if exists "read_auth" on %I;', t);
    execute format('create policy "read_auth" on %I for select to authenticated using (has_role());', t);
  end loop;
end $do$;

-- ------------------------------------------------------------------
-- 8) Sesi anonim = baca saja, juga untuk task_links (terlewat di 0020).
--    Dipecah per perintah: policy restrictive FOR ALL akan menerapkan USING
--    pada SELECT (memutus baca tamu) sementara DELETE mengabaikan WITH CHECK.
-- ------------------------------------------------------------------
do $do$
begin
  if to_regclass('public.task_links') is null then
    return;
  end if;
  execute 'drop policy if exists "task_links_no_anon_insert" on task_links';
  execute $p$create policy "task_links_no_anon_insert" on task_links as restrictive
    for insert to authenticated with check (not is_anon());$p$;
  execute 'drop policy if exists "task_links_no_anon_update" on task_links';
  execute $p$create policy "task_links_no_anon_update" on task_links as restrictive
    for update to authenticated using (not is_anon()) with check (not is_anon());$p$;
  execute 'drop policy if exists "task_links_no_anon_delete" on task_links';
  execute $p$create policy "task_links_no_anon_delete" on task_links as restrictive
    for delete to authenticated using (not is_anon());$p$;
end $do$;

-- ------------------------------------------------------------------
-- 9) Persetujuan peran tidak lagi menulis divisi / edisi ke profil.
--    Peran bersifat global; kolom profiles.division dan profiles.event_id
--    ditinggalkan (tidak dihapus, supaya tidak destruktif) tapi tidak lagi
--    dibaca atau ditulis oleh siapa pun.
-- ------------------------------------------------------------------
-- Dijaga to_regclass: role_requests lahir di 0023, tidak dipasang di demo.
do $do$
begin
  if to_regclass('public.role_requests') is null then
    raise notice 'role_requests belum ada (project demo) - decide_role_request dilewati.';
    return;
  end if;

  execute $sql$
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
  $sql$;

  execute 'revoke all on function decide_role_request(uuid, boolean) from public, anon';
  execute 'grant execute on function decide_role_request(uuid, boolean) to authenticated';
end $do$;

commit;

-- ------------------------------------------------------------------
-- 10) Bersih-bersih: buang helper scoping yang sudah tidak dipakai policy mana
--     pun. Dijalankan di luar transaksi utama dan ditangkap errornya, supaya
--     migrasi tidak gagal total kalau ada objek lain yang masih memakainya.
-- ------------------------------------------------------------------
do $do$
begin
  begin
    drop function if exists owns_scope(text, text);
  exception when others then
    raise notice 'owns_scope masih dipakai objek lain, dilewati.';
  end;
  begin
    drop function if exists auth_event();
  exception when others then
    raise notice 'auth_event masih dipakai objek lain, dilewati.';
  end;
end $do$;

-- ------------------------------------------------------------------
-- 11) Verifikasi. Baris yang muncul di sini = policy tulis yang MASIH
--     menyebut divisi atau edisi lewat scoping lama. Harusnya kosong.
-- ------------------------------------------------------------------
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(owns_scope|auth_event|auth_division)'
order by tablename, policyname;
