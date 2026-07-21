-- ============================================================
-- 0020 — Security hardening. Run AFTER 0001–0019.
--
-- C1 (CRITICAL) Privilege escalation via profiles.
--   0002's `profiles_update_own` is a ROW-level policy with no WITH CHECK and
--   no column restriction. Because the anon key is public and the session JWT
--   lives in the browser, ANY session — including the credential-less
--   anonymous "Tamu" sign-in — could call PostgREST directly:
--       supabase.from('profiles').update({ role: 'admin' }).eq('id', <own uid>)
--   `id = auth.uid()` still holds after the change, so the policy passed and
--   auth_role() started returning 'admin'. That is unauthenticated full
--   read/write/delete of every table, plus backup + restore.
--   Fix: column-level GRANTs (RLS cannot express "not this column") + a
--   WITH CHECK that pins role/division to their stored values for non-admins.
--
-- H1 Cross-Ormawa-Visit authorization. Since 0018 a division `key` is unique
--   only PER EVENT, but auth_division() compares the bare key — so the
--   coordinator of EVENT@ov1-2025 could write EVENT@ov2-2026. profiles gains
--   `event_id`, and the task policies now match on (event_id, division).
--
-- H2 Column-level bypass on tasks. RLS let staff/intern rewrite ANY column of
--   a task in their division; the app only ever allows status+result. Closed
--   with column GRANTs so the DB enforces the same narrow surface.
--
-- H3 Event scoping for budget / rundown / jobs / teams write policies.
-- M4 profiles email harvesting by anonymous guests.
-- ============================================================

begin;

-- ------------------------------------------------------------------
-- C1 — profiles: no self-promotion.
-- ------------------------------------------------------------------

-- RLS is row-level; column protection must come from GRANTs. Revoke the blanket
-- UPDATE and hand back only the self-service columns. `role` and `division` are
-- now unwritable by anyone but the service role / an admin path.
revoke update on public.profiles from authenticated, anon;
grant update (name, avatar_color) on public.profiles to authenticated;

drop policy if exists "profiles_update_own" on profiles;

-- Belt and braces: even with the GRANT above, pin the sensitive columns to
-- their current values so a future `grant update` mistake cannot re-open this.
create policy "profiles_update_self" on profiles for update
  to authenticated
  using (id = auth.uid() and not is_anon())
  with check (
    id = auth.uid()
    and role     is not distinct from (select p.role     from profiles p where p.id = auth.uid())
    and division is not distinct from (select p.division from profiles p where p.id = auth.uid())
  );

-- Admins manage roles through a SECURITY DEFINER function rather than a direct
-- table UPDATE, so the grant above stays revoked and every promotion is
-- explicit and auditable.
create or replace function set_user_role(target uuid, new_role app_role, new_division text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth_role() <> 'admin' or is_anon() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- An admin cannot demote themselves into a lockout, and cannot be tricked
  -- into operating on a non-existent row.
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'cannot change your own role' using errcode = '42501';
  end if;
  update public.profiles
     set role = new_role,
         division = coalesce(new_division, division)
   where id = target;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
end; $$;
revoke all on function set_user_role(uuid, app_role, text) from public, anon;
grant execute on function set_user_role(uuid, app_role, text) to authenticated;

-- ------------------------------------------------------------------
-- M4 — profiles read: stop anonymous guests harvesting member emails.
-- ------------------------------------------------------------------
drop policy if exists "profiles_read" on profiles;
create policy "profiles_read" on profiles for select
  to authenticated
  using (id = auth.uid() or (auth.uid() is not null and not is_anon()));

-- ------------------------------------------------------------------
-- H1 — profiles gain an event scope, and a matching helper.
-- ------------------------------------------------------------------
alter table profiles add column if not exists event_id text
  references events(id) on delete set null;

create or replace function auth_event() returns text
language sql stable security definer set search_path = public as $$
  select event_id from public.profiles where id = auth.uid();
$$;

-- A scoped role only has authority inside its own Ormawa Visit + division.
-- A NULL profiles.event_id means "not scoped to one edition" — deliberately
-- treated as NO authority for non-admins (fail closed). Backfill the column for
-- every real coordinator/staff/intern before relying on this.
create or replace function owns_scope(row_event text, row_division text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth_event() is not null
     and auth_division() is not null
     and row_event    = auth_event()
     and row_division = auth_division();
$$;

-- ------------------------------------------------------------------
-- H1 + H2 — tasks.
-- ------------------------------------------------------------------
drop policy if exists "tasks_insert" on tasks;
create policy "tasks_insert" on tasks for insert to authenticated with check (
  auth_role() = 'admin'
  or (auth_role() = 'coordinator' and owns_scope(event_id, division))
);

drop policy if exists "tasks_update" on tasks;
create policy "tasks_update" on tasks for update to authenticated
using (
  auth_role() = 'admin'
  or (auth_role() in ('coordinator','staff','intern') and owns_scope(event_id, division))
)
with check (
  auth_role() = 'admin'
  or (auth_role() in ('coordinator','staff','intern') and owns_scope(event_id, division))
);

-- H2: staff/intern may only move a task's progress. RLS cannot say "these
-- columns only", so express it as a GRANT. Coordinators and admins go through
-- the same grant but are unrestricted by the app; if you need them to edit more
-- columns than this via PostgREST, widen the list here deliberately.
revoke update on public.tasks from authenticated, anon;
grant update (status, result, pic, title, notes, start_date, end_date, division, no)
  on public.tasks to authenticated;

drop policy if exists "tasks_delete" on tasks;
create policy "tasks_delete" on tasks for delete to authenticated using (
  auth_role() = 'admin'
  or (auth_role() = 'coordinator' and owns_scope(event_id, division))
);

-- ------------------------------------------------------------------
-- H3 — budget: admin, or a coordinator of that Ormawa Visit.
-- ------------------------------------------------------------------
drop policy if exists "budget_plans_write" on budget_plans;
create policy "budget_plans_write" on budget_plans for all to authenticated
using (
  auth_role() = 'admin'
  or (auth_role() = 'coordinator' and event_id = auth_event())
)
with check (
  auth_role() = 'admin'
  or (auth_role() = 'coordinator' and event_id = auth_event())
);

drop policy if exists "budget_items_write" on budget_items;
create policy "budget_items_write" on budget_items for all to authenticated
using (
  auth_role() = 'admin'
  or (auth_role() = 'coordinator' and exists (
        select 1 from budget_plans p
         where p.id = budget_items.plan_id and p.event_id = auth_event()))
)
with check (
  auth_role() = 'admin'
  or (auth_role() = 'coordinator' and exists (
        select 1 from budget_plans p
         where p.id = budget_items.plan_id and p.event_id = auth_event()))
);

-- ------------------------------------------------------------------
-- H3 — rundown / job_harih / teams: admin, or coordinator of that edition.
-- ------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['rundown','job_harih','teams']
  loop
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format($p$create policy "%s_write" on %I for all to authenticated
      using (auth_role() = 'admin'
             or (auth_role() = 'coordinator' and event_id = auth_event()))
      with check (auth_role() = 'admin'
             or (auth_role() = 'coordinator' and event_id = auth_event()));$p$, t, t);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- Anonymous guests are READ-ONLY everywhere. 0016 aligned the read policies
-- but left every write policy relying on auth_role() alone — and a guest's
-- auto-created profile row carries a real role value. Deny writes outright.
-- ------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['divisions','events','members','tasks','prospects','links',
                           'budget_plans','budget_items','rundown','job_harih','faqs',
                           'teams','backups','profiles']
  loop
    -- Split by command: a restrictive FOR ALL policy would apply its USING
    -- clause to SELECT and DELETE too, which would either break guest reads
    -- (using = not is_anon()) or leave DELETE open (using = true, since DELETE
    -- ignores WITH CHECK). Insert/update are gated by WITH CHECK, delete by USING.
    execute format('drop policy if exists "%s_no_anon_write" on %I;', t, t);
    execute format('drop policy if exists "%s_no_anon_insert" on %I;', t, t);
    execute format('drop policy if exists "%s_no_anon_update" on %I;', t, t);
    execute format('drop policy if exists "%s_no_anon_delete" on %I;', t, t);
    execute format($p$create policy "%s_no_anon_insert" on %I as restrictive
      for insert to authenticated with check (not is_anon());$p$, t, t);
    execute format($p$create policy "%s_no_anon_update" on %I as restrictive
      for update to authenticated using (not is_anon()) with check (not is_anon());$p$, t, t);
    execute format($p$create policy "%s_no_anon_delete" on %I as restrictive
      for delete to authenticated using (not is_anon());$p$, t, t);
  end loop;
end $$;

commit;
