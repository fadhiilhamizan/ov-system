-- ============================================================
-- 0029 - Performance Measurement per Ormawa Visit.
--
-- The numbers a committee reports back after the event: how many HMSI
-- functionaries turned up, how much feedback each side gave, the average star
-- rating from each side, and the link to the accountability report (LPJ).
--
-- Lives on `events` rather than in its own table: there is exactly one set of
-- these per edition, they are entered once from the Ormawa Visit form, and the
-- dashboard reads them alongside the rest of the edition's data.
--
-- Ratings are 0-5 with two decimals (e.g. 4.78). CHECK constraints keep an
-- impossible value out of the dashboard rather than trusting the form alone -
-- the app is not the only thing that can write here.
--
-- Run AFTER 0028. Idempotent and non-destructive.
-- ============================================================

begin;

alter table events add column if not exists attendance_hmsi int;
alter table events add column if not exists feedback_hmsi_count int;
alter table events add column if not exists feedback_hmsi_rating numeric(3, 2);
alter table events add column if not exists feedback_partner_count int;
alter table events add column if not exists feedback_partner_rating numeric(3, 2);
alter table events add column if not exists report_url text;

comment on column events.attendance_hmsi is
  'Jumlah fungsionaris HMSI yang hadir di hari pelaksanaan.';
comment on column events.feedback_hmsi_count is
  'Total feedback yang diberikan oleh HMSI.';
comment on column events.feedback_hmsi_rating is
  'Rata-rata penilaian feedback oleh HMSI, skala 0-5.';
comment on column events.feedback_partner_count is
  'Total feedback yang diberikan oleh himpunan partner.';
comment on column events.feedback_partner_rating is
  'Rata-rata penilaian feedback oleh himpunan partner, skala 0-5.';
comment on column events.report_url is
  'Tautan Laporan Pertanggung Jawaban (LPJ) edisi ini.';

-- Counts cannot be negative; ratings live on a 0-5 scale. NULL always means
-- "belum diisi" and is allowed everywhere.
alter table events drop constraint if exists events_attendance_hmsi_nonneg;
alter table events add constraint events_attendance_hmsi_nonneg
  check (attendance_hmsi is null or attendance_hmsi >= 0);

alter table events drop constraint if exists events_feedback_hmsi_count_nonneg;
alter table events add constraint events_feedback_hmsi_count_nonneg
  check (feedback_hmsi_count is null or feedback_hmsi_count >= 0);

alter table events drop constraint if exists events_feedback_partner_count_nonneg;
alter table events add constraint events_feedback_partner_count_nonneg
  check (feedback_partner_count is null or feedback_partner_count >= 0);

alter table events drop constraint if exists events_feedback_hmsi_rating_range;
alter table events add constraint events_feedback_hmsi_rating_range
  check (feedback_hmsi_rating is null or (feedback_hmsi_rating >= 0 and feedback_hmsi_rating <= 5));

alter table events drop constraint if exists events_feedback_partner_rating_range;
alter table events add constraint events_feedback_partner_rating_range
  check (feedback_partner_rating is null or (feedback_partner_rating >= 0 and feedback_partner_rating <= 5));

alter table events drop constraint if exists events_report_url_http;
alter table events add constraint events_report_url_http
  check (report_url is null or report_url = '' or report_url ~* '^https?://');

commit;
