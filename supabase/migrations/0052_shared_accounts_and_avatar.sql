-- ============================================================
-- 0052 - Akun bersama + foto profil karakter + ubah info akun.
--
-- TIGA HAL, satu migrasi, karena ketiganya menyentuh tabel yang sama:
--
-- 1. profiles.is_shared - menandai akun yang sengaja DIPAKAI BERSAMA banyak
--    orang (coordinator@, staff@, intern@ dari default-accounts.sql). Akun
--    seperti itu bukan milik satu orang, jadi kata sandinya bukan milik satu
--    orang juga.
--
-- 2. profiles.avatar - karakter foto profil pilihan pengguna. Kosong berarti
--    tetap memakai inisial namanya seperti sebelumnya.
--
-- 3. Trigger yang menolak perubahan kata sandi pada akun bersama.
--
-- KENAPA TRIGGER, BUKAN SEKADAR MENYEMBUNYIKAN TOMBOLNYA. Mengubah kata sandi
-- TIDAK lewat Server Action mana pun: halaman memanggil
-- `supabase.auth.updateUser()` langsung dari browser dengan anon key yang
-- memang publik. Jadi menyembunyikan menunya hanya menutup jalan yang sopan.
-- Satu-satunya tempat yang benar-benar bisa menolaknya adalah database.
--
-- KENAPA TIDAK MEMBEDAKAN LEWAT auth.uid(). Versi pertama trigger ini hanya
-- menolak kalau `auth.uid() = new.id`, dengan asumsi "perubahan dari aplikasi"
-- membawa sesi penggunanya. Asumsi itu SALAH: mengganti kata sandi tidak
-- dikerjakan PostgREST, melainkan GoTrue, lewat koneksi databasenya sendiri
-- yang tidak pernah memasang klaim JWT. Jadi `auth.uid()` selalu NULL di
-- dalam trigger ini, syaratnya tidak pernah terpenuhi, dan seluruh
-- perlindungannya jadi hiasan yang lulus semua test.
--
-- Karena itu SEMUA perubahan kata sandi akun bersama ditolak, dengan satu
-- pintu keluar yang harus disebut secara sadar:
--
--   begin;
--   set local app.rotate_shared_password = 'on';
--   update auth.users set encrypted_password = crypt('KataSandiBaru', gen_salt('bf'))
--    where email = 'staff@ormawavisit.id';
--   commit;
--
-- Konsekuensinya jujur dan memang diinginkan: tombol "lupa kata sandi" dan
-- reset dari Dashboard juga tidak berlaku untuk ketiga akun itu. Merotasinya
-- adalah tindakan admin yang disengaja, bukan sesuatu yang bisa dipicu siapa
-- pun yang kebetulan tahu alamat emailnya.
--
-- Aman dijalankan berulang. Jalankan SETELAH 0051.
-- ============================================================

begin;

-- ------------------------------------------------------------------
-- 1) Kolom baru.
-- ------------------------------------------------------------------
alter table profiles add column if not exists is_shared boolean not null default false;
alter table profiles add column if not exists avatar text;

comment on column profiles.is_shared is
  'Akun dipakai bersama banyak orang. Kata sandinya tidak bisa diubah dari sesi akun itu sendiri (lihat trigger di 0052).';
comment on column profiles.avatar is
  'Kunci karakter foto profil pilihan pengguna. NULL = pakai inisial nama.';

-- Tandai ketiga akun default. Dicocokkan lewat EMAIL di auth.users, bukan id,
-- karena id-nya berbeda di tiap project.
update profiles p
   set is_shared = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) in (
     'coordinator@ormawavisit.id',
     'staff@ormawavisit.id',
     'intern@ormawavisit.id'
   )
   and p.is_shared is distinct from true;

-- ------------------------------------------------------------------
-- 2) Kolom yang boleh disentuh pemilik akunnya sendiri.
--
-- `avatar` ikut; `is_shared` TIDAK - kalau ikut, pemakai akun bersama tinggal
-- mematikan tandanya sendiri lalu mengganti kata sandinya, dan seluruh isi
-- migrasi ini jadi hiasan.
-- ------------------------------------------------------------------
revoke update on public.profiles from authenticated, anon;
grant update (name, avatar_color, avatar) on public.profiles to authenticated;

-- Policy-nya dipasang ulang dengan `is_shared` ikut dipagari, sama seperti
-- `role` dan `division`: WITH CHECK membandingkan nilai barunya dengan nilai
-- yang sekarang tersimpan, jadi baris hanya lolos kalau kolom itu tidak
-- berubah. (GRANT di atas sudah menolaknya lebih dulu; ini lapis keduanya,
-- dan yang bertahan kalau suatu saat GRANT-nya dilonggarkan.)
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles for update to authenticated
  using (id = auth.uid() and not is_anon())
  with check (
    id = auth.uid()
    and role      is not distinct from (select p.role      from profiles p where p.id = auth.uid())
    and division  is not distinct from (select p.division  from profiles p where p.id = auth.uid())
    and is_shared is not distinct from (select p.is_shared from profiles p where p.id = auth.uid())
  );

-- ------------------------------------------------------------------
-- 3) Tolak perubahan kata sandi pada akun bersama.
--
-- Hanya menyentuh UPDATE yang benar-benar mengubah `encrypted_password`.
-- GoTrue memperbarui baris auth.users untuk banyak hal lain (last_sign_in_at,
-- token, konfirmasi email); memblokir semuanya akan mematikan login itu
-- sendiri.
-- ------------------------------------------------------------------
create or replace function block_shared_account_password()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and coalesce(current_setting('app.rotate_shared_password', true), '') <> 'on'
     and exists (select 1 from public.profiles p where p.id = new.id and p.is_shared)
  then
    raise exception
      'Akun ini dipakai bersama, jadi kata sandinya tidak bisa diganti. Rotasi hanya lewat SQL, lihat migrasi 0052.'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists on_shared_account_password_change on auth.users;
create trigger on_shared_account_password_change
  before update on auth.users
  for each row execute function block_shared_account_password();

commit;
