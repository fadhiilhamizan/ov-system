-- ============================================================
-- Divisions: option to exclude a division from the rundown table.
-- Rundown: dynamic per-division activity columns (jsonb) + a dedicated
-- "Kebutuhan Operator" column. Backfills from the old fixed job_* columns.
-- ============================================================

alter table divisions add column if not exists exclude_from_rundown boolean not null default false;

alter table rundown add column if not exists division_jobs jsonb not null default '{}'::jsonb;
alter table rundown add column if not exists operator text default '';

-- Backfill division_jobs from the legacy fixed job_* columns (only non-empty).
update rundown set division_jobs = jsonb_strip_nulls(jsonb_build_object(
  'LO',          nullif(job_lo, ''),
  'EVENT',       nullif(job_event, ''),
  'CONSUMPTION', nullif(job_consump, ''),
  'CREATIVE',    nullif(job_creative, ''),
  'OPERATIONAL', nullif(job_opr, '')
))
where division_jobs = '{}'::jsonb;

-- Kebutuhan Operator was previously stored as opr_link.
update rundown set operator = opr_link
where (operator is null or operator = '') and opr_link is not null and opr_link <> '';
