-- ============================================================
-- Guest (read-only, no login) access + Ormawa Visit planning dates.
-- Run this after 0001 & 0002. Role value 'guest' is represented by the
-- existing 'viewer' enum value in the DB (the app maps viewer -> guest).
-- ============================================================

-- Planning date range + planned execution date for new Ormawa Visit.
alter table events add column if not exists plan_start date;
alter table events add column if not exists plan_end date;

-- Allow anonymous (guest bypass) to READ the viewable tables.
-- Budget (RAB) and Super Link stay restricted to signed-in users,
-- matching the access matrix (Tamu: tidak ada akses).
do $$
declare t text;
begin
  foreach t in array array['divisions','events','members','tasks','prospects',
                           'rundown','job_harih','faqs','teams']
  loop
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('drop policy if exists "read_public" on %I;', t);
    execute format('create policy "read_public" on %I for select using (true);', t);
  end loop;
end $$;

-- Budget & links: keep read restricted to authenticated users.
do $$
declare t text;
begin
  foreach t in array array['budget_plans','budget_items','links']
  loop
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('drop policy if exists "read_auth" on %I;', t);
    execute format('create policy "read_auth" on %I for select using (auth.uid() is not null);', t);
  end loop;
end $$;
