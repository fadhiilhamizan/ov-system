-- ============================================================
-- 0018 — Divisions become per-Ormawa-Visit; members roster assigned to an OV.
--
-- Until now `divisions` was ONE global set (key = global primary key) shared by
-- every OV, and the legacy member roster had no event_id (leaked into every OV).
-- This migration:
--   1. Gives divisions a surrogate id + event_id; `key` is now unique WITHIN an
--      event (each OV can have its own "EVENT"/"LO"/… with different names).
--   2. Clones the current shared divisions into EVERY existing OV, so each OV's
--      existing tasks/teams keep resolving their division by (event_id, key).
--   3. Assigns the unscoped member roster to the OLDEST OV.
--
-- The FKs tasks.division / members.division / teams.division are dropped: a
-- division key can now repeat across events, so those become soft references
-- resolved in-app by (event_id, key).
--
-- Fully idempotent + transactional: safe to re-run, and safe to re-run after a
-- partially-applied earlier attempt. Run after 0001–0017.
-- ============================================================
begin;

-- 1) New columns (existing rows get an id via the default).
alter table divisions add column if not exists id uuid default gen_random_uuid();
alter table divisions add column if not exists event_id text;

-- 2) Drop soft-reference FKs so a key can repeat per event.
alter table tasks   drop constraint if exists tasks_division_fkey;
alter table members drop constraint if exists members_division_fkey;
alter table teams   drop constraint if exists teams_division_fkey;

-- 3) Drop the OLD primary key on (key) BEFORE cloning — otherwise inserting the
--    same key for multiple events violates it. (This was the bug in the first cut.)
alter table divisions drop constraint if exists divisions_pkey;

-- 4) Clone the current shared divisions into every existing event.
insert into divisions (id, event_id, key, name, short, color, "order", exclude_from_rundown)
select gen_random_uuid(), e.id, d.key, d.name, d.short, d.color, d."order", coalesce(d.exclude_from_rundown, false)
from divisions d
cross join events e
where d.event_id is null;

-- 5) Remove the now-cloned global rows.
delete from divisions where event_id is null;

-- 6) New surrogate PK + per-event uniqueness (drop-then-add so re-runs are safe).
alter table divisions alter column id set not null;
alter table divisions add primary key (id);
alter table divisions alter column event_id set not null;
alter table divisions drop constraint if exists divisions_event_fkey;
alter table divisions add constraint divisions_event_fkey
  foreign key (event_id) references events(id) on delete cascade;
alter table divisions drop constraint if exists divisions_event_key_uniq;
alter table divisions add constraint divisions_event_key_uniq unique (event_id, key);
create index if not exists divisions_event_idx on divisions(event_id);

-- 7) Assign the unscoped member roster to the OLDEST Ormawa Visit.
update members
set event_id = (select id from events order by "order" asc, id asc limit 1)
where event_id is null;

commit;
