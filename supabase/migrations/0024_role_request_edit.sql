-- ============================================================
-- 0024 — Let an account edit its own PENDING role request, and allow
-- requests from accounts that already hold a role. Run AFTER 0023.
--
-- Two changes:
--  1. A pending request can be corrected (wrong role picked, typo in the note)
--     and resubmitted. Decided requests stay immutable — to change an approved
--     role you file a NEW request.
--  2. Requests are no longer only for role-less accounts: a staff member may
--     ask to become coordinator, or to be moved down to intern. `admin` is
--     still never requestable (the CHECK from 0023 covers that), so an admin
--     cannot be demoted through this flow.
-- ============================================================

begin;

-- The role a request targets applies to EVERY Ormawa Visit, so a request has no
-- event scope. The column is left in place (nullable, unused) rather than
-- dropped, so this migration is safe whether or not anything wrote to it.
comment on column role_requests.event_id is
  'Deprecated since 0024: roles are global, never scoped to one Ormawa Visit.';

-- Self-service edit, restricted to rows you own that are still pending.
-- USING picks the rows you may touch; WITH CHECK stops the update from
-- smuggling the row into another state (e.g. flipping status to 'approved',
-- or reassigning user_id).
drop policy if exists "role_requests_update_own_pending" on role_requests;
create policy "role_requests_update_own_pending" on role_requests for update
  to authenticated
  using (
    user_id = auth.uid()
    and status = 'pending'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  )
  with check (
    user_id = auth.uid()
    and status = 'pending'
  );

-- 0020's blanket anti-anon pass predates this table; 0023 added insert/delete
-- guards but not update, since there was no update path until now.
drop policy if exists "role_requests_no_anon_update" on role_requests;
create policy "role_requests_no_anon_update" on role_requests as restrictive
  for update to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

-- decide_role_request() is SECURITY DEFINER and therefore bypasses the
-- restrictive policy above; no change needed for the admin approve/ignore path.

commit;
