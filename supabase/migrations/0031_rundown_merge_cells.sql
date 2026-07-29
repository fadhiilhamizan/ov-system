-- ============================================================
-- 0031 — Gabung sel (merge) pada kolom rundown.
--
-- Sebuah divisi sering melakukan hal yang SAMA sepanjang beberapa slot waktu
-- berturut-turut. Tanpa merge, teksnya harus diulang di tiap baris dan
-- konteksnya hilang: pembaca tidak bisa membedakan "tiga kegiatan kebetulan
-- sama" dari "satu kegiatan yang berjalan tiga slot".
--
-- Model penyimpanan = rowspan HTML, disimpan di baris PALING ATAS:
--   merges = { "MC": 3 }  berarti sel MC baris ini membentang 3 baris
--   (dirinya sendiri + 2 baris di bawahnya). Baris yang tertutup tidak
--   menyimpan apa pun — nilainya diambil dari baris asal.
--
-- Kunci yang dipakai: 'mc', 'operator', dan key divisi (mis. 'EVENT').
-- Kolom Catatan sengaja TIDAK bisa digabung: isinya spesifik per baris.
--
-- Jalankan SETELAH 0030. Idempotent dan non-destruktif.
-- ============================================================

begin;

alter table rundown add column if not exists merges jsonb not null default '{}'::jsonb;

comment on column rundown.merges is
  'Rowspan per kolom, disimpan di baris teratas: {"mc":3} = sel MC membentang 3 baris.';

-- jsonb, bukan json: butuh perbandingan dan operator objek, dan urutan kunci
-- tidak penting di sini.
alter table rundown drop constraint if exists rundown_merges_object;
alter table rundown add constraint rundown_merges_object
  check (jsonb_typeof(merges) = 'object');

commit;
