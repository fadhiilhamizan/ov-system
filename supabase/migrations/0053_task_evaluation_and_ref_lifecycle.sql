-- ============================================================
-- 0053 - Evaluasi tugas, hasil tugas selalu terbit di Super Link, dan
-- referensi yang sumber Super Link-nya dihapus.
--
-- EMPAT HAL, satu migrasi, karena keempatnya soal tugas di Work Breakdown:
--
-- 1. tasks.evaluation - kolom "Evaluasi" di sebelah kanan kolom Tugas:
--    pelajaran untuk tugas itu dari Ormawa Visit sebelumnya dan/atau yang
--    sekarang. Ikut tersalin saat tugas disalin ke edisi baru.
--
-- 2. task_refs.link_lost_at + trigger `links_release_refs`. Tugas A boleh
--    merujuk entri Super Link yang diterbitkan tugas B. Kalau B menghapus
--    tautan hasilnya (atau B sendiri dihapus), entrinya ikut hilang dan
--    kunci asing SET NULL diam-diam mengosongkan link_id di referensi A.
--    Alamatnya memang tersisa sebagai teks, tapi TIDAK ADA yang tahu bahwa
--    sumbernya sudah pergi, dan salinan alamat itu bisa sudah basi (A membaca
--    alamat terbaru langsung dari entrinya, bukan dari salinannya).
--    Trigger BEFORE DELETE ini jalan SEBELUM kunci asing bertindak: ia
--    menyalin alamat & judul terakhir entrinya ke referensi dan mencap
--    link_lost_at, sehingga aplikasi bisa menandainya dan menawarkan ganti.
--    SECURITY DEFINER karena yang menghapus entri (pemilik tugas B) belum tentu
--    boleh menulis referensi tugas A, misalnya kalau A ada di edisi yang
--    diarsipkan; yang ditulis hanya salinan milik entri yang memang sedang
--    dihapus.
--
-- 3. Referensi yang judulnya SAMA PERSIS dengan judul entrinya dikosongkan.
--    Judul kosong berarti "ikuti judul entrinya", jadi mengganti judul di
--    Super Link ikut mengganti nama referensinya. Judul yang sudah diubah
--    sendiri oleh pengguna tidak disentuh.
--
-- 4. Setiap tautan hasil tugas SEKARANG WAJIB terbit di Super Link dan wajib
--    berjudul. Tautan lama yang belum terbit dibuatkan entri Super Link-nya di
--    sini (judulnya: judul tautan, atau judul tugas kalau kosong - sama dengan
--    nama yang dulu dipakai saat terbit), supaya data lama patuh aturan yang
--    sama dengan data baru.
--
-- Aman dijalankan berulang. Jalankan SETELAH 0052.
-- ============================================================

begin;

-- ------------------------------------------------------------------
-- 1) Kolom baru.
-- ------------------------------------------------------------------
alter table public.tasks add column if not exists evaluation text default '';
alter table public.task_refs add column if not exists link_lost_at timestamptz;

-- ------------------------------------------------------------------
-- 2) Referensi mencatat hilangnya sumber Super Link-nya.
-- Alamat hanya disalin kalau berupa URL sungguhan (links_url_required sudah
-- menjaminnya, ini sekadar pagar), dan judul hanya diisi kalau referensinya
-- memang mengikuti judul entri (kosong).
-- ------------------------------------------------------------------
create or replace function public.release_link_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.task_refs
     set url = case when old.url ~* '^https?://' then old.url else url end,
         label = case when coalesce(btrim(label), '') = '' then coalesce(old.name, '') else label end,
         link_lost_at = coalesce(link_lost_at, now())
   where link_id = old.id;
  return old;
end
$fn$;

revoke all on function public.release_link_refs() from public;

drop trigger if exists links_release_refs on public.links;
create trigger links_release_refs
  before delete on public.links
  for each row execute function public.release_link_refs();

-- ------------------------------------------------------------------
-- 3) Referensi yang judulnya sama dengan entrinya: ikuti judul entrinya.
-- ------------------------------------------------------------------
update public.task_refs r
   set label = ''
  from public.links l
 where r.link_id = l.id
   and coalesce(btrim(r.label), '') <> ''
   and btrim(r.label) = btrim(l.name);

-- ------------------------------------------------------------------
-- 4) Semua tautan hasil tugas terbit di Super Link.
-- Satu baris per tautan yang belum punya entri: buat entrinya, lalu ingat
-- id-nya di link_id (itulah yang membuat simpan ulang MEMPERBARUI entri yang
-- sama, bukan menggandakannya).
-- ------------------------------------------------------------------
do $pub$
declare
  r record;
  new_id uuid;
begin
  for r in
    select tl.id,
           tl.url,
           coalesce(nullif(btrim(tl.label), ''), t.title) as name,
           t.title,
           t.event_id,
           coalesce(t.division, '') as division
      from public.task_links tl
      join public.tasks t on t.id = tl.task_id
     where tl.link_id is null
       and tl.url ~* '^https?://'
  loop
    insert into public.links (event_id, division, section, name, url, note, source)
    values (r.event_id, r.division, 'Hasil Tugas', r.name, r.url, r.title, 'task')
    returning id into new_id;

    update public.task_links
       set link_id = new_id, in_super_link = true, label = r.name
     where id = r.id;
  end loop;
end
$pub$;

-- Judul wajib: tautan yang sudah terbit tanpa judul memakai judul tugasnya,
-- persis nama yang selama ini tampil untuknya di Super Link.
update public.task_links tl
   set label = t.title, in_super_link = true
  from public.tasks t
 where t.id = tl.task_id
   and tl.link_id is not null
   and (coalesce(btrim(tl.label), '') = '' or not tl.in_super_link);

commit;

-- Periksa: berapa tautan hasil yang masih belum terbit (seharusnya 0, kecuali
-- baris lama yang alamatnya bukan http/https), dan berapa referensi yang kini
-- mengikuti judul entrinya.
select
  (select count(*) from public.task_links where link_id is null) as tautan_hasil_belum_terbit,
  (select count(*) from public.task_refs where link_id is not null and coalesce(label, '') = '') as referensi_ikut_judul_entri;
