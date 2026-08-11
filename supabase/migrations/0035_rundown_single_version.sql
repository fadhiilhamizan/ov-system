-- ============================================================
-- 0035 - Rundown jadi SATU versi (buang sisa 'variant B').
--
-- Dulu rundown punya dua versi berdampingan (A & B). Versi B dihapus dari UI
-- sejak v1.13.0, tapi baris datanya masih tertinggal di sebagian edisi - dan
-- halaman rundown menampilkan SEMUA baris tanpa menyaring variant, jadi tiap
-- kegiatan muncul dua kali. Itulah "duplikat rundown" yang terlihat.
--
-- Versi A adalah yang kanonik: aplikasi hanya pernah menulis 'A', dan di data
-- yang ada A selalu himpunan yang lebih lengkap. Migrasi ini:
--   1. Menaikkan B -> A HANYA untuk edisi yang sama sekali tidak punya baris A
--      (supaya edisi yang isinya kebetulan cuma di B tidak jadi kosong).
--   2. Menghapus semua sisa baris B.
--
-- Aman dijalankan berulang (idempotent) dan tiap statement berdiri sendiri.
-- Jalankan SETELAH 0034.
-- ============================================================

begin;

-- 1) Selamatkan edisi yang HANYA punya versi B: ubah jadi A.
update rundown b
set variant = 'A'
where b.variant = 'B'
  and not exists (
    select 1 from rundown a
    where a.event_id is not distinct from b.event_id and a.variant = 'A'
  );

-- 2) Buang sisa versi B (edisi yang juga punya A).
delete from rundown where variant = 'B';

commit;

-- ------------------------------------------------------------------
-- Laporan: jumlah baris rundown per edisi per variant setelah konsolidasi.
-- Kolom 'variant' harusnya semuanya 'A'.
-- ------------------------------------------------------------------
select coalesce(event_id, '(tanpa edisi)') as edisi, variant, count(*) as jumlah
from rundown
group by 1, 2
order by 1, 2;
