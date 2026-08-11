-- ============================================================
-- 0026 - Restore the event-scoped task policies, and stop them locking
-- non-admins out. Run AFTER 0020–0025.
--
-- Why this exists:
--  * 0020 hardened tasks to (event_id, division) via owns_scope().
--  * The old 0021 dropped those policies for plain role checks. Applied in
--    filename order it ran last, so it silently reverted the hardening.
--    0021 is now a no-op; this file re-asserts the correct end state, so the
--    result is the same whether or not you ever ran the old 0021.
--
--  * owns_scope() FAILS CLOSED: it returns false when profiles.event_id or
--    profiles.division is null. That is the right default, but it means every
--    coordinator/staff/intern whose profile isn't scoped yet loses task writes
--    ("permission denied for table tasks" / a change that silently does
--    nothing). The backfill below gives them a scope so that does not happen.
-- ============================================================
begin;

-- ------------------------------------------------------------------
-- 1) Backfill profiles.event_id for anyone who still has no scope.
--    Target = the active Ormawa Visit, else the newest by order.
-- ------------------------------------------------------------------
update profiles
set event_id = coalesce(
  (select id from events where status = 'active' order by "order" desc limit 1),
  (select id from events order by "order" desc limit 1)
)
where event_id is null
  and role in ('coordinator', 'staff', 'intern');

-- ------------------------------------------------------------------
-- 2) Re-assert the strict, event-scoped task policies (same as 0020).
--    Idempotent: safe whether or not the old 0021 ever ran.
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

drop policy if exists "tasks_delete" on tasks;
create policy "tasks_delete" on tasks for delete to authenticated using (
  auth_role() = 'admin'
  or (auth_role() = 'coordinator' and owns_scope(event_id, division))
);

-- Column grants from 0020's H2 (re-applied; `grant` is idempotent).
revoke update on public.tasks from authenticated, anon;
grant update (status, result, pic, title, notes, start_date, end_date, division, no)
  on public.tasks to authenticated;

commit;

-- ------------------------------------------------------------------
-- 3) Verify. Any row returned here is an account that STILL cannot write
--    tasks (no division and/or no event scope). Fix those by setting
--    profiles.division / profiles.event_id for that user.
-- ------------------------------------------------------------------
select id, name, email, role, division, event_id
from profiles
where role in ('coordinator', 'staff', 'intern')
  and (division is null or event_id is null);
