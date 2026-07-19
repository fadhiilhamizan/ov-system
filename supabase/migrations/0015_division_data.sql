-- ============================================================
-- Division data fixes:
--  - Coordinator's abbreviation exceeded 4 letters (COORD -> CORD).
--  - PIC, Coordinator, Secretary, Treasurer are structural roles that don't
--    have a slot in the event-day rundown, so exclude them from it.
-- ============================================================
update divisions set short = 'CORD' where key = 'COORDINATOR';

update divisions set exclude_from_rundown = true
where key in ('PIC', 'COORDINATOR', 'SECRETARY', 'TREASURER');
