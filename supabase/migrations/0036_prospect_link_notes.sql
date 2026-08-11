-- ============================================================
-- Reach & Offer: tautan + catatan per prospek.
--
-- `link` menampung satu tautan milik himpunan yang dihubungi (handbook, profil
-- organisasi, proposal balasan). `notes` untuk catatan bebas.
--
-- `link_in_super_link` + `link_id` meniru pola task_links (0025): kalau
-- dicentang, tautannya juga ditulis sebagai entri Super Link, dan `link_id`
-- menyimpan baris mana yang dibuat supaya mengubah/menghapus tautan di prospek
-- ikut memperbarui Super Link, bukan meninggalkan entri yatim.
--
-- ON DELETE SET NULL: menghapus entri Super Link secara manual tidak boleh ikut
-- menghapus prospeknya.
-- ============================================================
alter table prospects add column if not exists link text default '';
alter table prospects add column if not exists link_label text default '';
alter table prospects add column if not exists notes text default '';
alter table prospects add column if not exists link_in_super_link boolean not null default false;
alter table prospects add column if not exists link_id uuid references links(id) on delete set null;

-- Satu baris Super Link hanya boleh dimiliki satu prospek, seperti task_links.
create unique index if not exists prospects_link_uniq on prospects(link_id) where link_id is not null;

-- Tidak ada grant kolom di sini: prospects memakai grant tingkat tabel, dan
-- kolom baru otomatis ikut tercakup. (profiles dan tasks yang punya grant per
-- kolom, karena keduanya pernah jadi jalan masuk celah keamanan.)
