-- ============================================================
-- Demo project ONLY: the demo runs with the anon key and NO login, so the
-- public anon role must be able to read AND write. This disables Row Level
-- Security on the app tables AND grants the anon role write access (Supabase
-- grants anon SELECT by default, so without this UPDATE/INSERT would fail with
-- "permission denied for table …"). NEVER run this on the production project.
-- ============================================================
alter table divisions disable row level security;
alter table events disable row level security;
alter table members disable row level security;
alter table tasks disable row level security;
alter table task_links disable row level security;
alter table prospects disable row level security;
alter table links disable row level security;
alter table budget_plans disable row level security;
alter table budget_items disable row level security;
alter table rundown disable row level security;
alter table job_harih disable row level security;
alter table faqs disable row level security;
alter table teams disable row level security;

grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to anon;
