-- ============================================================
-- 0016 — Security hardening + atomic numbering.
--
-- 1. Close the public read hole. 0003 created `read_public USING (true)`,
--    which let ANYONE with the (public) anon key read members (NRP = PII),
--    prospects, tasks, etc. with no session at all. We now require an
--    authenticated session; the app's guest mode signs in ANONYMOUSLY so
--    guests still read, but the tables are no longer world-readable via the
--    bare anon key.  ⚠️ Enable "Anonymous sign-ins" in Supabase Auth settings
--    before/with this migration, or the guest button won't load data.
-- 2. Keep budget & links hidden from guests (matrix: Tamu = no access) by
--    excluding anonymous sessions from their read policy.
-- 3. Align write policies with the app's RBAC (src/lib/permissions.ts):
--    - links: staff/intern may INSERT, only admin/coordinator UPDATE/DELETE.
--    - rundown/job_harih/teams: admin AND coordinator may write.
-- 4. Assign tasks.no / job_harih.no atomically (advisory-locked) so concurrent
--    inserts can't produce duplicate numbers.
-- Run after 0001–0015.
-- ============================================================

-- Is the current session an anonymous (guest) sign-in?
create or replace function is_anon() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- 1) Authenticated-only read for the operational tables (replaces read_public).
do $$
declare t text;
begin
  foreach t in array array['divisions','events','members','tasks','prospects',
                           'rundown','job_harih','faqs','teams']
  loop
    execute format('drop policy if exists "read_public" on %I;', t);
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('drop policy if exists "read_auth" on %I;', t);
    execute format('create policy "read_auth" on %I for select using (auth.uid() is not null);', t);
  end loop;
end $$;

-- 2) Budget & links: authenticated AND not a guest (anonymous) session.
do $$
declare t text;
begin
  foreach t in array array['budget_plans','budget_items','links']
  loop
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('drop policy if exists "read_auth" on %I;', t);
    execute format('create policy "read_auth" on %I for select using (auth.uid() is not null and not is_anon());', t);
  end loop;
end $$;

-- 3a) links: split the old "for all (admin,coordinator,staff)" into insert vs
--     update/delete so staff/intern can add but not edit/delete others' links.
drop policy if exists "links_write" on links;
drop policy if exists "links_insert" on links;
drop policy if exists "links_update" on links;
drop policy if exists "links_delete" on links;
create policy "links_insert" on links for insert
  with check (auth_role() in ('admin','coordinator','staff','intern'));
create policy "links_update" on links for update
  using (auth_role() in ('admin','coordinator'))
  with check (auth_role() in ('admin','coordinator'));
create policy "links_delete" on links for delete
  using (auth_role() in ('admin','coordinator'));

-- 3b) rundown / job_harih / teams: admin + coordinator (was admin-only, which
--     silently blocked coordinators the app UI says can manage these).
do $$
declare t text;
begin
  foreach t in array array['rundown','job_harih','teams']
  loop
    execute format('drop policy if exists "%s_admin_write" on %I;', t, t);
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format($p$create policy "%s_write" on %I for all
      using (auth_role() in ('admin','coordinator'))
      with check (auth_role() in ('admin','coordinator'));$p$, t, t);
  end loop;
end $$;

-- 4) Atomic per-scope numbering. Assign `no` only when the client leaves it
--    null/empty; an advisory lock serializes concurrent inserts in the same
--    scope so two rows can't compute the same number.
create or replace function assign_task_no() returns trigger
language plpgsql as $$
declare next_no int;
begin
  if NEW.no is null or NEW.no = '' then
    perform pg_advisory_xact_lock(hashtext(coalesce(NEW.event_id,'') || '|' || coalesce(NEW.division,'')));
    select coalesce(max(no::int), 0) + 1 into next_no
      from tasks
      where event_id = NEW.event_id and division = NEW.division and no ~ '^\d+$';
    NEW.no := next_no::text;
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_assign_task_no on tasks;
create trigger trg_assign_task_no before insert on tasks
  for each row execute function assign_task_no();

create or replace function assign_job_no() returns trigger
language plpgsql as $$
declare next_no int;
begin
  if NEW.no is null or NEW.no = '' then
    perform pg_advisory_xact_lock(hashtext('job|' || coalesce(NEW.event_id,'')));
    select coalesce(max(no::int), 0) + 1 into next_no
      from job_harih
      where event_id = NEW.event_id and no ~ '^\d+$';
    NEW.no := next_no::text;
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_assign_job_no on job_harih;
create trigger trg_assign_job_no before insert on job_harih
  for each row execute function assign_job_no();
