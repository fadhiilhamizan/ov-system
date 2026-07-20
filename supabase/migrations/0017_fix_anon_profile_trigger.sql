-- ============================================================
-- 0017 — Fix handle_new_user() for anonymous sign-ins.
--
-- signInAnonymously() (added in 0016 for guest mode) creates an auth.users
-- row with email = NULL. The on_auth_user_created trigger (0002_rls.sql)
-- then tried to insert profiles.name = coalesce(meta->>'name',
-- split_part(NULL,'@',1)) = NULL, violating profiles.name's NOT NULL
-- constraint — which fails the whole signup transaction. This is why the
-- guest button broke after 0016 with an opaque database-error response.
-- ============================================================

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Tamu'),
    new.email,
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end; $$;
