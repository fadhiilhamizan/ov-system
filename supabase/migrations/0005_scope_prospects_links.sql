-- ============================================================
-- Link Reach & Offer (prospects) and Super Link (links) to a
-- specific Ormawa Visit, then backfill existing rows by their
-- batch/section text so each menu can show only the selected OV.
-- ============================================================

alter table prospects add column if not exists event_id text references events(id) on delete set null;
alter table links add column if not exists event_id text references events(id) on delete set null;

create index if not exists prospects_event_idx on prospects(event_id);
create index if not exists links_event_idx on links(event_id);

-- Backfill prospects by batch name.
update prospects set event_id = 'ov2-2026' where event_id is null and batch ilike '%kedua 2026%';
update prospects set event_id = 'ov1-2026' where event_id is null and batch ilike '%pertama 2026%';
update prospects set event_id = 'ov1-2025' where event_id is null and batch ilike '%pertama 2025%';
update prospects set event_id = 'ov2-2025' where event_id is null and batch ilike '%kedua 2025%';

-- Backfill links by section name.
update links set event_id = 'ov1-2026' where event_id is null and (section ilike '%mei 2026%' or section ilike '%internal%');
update links set event_id = 'ov2-2026' where event_id is null and section ilike '%eksternal%';
update links set event_id = 'ov2-2025' where event_id is null and section ilike '%hmtg%';
update links set event_id = 'ov1-2025' where event_id is null and (section ilike '%himasta unair%' or section ilike '%2024%');
