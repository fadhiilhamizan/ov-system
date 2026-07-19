-- ============================================================
-- Demo project ONLY: the demo runs with the anon key and NO login, so the
-- public anon role must be able to read AND write. This disables Row Level
-- Security on the app tables. NEVER run this on the production project.
-- ============================================================
alter table divisions disable row level security;
alter table events disable row level security;
alter table members disable row level security;
alter table tasks disable row level security;
alter table prospects disable row level security;
alter table links disable row level security;
alter table budget_plans disable row level security;
alter table budget_items disable row level security;
alter table rundown disable row level security;
alter table job_harih disable row level security;
alter table faqs disable row level security;
alter table teams disable row level security;
