-- ============================================================
-- Demo project ONLY: the demo runs with the anon key and NO login, so the
-- public anon role must be able to read AND write. This disables Row Level
-- Security on the app tables AND grants the anon role write access (Supabase
-- grants anon SELECT by default, so without this UPDATE/INSERT would fail with
-- "permission denied for table …"). NEVER run this on the production project.
-- ============================================================
do $$ begin if to_regclass('public.divisions') is not null then execute 'alter table public.divisions disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.events') is not null then execute 'alter table public.events disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.members') is not null then execute 'alter table public.members disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.tasks') is not null then execute 'alter table public.tasks disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.task_links') is not null then execute 'alter table public.task_links disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.task_refs') is not null then execute 'alter table public.task_refs disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.prospects') is not null then execute 'alter table public.prospects disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.prospect_links') is not null then execute 'alter table public.prospect_links disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.links') is not null then execute 'alter table public.links disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.budget_plans') is not null then execute 'alter table public.budget_plans disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.budget_items') is not null then execute 'alter table public.budget_items disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.rundown') is not null then execute 'alter table public.rundown disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.job_harih') is not null then execute 'alter table public.job_harih disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.faqs') is not null then execute 'alter table public.faqs disable row level security'; end if; end $$;
do $$ begin if to_regclass('public.teams') is not null then execute 'alter table public.teams disable row level security'; end if; end $$;

grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to anon;
