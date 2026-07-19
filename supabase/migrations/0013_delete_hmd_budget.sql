-- ============================================================
-- Remove the incorrect budget (RAB) data for the Ormawa Visit
-- 'HMSI ITS x HMD Eksternal' (event id ov2-2026). All of its plans were
-- planning-stage estimates entered wrongly, so they are deleted entirely.
-- budget_items cascade-delete via their plan_id FK.
-- ============================================================
delete from budget_items
where plan_id in (select id from budget_plans where event_id = 'ov2-2026');

delete from budget_plans where event_id = 'ov2-2026';
