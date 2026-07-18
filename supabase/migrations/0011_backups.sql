-- ============================================================
-- Data backups: manual, scheduled (cron), and pre-restore safety
-- snapshots. Stores a full JSON snapshot of the app's mutable
-- tables so an admin can roll back if something goes wrong.
-- ============================================================
create table if not exists backups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('manual', 'auto', 'pre_restore')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists backups_created_at_idx on backups(created_at desc);

alter table backups enable row level security;

drop policy if exists "backups_admin_all" on backups;
create policy "backups_admin_all" on backups for all
  using (auth_role() = 'admin')
  with check (auth_role() = 'admin');
