-- ============================================================
-- Super Link now requires every entry to have a real URL.
-- Delete rows that never had one (legacy placeholder/title-only rows).
-- ============================================================
delete from links where url is null or url = '' or url !~* '^https?://';

-- Enforce the rule at the database level too.
alter table links drop constraint if exists links_url_required;
alter table links add constraint links_url_required check (url ~* '^https?://');
