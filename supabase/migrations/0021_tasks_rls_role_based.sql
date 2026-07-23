-- ============================================================
-- 0021 — Tasks write policy: role-based instead of division-scoped.
--
-- The old tasks_update/insert/delete policies required
-- `division = auth_division()` for coordinator/staff/intern. After divisions
-- became per-event (0018) and were reseeded (0019), a user's profile.division
-- no longer matches the task's division key, so RLS silently blocked every
-- non-admin task write — the "changing status does nothing" bug. It was also
-- STRICTER than the app's own rules (a staff/intern can update a task assigned
-- to them regardless of their profile division).
--
-- The fine-grained rules (per-division manage, PIC-assignment progress) are
-- already enforced in the server actions via can.* against the real task row,
-- so RLS here becomes a role gate (matches prospects/links/rundown/etc.).
-- Run after 0001-0020.
-- ============================================================
begin;

drop policy if exists "tasks_insert" on tasks;
drop policy if exists "tasks_update" on tasks;
drop policy if exists "tasks_delete" on tasks;

create policy "tasks_insert" on tasks for insert
  with check (auth_role() in ('admin','coordinator','staff','intern'));
create policy "tasks_update" on tasks for update
  using (auth_role() in ('admin','coordinator','staff','intern'))
  with check (auth_role() in ('admin','coordinator','staff','intern'));
create policy "tasks_delete" on tasks for delete
  using (auth_role() in ('admin','coordinator'));

commit;
