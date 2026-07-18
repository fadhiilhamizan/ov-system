-- ============================================================
-- Refresh FAQ for the web app (no longer spreadsheet-based).
-- Run this to replace the old FAQ content.
-- ============================================================
begin;
delete from faqs;

insert into faqs (question, answer, "order") values
('Apa itu Ormawa Visit?',
 'Ormawa Visit adalah kegiatan kunjungan antar Organisasi Mahasiswa untuk berbagi informasi, benchmarking sistem organisasi dan program kerja, memperluas relasi, serta membuka peluang kolaborasi antar himpunan.', 0),
('Berapa kali Ormawa Visit dalam satu kabinet?',
 'Untuk saat ini minimal 2 kali: satu ke himpunan di luar ITS dan satu ke himpunan dalam ITS. Jumlah ini bisa berubah.', 1),
('Divisi apa saja yang bekerja di Ormawa Visit?',
 'Liaison Officer, Event, Consumption, Operational, dan Creative. Tiap Ormawa Visit bisa punya susunan divisi yang sedikit berbeda.', 2),
('Apa itu FGD (Focus Group Discussion)?',
 'FGD adalah agenda kecil saat hari pelaksanaan yang memasangkan departemen HMSI dengan departemen himpunan partner yang mirip, untuk menjalin relasi serta bertukar insight.', 3),
('Apa itu Creative Corner?',
 'Media untuk peserta menuangkan sisi seninya saat acara. Peserta boleh menulis atau menggambar apa saja selama tidak mengandung SARA. Biasanya berupa papan tulis dengan spidol dan sticky notes.', 4),
('Bagaimana cara update status dan mengisi hasil tugasku?',
 'Buka menu Work Breakdown atau Divisi, cari tugasmu, lalu klik label status untuk mengubahnya. Untuk mengisi hasil, klik menu titik tiga pada tugas, pilih Edit, dan isi kolom Result. Hasil berupa link (Google Drive, Docs, foto) sangat disarankan.', 5),
('Peran apa saja yang ada di sistem ini?',
 'Admin/PIC (akses penuh), Koordinator (kelola divisi, tugas, rundown, anggaran), Staff dan Intern (update status & isi hasil tugasnya), serta Tamu (hanya melihat).', 6),
('Bagaimana cara fokus ke tugas divisiku saja?',
 'Gunakan dropdown "Fokus divisi" di kanan atas. Pilih divisimu untuk menyaring tampilan, atau pilih Semua Divisi untuk melihat semuanya.', 7),
('Bagaimana cara ganti Ormawa Visit yang sedang dilihat?',
 'Gunakan pemilih Ormawa Visit di kanan atas. Semua menu otomatis menampilkan data untuk Ormawa Visit yang kamu pilih saja.', 8),
('Aku menemukan bug atau punya saran, ke mana?',
 'Sampaikan langsung ke PIC Ormawa Visit. Masukan sangat diharapkan agar sistem terus membaik.', 9);

commit;
