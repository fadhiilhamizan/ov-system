-- ============================================================
-- 0051 - Menghapus sebuah Ormawa Visit ikut menghapus SEMUA datanya.
--
-- MASALAHNYA: empat tabel menunjuk ke `events` dengan ON DELETE SET NULL,
-- yaitu members, links (Super Link), prospects (Reach & Offer) dan
-- budget_plans (RAB). Tabel lain (divisions, tasks, rundown, job_harih, teams,
-- fgd_plans, compare_*) sudah CASCADE. Akibatnya, menghapus satu edisi tidak
-- menghapus anggota, prospek dan tautannya, melainkan membuat event_id-nya
-- NULL. Sementara itu aplikasi membaca baris ber-event_id NULL sebagai "milik
-- semua edisi" (itu pola lama untuk data warisan sebelum 0005/0010). Jadi
-- seluruh roster, daftar prospek dan Super Link edisi yang dihapus tiba-tiba
-- muncul di SETIAP Ormawa Visit lain. Rencana anggarannya tidak muncul di mana
-- pun (RAB dibaca dengan filter ketat), tapi tetap tersimpan sebagai sampah.
--
-- PERBAIKANNYA: keempat kunci asing itu diganti ON DELETE CASCADE, sama
-- dengan tabel edisi lainnya. Aplikasi (repo.deleteEvent) juga menghapusnya
-- secara eksplisit, supaya proyek Demo yang tidak menjalankan migrasi ini
-- tetap benar; migrasi ini adalah jaminan di sisi database untuk jalur yang
-- tidak lewat aplikasi.
--
-- Baris yang SUDAH terlanjur ber-event_id NULL tidak disentuh: database tidak
-- bisa membedakan sisa penghapusan edisi dari data warisan yang memang sengaja
-- tanpa edisi. Query verifikasi di akhir menghitungnya supaya bisa diperiksa
-- dan dibereskan manual kalau perlu.
--
-- Aman dijalankan berulang. Jalankan SETELAH 0050.
-- ============================================================

begin;

-- Untuk tiap tabel: buang kunci asing ke events yang BUKAN cascade, lalu
-- pasang yang cascade kalau belum ada. Nama constraint dicari dari katalog,
-- bukan ditebak, karena kolomnya pernah ditambahkan lewat dua jalur berbeda.
do $do$
declare
  t text;
  c text;
begin
  foreach t in array array['members', 'links', 'prospects', 'budget_plans'] loop
    for c in
      select con.conname
        from pg_constraint con
       where con.conrelid = format('public.%I', t)::regclass
         and con.contype = 'f'
         and con.confrelid = 'public.events'::regclass
         and con.confdeltype <> 'c'
    loop
      execute format('alter table public.%I drop constraint %I', t, c);
    end loop;

    if not exists (
      select 1
        from pg_constraint con
       where con.conrelid = format('public.%I', t)::regclass
         and con.contype = 'f'
         and con.confrelid = 'public.events'::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (event_id) references public.events(id) on delete cascade',
        t, t || '_event_id_fkey');
    end if;
  end loop;
end
$do$;

commit;

-- Verifikasi: keempatnya harus `true`, lalu hitungan baris tanpa edisi.
select
  (select confdeltype = 'c' from pg_constraint
    where conrelid = 'public.members'::regclass and contype = 'f'
      and confrelid = 'public.events'::regclass)      as members_cascade,
  (select confdeltype = 'c' from pg_constraint
    where conrelid = 'public.links'::regclass and contype = 'f'
      and confrelid = 'public.events'::regclass)      as links_cascade,
  (select confdeltype = 'c' from pg_constraint
    where conrelid = 'public.prospects'::regclass and contype = 'f'
      and confrelid = 'public.events'::regclass)      as prospects_cascade,
  (select confdeltype = 'c' from pg_constraint
    where conrelid = 'public.budget_plans'::regclass and contype = 'f'
      and confrelid = 'public.events'::regclass)      as budget_plans_cascade,
  (select count(*) from members where event_id is null)      as anggota_tanpa_edisi,
  (select count(*) from links where event_id is null)        as tautan_tanpa_edisi,
  (select count(*) from prospects where event_id is null)    as prospek_tanpa_edisi,
  (select count(*) from budget_plans where event_id is null) as rab_tanpa_edisi;
