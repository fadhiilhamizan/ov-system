-- ============================================================
-- Remove legacy spreadsheet task IDs (source_id) and give every
-- task a clean sequential number within its (event, division).
-- ============================================================

-- Renumber: for each (event_id, division) group, order by existing
-- numeric "no" (nulls/non-numeric last, tie-broken by created_at),
-- then assign 1, 2, 3, ...
with ranked as (
  select
    id,
    row_number() over (
      partition by event_id, division
      order by
        case when no ~ '^\d+$' then no::int else null end nulls last,
        created_at
    ) as rn
  from tasks
)
update tasks
set no = ranked.rn::text
from ranked
where tasks.id = ranked.id;

-- Drop the legacy spreadsheet-ID column entirely.
alter table tasks drop column if exists source_id;

-- Same renumbering for Hari-H (job_harih), partitioned by event only.
with ranked_jobs as (
  select
    id,
    row_number() over (
      partition by event_id
      order by
        case when no ~ '^\d+$' then no::int else null end nulls last,
        id
    ) as rn
  from job_harih
)
update job_harih
set no = ranked_jobs.rn::text
from ranked_jobs
where job_harih.id = ranked_jobs.id;
