-- ============================================================
-- Reach & Offer: banyak tautan per prospek.
--
-- 0036 memberi prospek SATU tautan (kolom `link`, `link_label`,
-- `link_in_super_link`, `link_id`). Kenyataannya satu himpunan sering mengirim
-- beberapa berkas sekaligus: handbook, profil organisasi, proposal balasan,
-- dan berkas balasan menyusul. Dengan satu kolom, menyimpan yang kedua berarti
-- menimpa yang pertama.
--
-- Bentuknya disamakan persis dengan `task_links` (0025) supaya perilakunya bisa
-- ditebak dan kodenya sejalan:
--   * `in_super_link` menandai tautan yang juga diterbitkan ke Super Link.
--   * `link_id` mengingat BARIS Super Link mana yang dimiliki tautan itu, jadi
--     menyimpan ulang MEMPERBARUI baris tersebut, bukan membuat duplikat.
--   * unique index pada link_id: satu baris Super Link hanya boleh dimiliki
--     satu tautan prospek.
--   * ON DELETE SET NULL: menghapus entri Super Link secara manual tidak ikut
--     menghapus tautan prospeknya, teks URL-nya tetap tersimpan.
--
-- Kolom lama di `prospects` TIDAK dihapus (biarkan seperti teams.fungsionaris):
-- baris lama tetap terbaca kalau ada yang perlu melihat riwayatnya, tapi
-- aplikasi berhenti membacanya setelah migrasi ini.
-- ============================================================

create table if not exists prospect_links (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  url text not null,
  label text default '',
  in_super_link boolean not null default false,
  link_id uuid references links(id) on delete set null,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists prospect_links_prospect_idx on prospect_links(prospect_id);
create index if not exists prospect_links_link_idx on prospect_links(link_id);
create unique index if not exists prospect_links_link_uniq
  on prospect_links(link_id) where link_id is not null;

alter table prospect_links enable row level security;

-- Baca: sama seperti tabel operasional lain, cukup punya sesi.
drop policy if exists prospect_links_read on prospect_links;
create policy prospect_links_read on prospect_links
  for select to authenticated using (auth.uid() is not null);

-- Tulis: mengikuti prospek induknya, bentuknya sama persis dengan task_links di
-- 0034. Dipecah per-verb (bukan FOR ALL) supaya tiap aturan bisa di-DROP dengan
-- namanya sendiri; policy permissive itu di-OR, jadi aturan lama yang tertinggal
-- akan menang. Itu persis celah yang dibayar 0034.
drop policy if exists prospect_links_write on prospect_links;
drop policy if exists prospect_links_insert on prospect_links;
drop policy if exists prospect_links_update on prospect_links;
drop policy if exists prospect_links_delete on prospect_links;
create policy prospect_links_insert on prospect_links for insert to authenticated
  with check (has_role()
    and writable_event((select p.event_id from prospects p where p.id = prospect_links.prospect_id)));
create policy prospect_links_update on prospect_links for update to authenticated
  using (has_role()
    and writable_event((select p.event_id from prospects p where p.id = prospect_links.prospect_id)))
  with check (has_role()
    and writable_event((select p.event_id from prospects p where p.id = prospect_links.prospect_id)));
create policy prospect_links_delete on prospect_links for delete to authenticated
  using (has_role()
    and writable_event((select p.event_id from prospects p where p.id = prospect_links.prospect_id)));

-- ------------------------------------------------------------------
-- Pindahkan tautan tunggal dari 0036 ke tabel baru.
--
-- Idempoten lewat `not exists`: kolom lamanya sengaja dibiarkan terisi, jadi
-- penjaga duplikasinya adalah baris prospect_links yang sudah ada, bukan
-- kolom yang sudah dikosongkan.
-- ------------------------------------------------------------------
insert into prospect_links (prospect_id, url, label, in_super_link, link_id, "order")
select p.id, btrim(p.link), coalesce(p.link_label, ''), coalesce(p.link_in_super_link, false), p.link_id, 0
from prospects p
where coalesce(btrim(p.link), '') <> ''
  and not exists (select 1 from prospect_links pl where pl.prospect_id = p.id);

-- Lepas kepemilikan baris Super Link dari prospects: sekarang prospect_links
-- yang memegangnya. Kalau keduanya mengaku pemilik, satu penyimpanan bisa
-- menghapus baris yang masih dipakai yang lain.
update prospects p
set link_id = null
where p.link_id is not null
  and exists (select 1 from prospect_links pl where pl.link_id = p.link_id);
