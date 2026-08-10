-- ============================================================
-- AKUN DEFAULT — Koordinator, Staff, Intern.
--
--   Email                          Peran         Kata sandi awal
--   coordinator@ormawavisit.id     Koordinator   OrmawaVisit123
--   staff@ormawavisit.id           Staff         OrmawaVisit123
--   intern@ormawavisit.id          Intern        OrmawaVisit123
--
-- GANTI kata sandinya setelah login pertama.
--
-- Aman dijalankan berulang. Jalankan SETELAH setup.sql, di project PRODUKSI
-- (bukan demo — demo tidak pakai login).
--
-- ------------------------------------------------------------------
-- KALAU LOGIN GAGAL DENGAN PESAN ANEH SEPERTI "{}"
--
-- Versi pertama skrip ini membuat baris auth.users tanpa mengisi kolom-kolom
-- token milik GoTrue (confirmation_token, recovery_token, dsb). Kolom itu
-- boleh NULL menurut Postgres, tetapi GoTrue membacanya sebagai string Go —
-- NULL membuatnya gagal dengan "converting NULL to string is unsupported",
-- lalu mengembalikan HTTP 500 tanpa isi pesan. Aplikasi menerima badan respons
-- kosong dan menampilkannya apa adanya: {}.
--
-- BAGIAN 1 di bawah memperbaiki baris yang terlanjur dibuat seperti itu, jadi
-- cukup jalankan ulang file ini — tidak perlu menghapus akunnya.
-- ------------------------------------------------------------------

-- ==================================================================
-- BAGIAN 1 — Perbaiki kolom token yang NULL (penyebab error "{}").
--
-- Berlaku untuk SEMUA akun, bukan cuma tiga akun default: akun apa pun yang
-- pernah dibuat lewat SQL manual kena masalah yang sama. Nama kolom diperiksa
-- dulu ke information_schema karena daftar kolom GoTrue berbeda antar versi.
-- ==================================================================
do $fix$
declare
  col text;
begin
  foreach col in array array[
    'confirmation_token',
    'recovery_token',
    'email_change',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change',
    'phone_change_token',
    'reauthentication_token'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'users' and column_name = col
    ) then
      execute format('update auth.users set %I = %L where %I is null', col, '', col);
    end if;
  end loop;
end $fix$;

-- ==================================================================
-- BAGIAN 2 — Buat tiga akun default (dilewati kalau emailnya sudah ada).
-- ==================================================================
do $seed$
declare
  acc record;
  new_id uuid;
begin
  for acc in
    select * from (values
      ('coordinator@ormawavisit.id', 'Koordinator', 'coordinator'),
      ('staff@ormawavisit.id',       'Staff',       'staff'),
      ('intern@ormawavisit.id',      'Intern',      'intern')
    ) as t(email, name, role)
  loop
    if not exists (select 1 from auth.users u where u.email = acc.email) then
      new_id := gen_random_uuid();

      -- Hanya kolom inti yang ada di semua versi GoTrue. Kolom token diisi
      -- oleh BAGIAN 3 supaya skrip ini tidak patah kalau ada versi yang
      -- namanya berbeda.
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
      ) values (
        '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
        acc.email, crypt('OrmawaVisit123', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', acc.name)
      );

      -- Tanpa baris identity, login email/password ditolak GoTrue.
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), new_id, new_id::text,
        jsonb_build_object('sub', new_id::text, 'email', acc.email),
        'email', now(), now(), now()
      );
    end if;
  end loop;
end $seed$;

-- ==================================================================
-- BAGIAN 3 — Isi lagi kolom token untuk akun yang baru dibuat di BAGIAN 2.
-- (Perintah yang sama dengan BAGIAN 1; dijalankan dua kali memang disengaja.)
-- ==================================================================
do $fix2$
declare
  col text;
begin
  foreach col in array array[
    'confirmation_token',
    'recovery_token',
    'email_change',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change',
    'phone_change_token',
    'reauthentication_token'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'users' and column_name = col
    ) then
      execute format('update auth.users set %I = %L where %I is null', col, '', col);
    end if;
  end loop;
end $fix2$;

-- ==================================================================
-- BAGIAN 4 — Pastikan perannya benar.
--
-- Trigger handle_new_user membuat profil dengan role 'viewer'; baris ini
-- menimpanya. Jalankan BAGIAN INI SAJA kalau akunnya kamu buat lewat
-- Dashboard (Authentication -> Add user) — cara itu paling aman karena
-- Supabase sendiri yang mengisi semua kolomnya.
-- ==================================================================
insert into public.profiles (id, name, email, role)
select u.id, v.name, v.email, v.role::app_role
from (values
  ('coordinator@ormawavisit.id', 'Koordinator', 'coordinator'),
  ('staff@ormawavisit.id',       'Staff',       'staff'),
  ('intern@ormawavisit.id',      'Intern',      'intern')
) as v(email, name, role)
join auth.users u on u.email = v.email
on conflict (id) do update set role = excluded.role, name = excluded.name;

-- ==================================================================
-- VERIFIKASI — tiga baris, semuanya 'siap login'.
-- ==================================================================
select
  p.email,
  p.role,
  case
    when i.id is null then 'BELUM SIAP: identity email tidak ada'
    when u.encrypted_password is null then 'BELUM SIAP: tanpa kata sandi'
    when u.email_confirmed_at is null then 'BELUM SIAP: email belum terkonfirmasi'
    when u.confirmation_token is null then 'BELUM SIAP: kolom token masih NULL'
    else 'siap login'
  end as status
from public.profiles p
join auth.users u on u.id = p.id
left join auth.identities i on i.user_id = u.id and i.provider = 'email'
where p.email in ('coordinator@ormawavisit.id', 'staff@ormawavisit.id', 'intern@ormawavisit.id')
order by p.email;
