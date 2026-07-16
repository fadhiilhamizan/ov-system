-- ============================================================
-- Row Level Security — mirrors the app's tiered RBAC.
-- ============================================================

-- Auto-create a profile when a new auth user signs up.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- Role helpers.
create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function auth_division() returns text
language sql stable security definer set search_path = public as $$
  select division from public.profiles where id = auth.uid();
$$;

-- Enable RLS everywhere.
alter table profiles       enable row level security;
alter table divisions      enable row level security;
alter table events         enable row level security;
alter table members        enable row level security;
alter table tasks          enable row level security;
alter table prospects      enable row level security;
alter table links          enable row level security;
alter table budget_plans   enable row level security;
alter table budget_items   enable row level security;
alter table rundown        enable row level security;
alter table job_harih      enable row level security;
alter table faqs           enable row level security;
alter table teams          enable row level security;

-- Everyone signed-in can read reference/operational data.
do $$
declare t text;
begin
  foreach t in array array['divisions','events','members','tasks','prospects','links',
                           'budget_plans','budget_items','rundown','job_harih','faqs','teams']
  loop
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('create policy "read_all" on %I for select using (auth.uid() is not null);', t);
  end loop;
end $$;

-- profiles: read all, update own (admins update anyone).
drop policy if exists "profiles_read" on profiles;
create policy "profiles_read" on profiles for select using (auth.uid() is not null);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid() or auth_role() = 'admin');

-- tasks: admin full; coordinator + staff + intern limited to their division; viewer read-only.
drop policy if exists "tasks_insert" on tasks;
create policy "tasks_insert" on tasks for insert with check (
  auth_role() = 'admin' or (auth_role() = 'coordinator' and division = auth_division())
);
drop policy if exists "tasks_update" on tasks;
create policy "tasks_update" on tasks for update using (
  auth_role() = 'admin'
  or (auth_role() = 'coordinator' and division = auth_division())
  or (auth_role() in ('staff','intern') and division = auth_division())
);
drop policy if exists "tasks_delete" on tasks;
create policy "tasks_delete" on tasks for delete using (
  auth_role() = 'admin' or (auth_role() = 'coordinator' and division = auth_division())
);

-- prospects & links: admin, coordinator, staff.
do $$
declare t text;
begin
  foreach t in array array['prospects','links']
  loop
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format($p$create policy "%s_write" on %I for all
      using (auth_role() in ('admin','coordinator','staff'))
      with check (auth_role() in ('admin','coordinator','staff'));$p$, t, t);
  end loop;
end $$;

-- budget: admin, coordinator.
do $$
declare t text;
begin
  foreach t in array array['budget_plans','budget_items']
  loop
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format($p$create policy "%s_write" on %I for all
      using (auth_role() in ('admin','coordinator'))
      with check (auth_role() in ('admin','coordinator'));$p$, t, t);
  end loop;
end $$;

-- editions/reference: admin only.
do $$
declare t text;
begin
  foreach t in array array['divisions','events','members','rundown','job_harih','faqs','teams']
  loop
    execute format('drop policy if exists "%s_admin_write" on %I;', t, t);
    execute format($p$create policy "%s_admin_write" on %I for all
      using (auth_role() = 'admin') with check (auth_role() = 'admin');$p$, t, t);
  end loop;
end $$;
