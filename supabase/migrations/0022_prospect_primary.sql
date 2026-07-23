-- ============================================================
-- 0022 — Prospect mode + "primary" prospect per Ormawa Visit.
--
-- A prospect can be marked as the OV's PRIMARY (the confirmed partner). The OV
-- then pulls partner/campus/location/mode from it. Only ONE primary per event.
-- Run after 0001-0021.
-- ============================================================
begin;

-- Mode is its own field now (was crammed into `location` as free text).
alter table prospects add column if not exists mode text;
alter table prospects add column if not exists is_primary boolean not null default false;

-- At most one primary prospect per event.
create unique index if not exists prospects_primary_uniq
  on prospects(event_id) where is_primary;

commit;
