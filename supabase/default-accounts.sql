-- ============================================================
-- AKUN DEFAULT — Koordinator, Staff, Intern.
--
-- Membuat tiga akun login siap pakai supaya orang bisa langsung masuk tanpa
-- harus mendaftar sendiri lalu menunggu peran disetujui admin.
--
--   Email                          Peran         Kata sandi awal
--   coordinator@ormawavisit.id     Koordinator   OrmawaVisit123
--   staff@ormawavisit.id           Staff         OrmawaVisit123
--   intern@ormawavisit.id          Intern        OrmawaVisit123
--
-- ⚠️  GANTI kata sandinya setelah login pertama (lewat Supabase, atau minta
--     admin). Password default ini hanya untuk memulai.
--
-- Idempotent: menjalankan ulang tidak menggandakan akun; kalau akunnya sudah
-- ada, hanya perannya yang dipastikan benar.
--
-- Jalankan SETELAH setup.sql, DI PROJECT PRODUKSI (bukan demo — demo tidak
-- pakai login). Butuh ekstensi pgcrypto (sudah diaktifkan oleh setup.sql).
--
-- Kalau baris auth.users/auth.identities ditolak (versi GoTrue Supabase-mu
-- berbeda), buat ketiga akun lewat Dashboard → Authentication → Add User,
-- lalu jalankan HANYA bagian "set peran" di bawah (SELECT ... update profiles).
-- ============================================================

do $do$
declare
  acc record;
  uid uuid;
begin
  for acc in
    select * from (values
      ('coordinator@ormawavisit.id', 'Koordinator', 'coordinator'),
      ('staff@ormawavisit.id',       'Staff',       'staff'),
      ('intern@ormawavisit.id',      'Intern',      'intern')
    ) as t(email, name, role)
  loop
    select id into uid from auth.users where email = acc.email;

    if uid is null then
      uid := gen_random_uuid();

      -- Akun email/password yang sudah terkonfirmasi.
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        acc.email, crypt('OrmawaVisit123', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', acc.name)
      );

      -- Identity email — tanpa ini sebagian versi GoTrue menolak login password.
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', acc.email),
        'email', now(), now(), now()
      );
    end if;

    -- Pastikan profil ada dengan peran yang diinginkan. Trigger handle_new_user
    -- membuat profil dengan role 'viewer'; upsert ini menimpanya ke peran yang benar.
    insert into public.profiles (id, name, email, role)
      values (uid, acc.name, acc.email, acc.role::app_role)
      on conflict (id) do update set role = excluded.role, name = excluded.name;
  end loop;
end $do$;

-- ------------------------------------------------------------------
-- Bagian "set peran" (jalankan sendiri kalau akun dibuat lewat Dashboard):
--   update public.profiles p set role = v.role::app_role
--   from (values
--     ('coordinator@ormawavisit.id','coordinator'),
--     ('staff@ormawavisit.id','staff'),
--     ('intern@ormawavisit.id','intern')
--   ) as v(email, role)
--   where p.email = v.email;
-- ------------------------------------------------------------------

-- Verifikasi: tiga akun dengan peran yang benar.
select email, role
from public.profiles
where email in ('coordinator@ormawavisit.id', 'staff@ormawavisit.id', 'intern@ormawavisit.id')
order by email;
