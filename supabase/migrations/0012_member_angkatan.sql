-- ============================================================
-- Derive each member's angkatan (year) from their NRP.
-- ITS NRP format: DDDD YY SSSS — a 4-digit study-program code, a 2-digit
-- enrollment year, then a running number. Example: 5026(23)1128 -> 2023.
-- Only rows whose NRP has at least 6 digits are updated.
-- ============================================================
update members
set year = 2000 + substring(regexp_replace(nrp, '\D', '', 'g') from 5 for 2)::int
where nrp is not null
  and length(regexp_replace(nrp, '\D', '', 'g')) >= 6
  and substring(regexp_replace(nrp, '\D', '', 'g') from 5 for 2) ~ '^\d{2}$';
