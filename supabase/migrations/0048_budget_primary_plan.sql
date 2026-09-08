-- ============================================================
-- 0048 - Rencana anggaran UTAMA, satu per Ormawa Visit.
--
-- Dashboard menampilkan "Anggaran Edisi" dengan menjumlahkan SEMUA rencana milik
-- satu edisi. Itu salah membaca apa itu rencana: RAB Minimal dan RAB Maksimal
-- adalah dua SKENARIO untuk uang yang sama, bukan dua pos belanja yang berdiri
-- sendiri, jadi menjumlahkannya menghasilkan angka yang tidak pernah akan
-- dibelanjakan siapa pun. Satu rencana ditandai utama, dan itulah yang dibaca
-- Dashboard.
--
-- Pola yang sama persis dengan prospek utama di 0022: sebuah kolom boolean plus
-- partial unique index, sehingga "hanya boleh ada satu" ditegakkan DATABASE dan
-- bukan sekadar dijaga aplikasi.
--
-- Backfill memakai aturan yang sama dengan yang dipakai aplikasi saat sebuah
-- edisi belum menunjuk siapa pun: rencana dengan total terbesar yang menang.
-- Untuk data yang sudah ada itu tebakan yang paling mendekati, karena RAB
-- Maksimal memang yang biasanya dipegang saat pengajuan.
--
-- Run after 0001-0047.
-- ============================================================
begin;

alter table budget_plans add column if not exists is_primary boolean not null default false;

-- Paling banyak satu rencana utama per edisi. Partial index, jadi rencana yang
-- BUKAN utama tidak saling bertabrakan.
create unique index if not exists budget_plans_primary_uniq
  on budget_plans(event_id) where is_primary;

-- Backfill. Hanya menyentuh edisi yang BELUM punya rencana utama, jadi
-- menjalankan skrip ini dua kali tidak mengubah pilihan yang sudah dibuat.
-- `is not distinct from` dipakai supaya edisi ber-event_id NULL (rencana lama
-- yang edisinya sudah dihapus) tidak lolos lewat perbandingan NULL.
with ranked as (
  select p.id,
         row_number() over (
           partition by p.event_id
           order by coalesce(s.total, 0) desc, p.name asc, p.id asc
         ) as rn
    from budget_plans p
    left join (
      select plan_id, sum(coalesce(total, 0)) as total
        from budget_items
       group by plan_id
    ) s on s.plan_id = p.id
   where not exists (
     select 1 from budget_plans q
      where q.is_primary
        and q.event_id is not distinct from p.event_id
   )
)
update budget_plans b
   set is_primary = true
  from ranked r
 where b.id = r.id
   and r.rn = 1;

commit;
