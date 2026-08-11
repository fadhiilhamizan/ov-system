-- ============================================================
-- 0023 - Self sign-up + role requests. Run AFTER 0001–0022.
--
-- Anyone can now create an account (email/password or Google). A fresh
-- account has NO role: handle_new_user() gives it 'viewer', which the app
-- maps to the read-only "Tamu" identity. To get real access the user files a
-- role request (Koordinator / Staff / Intern); an admin approves or ignores
-- it from the new "Role Request" menu.
--
-- Approval must NOT go through a plain `update profiles set role = ...`:
-- 0020 revokes UPDATE on profiles precisely to stop self-promotion. This
-- migration ships its own SECURITY DEFINER function so it works whether or
-- not 0020 has been applied yet.
-- ============================================================

begin;

-- ------------------------------------------------------------------
-- handle_new_user: also understand Google's OAuth metadata.
--
-- Google puts the display name in `full_name` (and `name`), and the picture
-- in `avatar_url` - 0017 only looked at `name`, so Google sign-ups landed
-- with the email local-part as their display name. Anonymous guests still
-- fall back to 'Tamu' (their email is NULL and profiles.name is NOT NULL).
-- ------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Tamu'
    ),
    new.email,
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- profiles.event_id is introduced by 0020; create it here too so this
-- migration stands on its own (both are `if not exists`).
alter table profiles add column if not exists event_id text
  references events(id) on delete set null;

-- ------------------------------------------------------------------
-- role_requests
-- ------------------------------------------------------------------
create table if not exists role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Denormalised so the admin list renders without joining profiles (whose
  -- read policy is deliberately narrow).
  name text not null default '',
  email text not null default '',
  requested_role app_role not null,
  division text,
  event_id text references events(id) on delete set null,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','ignored')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  -- Admin and viewer are never *requested*: admin is granted out of band,
  -- viewer is what you already are.
  constraint role_requests_requestable check (requested_role in ('coordinator','staff','intern'))
);

-- One open request per account - re-requesting replaces nothing, it is simply
-- rejected until the pending one is decided.
create unique index if not exists role_requests_one_pending
  on role_requests(user_id) where status = 'pending';
create index if not exists role_requests_status_idx on role_requests(status, created_at desc);

alter table role_requests enable row level security;

-- Read: your own requests, or everything if you are an admin.
drop policy if exists "role_requests_read" on role_requests;
create policy "role_requests_read" on role_requests for select to authenticated
  using (user_id = auth.uid() or auth_role() = 'admin');

-- Insert: only for yourself, only as pending, never as an anonymous guest
-- (a "Tamu" session has no account to promote).
drop policy if exists "role_requests_insert" on role_requests;
create policy "role_requests_insert" on role_requests for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Deciding happens through decide_role_request() below; no direct writes.
drop policy if exists "role_requests_admin_write" on role_requests;
create policy "role_requests_admin_write" on role_requests for delete to authenticated
  using (auth_role() = 'admin');

-- ------------------------------------------------------------------
-- decide_role_request(request, approve)
--
-- SECURITY DEFINER: approving has to write profiles.role, which 0020 revokes
-- from `authenticated` on purpose. Running as the owner is the only path that
-- does not re-open self-promotion.
-- ------------------------------------------------------------------
create or replace function decide_role_request(request_id uuid, approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  req role_requests%rowtype;
begin
  if auth_role() <> 'admin'
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
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
    update public.profiles
       set role     = req.requested_role,
           division = coalesce(nullif(req.division, ''), division),
           event_id = coalesce(req.event_id, event_id)
     where id = req.user_id;
    if not found then
      raise exception 'profile not found' using errcode = 'P0002';
    end if;
  end if;

  update role_requests
     set status     = case when approve then 'approved' else 'ignored' end,
         decided_at = now(),
         decided_by = auth.uid()
   where id = request_id;
end; $$;

revoke all on function decide_role_request(uuid, boolean) from public, anon;
grant execute on function decide_role_request(uuid, boolean) to authenticated;

-- Anonymous guests are read-only everywhere (mirrors the 0020 pass, which
-- predates this table).
drop policy if exists "role_requests_no_anon_insert" on role_requests;
create policy "role_requests_no_anon_insert" on role_requests as restrictive
  for insert to authenticated
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
drop policy if exists "role_requests_no_anon_delete" on role_requests;
create policy "role_requests_no_anon_delete" on role_requests as restrictive
  for delete to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

commit;
