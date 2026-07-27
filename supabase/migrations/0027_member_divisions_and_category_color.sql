-- ============================================================
-- 0027 — Members may belong to MORE THAN ONE division, and budget categories
--        get their own colour.
--
-- Run AFTER 0026. Idempotent: safe to re-run.
--
-- Part A. members.divisions (text[])
--   The division team structure shown on each division card is now DERIVED
--   from the member roster instead of being typed a second time into
--   teams.fungsionaris / teams.intern. So the member rows must carry every
--   division a person is in — backfilled here from (1) the existing single
--   `division` column and (2) the names already listed on the team rows.
--   `members.division` is KEPT as the primary division (= divisions[1]) so
--   older readers (badges, task PIC scoping, seeds) keep working.
--
-- Part B. budget_items.category_color
--   The little dot in front of a budget category is now user-choosable. It's
--   stored per item but written to every item of the same plan+category, so a
--   category always shows one colour.
-- ============================================================
begin;

-- ---------------- Part A ----------------
alter table public.members
  add column if not exists divisions text[] not null default '{}';

-- (1) Seed the array from the single division column.
update public.members
set divisions = array[division]
where divisions = '{}'
  and division is not null
  and btrim(division) <> '';

-- (2) Fold in the rosters that were typed onto the team rows. Team rosters are
--     comma-joined display names (nickname, else full name), so match on
--     either, case-insensitively, within the SAME Ormawa Visit.
with tokens as (
  select
    t.event_id,
    t.division,
    lower(btrim(tok)) as tok
  from public.teams t
  cross join lateral unnest(
    string_to_array(
      concat_ws(',',
        nullif(t.coordinator, ''),
        nullif(t.fungsionaris, ''),
        nullif(t.intern, '')
      ), ','
    )
  ) as tok
  where btrim(tok) <> ''
),
matched as (
  select distinct m.id as member_id, tk.division
  from tokens tk
  join public.members m
    on m.event_id is not distinct from tk.event_id
   and (lower(btrim(m.nickname)) = tk.tok or lower(btrim(m.name)) = tk.tok)
),
merged as (
  select member_id, array_agg(distinct division) as divs
  from matched
  group by member_id
)
update public.members m
set divisions = (
  select array_agg(distinct d)
  from unnest(m.divisions || merged.divs) as d
  where d is not null and btrim(d) <> ''
)
from merged
where merged.member_id = m.id;

-- (3) Keep the legacy primary column consistent with the array.
update public.members
set division = divisions[1]
where array_length(divisions, 1) >= 1
  and (division is null or btrim(division) = '' or division <> divisions[1]);

create index if not exists members_divisions_idx on public.members using gin (divisions);

-- Column-level grants mirror the ones the hardening migrations set for the
-- other member columns; `divisions` must be writable wherever `division` is.
do $$
begin
  if exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'members'
      and column_name = 'division' and privilege_type = 'UPDATE'
      and grantee = 'authenticated'
  ) then
    execute 'grant update (divisions) on public.members to authenticated';
  end if;
end $$;

-- ---------------- Part B ----------------
alter table public.budget_items
  add column if not exists category_color text;

alter table public.budget_items
  drop constraint if exists budget_items_category_color_hex;
alter table public.budget_items
  add constraint budget_items_category_color_hex
  check (category_color is null or category_color ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$');

commit;

-- Verify (optional): members that still have no division at all.
-- select id, name, nickname, event_id from public.members
-- where coalesce(array_length(divisions, 1), 0) = 0;
