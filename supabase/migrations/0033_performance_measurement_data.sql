-- ============================================================
-- 0033 — Isi Performance Measurement dari Main Sheet.
--
-- Sumber: "MAIN SHEET ORMAWA VISIT.xlsx", sheet WBS, blok
-- "PERFORMANCE MEASUREMENT" (baris 8-15):
--
--   Jumlah fungsionaris HMSI yang hadir      58 Peserta
--   Total feedback yang diberikan oleh HMSI  43 Responses
--   Rata rata penilaian feedback oleh HMSI   4.78 / 5.0
--   Total feedback yang diberikan oleh HMTG  39 Responses
--   Rata rata penilaian feedback oleh HMTG   4.92 / 5.0
--   Pertanggungjawaban                       https://bit.ly/FeedbackHMSIxHMTG
--
-- Blok ini ada di sheet HMSI ITS x HMTG ITS, jadi datanya milik ov2-2025.
-- Edisi 2026 belum terlaksana, sheet-nya belum punya blok ini — kolomnya
-- dibiarkan NULL dan Dashboard menampilkannya sebagai "—".
--
-- HANYA mengisi kolom yang masih kosong (`is null`). Kalau kamu sudah
-- memasukkan angka lewat menu Ormawa Visit, angka itu yang menang — migrasi ini
-- tidak akan menimpanya. Karena itu aman dijalankan berulang.
--
-- Jalankan SETELAH 0032.
-- ============================================================

begin;

update events
set attendance_hmsi         = coalesce(attendance_hmsi, 58),
    feedback_hmsi_count     = coalesce(feedback_hmsi_count, 43),
    feedback_hmsi_rating    = coalesce(feedback_hmsi_rating, 4.78),
    feedback_partner_count  = coalesce(feedback_partner_count, 39),
    feedback_partner_rating = coalesce(feedback_partner_rating, 4.92),
    report_url              = coalesce(nullif(report_url, ''), 'https://bit.ly/FeedbackHMSIxHMTG')
where id = 'ov2-2025';

commit;

-- ------------------------------------------------------------------
-- Laporan: Performance Measurement tiap Ormawa Visit setelah impor.
-- ------------------------------------------------------------------
select
  id                        as edisi,
  title,
  attendance_hmsi           as hadir,
  feedback_hmsi_count       as fb_hmsi,
  feedback_hmsi_rating      as rating_hmsi,
  feedback_partner_count    as fb_partner,
  feedback_partner_rating   as rating_partner,
  coalesce(report_url, '-') as lpj
from events
order by "order", id;
