-- ============================================================
-- Scope members to a specific Ormawa Visit (different OV can have a
-- different committee). Existing members are left unscoped (NULL),
-- meaning they show up for every OV — matches how prospects/links
-- were scoped in migration 0005. New members added going forward
-- can be assigned to a specific event.
-- ============================================================
alter table members add column if not exists event_id text references events(id) on delete set null;
create index if not exists members_event_idx on members(event_id);
