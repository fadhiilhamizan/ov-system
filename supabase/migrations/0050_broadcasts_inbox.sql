-- ============================================================
-- 0050 - Kotak Masuk (Inbox) per akun + siaran (broadcast) dari admin.
--
-- BENTUKNYA: induk + penerima, bukan satu baris per orang yang isinya
-- digandakan. `broadcasts` menyimpan ISI pesan sekali saja, dan
-- `broadcast_recipients` menyimpan SATU baris per akun penerima, sekaligus
-- menjadi tempat menandai sudah dibaca. Konsekuensinya disengaja:
--   * mengedit siaran cukup mengubah satu baris induk, tidak perlu menyentuh
--     ratusan salinan yang bisa gagal separuh jalan;
--   * menghapus siaran ikut menghapus penerimanya lewat ON DELETE CASCADE;
--   * status dibaca/belum dibaca melekat pada penerimanya, bukan pada isinya.
--
-- DAFTAR PENERIMA DIBEKUKAN SAAT KIRIM. "Kirim ke seluruh akun" diterjemahkan
-- jadi baris penerima untuk tiap akun yang ada SAAT ITU. Akun yang mendaftar
-- besok tidak ikut menerima siaran kemarin. Ini pilihan, bukan kelalaian:
-- siaran adalah peristiwa pada satu waktu, dan aturan yang dievaluasi saat
-- BACA akan membuat isi kotak masuk seseorang berubah sendiri ketika perannya
-- diubah admin, termasuk memunculkan pesan lama yang tidak pernah ditujukan
-- kepadanya. Admin tetap bisa mengedit siaran dan memilih ulang penerimanya.
--
-- KENAPA user_id / created_by TEXT, BUKAN uuid REFERENCES auth.users:
-- alasannya sama persis dengan task_comments (0049). Mode Demo berjalan tanpa
-- auth dan id-nya bukan uuid, dan tabel ini ikut di-backup - kunci asing ke
-- akun yang sudah dihapus akan menggagalkan seluruh restore.
--
-- TIDAK BERLINGKUP EDISI. Sebuah siaran ditujukan ke AKUN, dan akun tidak
-- terikat Ormawa Visit mana pun (lihat AGENTS.md). Jadi tidak ada event_id di
-- sini dan tidak ada klausa writable_event di policy-nya; scripts/test-sql.mjs
-- mencatatnya sebagai pengecualian beserta alasannya.
--
-- Aman dijalankan berulang. Jalankan SETELAH 0049.
-- ============================================================

begin;

create table if not exists broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  -- 'all'      : seluruh akun yang ada saat dikirim
  -- 'role'     : semua akun dengan peran tertentu (kolom roles)
  -- 'accounts' : akun-akun tertentu, termasuk kasus "hanya satu akun"
  audience text not null default 'all' check (audience in ('all', 'role', 'accounts')),
  roles text[] not null default '{}',
  created_by text not null default '',
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references broadcasts(id) on delete cascade,
  user_id text not null,
  -- null = belum dibaca. Inilah yang dihitung jadi angka notifikasi di menu.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Satu akun tidak boleh menerima siaran yang sama dua kali. Tanpa ini, mengedit
-- penerima lalu menyimpan ulang akan menumpuk salinan di kotak masuk orang yang
-- sama, dan angka notifikasinya ikut salah.
create unique index if not exists broadcast_recipients_uniq
  on broadcast_recipients(broadcast_id, user_id);
create index if not exists broadcast_recipients_user_idx
  on broadcast_recipients(user_id, read_at);
create index if not exists broadcasts_created_idx on broadcasts(created_at desc);

alter table broadcasts enable row level security;
alter table broadcast_recipients enable row level security;

-- ------------------------------------------------------------------
-- Baca. TIDAK memakai pola "cukup punya sesi" seperti tabel operasional:
-- sebuah siaran boleh dibaca oleh admin (yang mengirimnya) dan oleh orang yang
-- benar-benar dikirimi. Kalau tidak, siaran "hanya untuk satu akun" akan
-- terbaca semua orang lewat PostgREST, dan seluruh gunanya hilang.
-- ------------------------------------------------------------------
drop policy if exists broadcasts_read on broadcasts;
create policy broadcasts_read on broadcasts for select to authenticated
  using (
    auth_role() = 'admin'
    or exists (
      select 1 from broadcast_recipients r
       where r.broadcast_id = broadcasts.id
         and r.user_id = auth.uid()::text
    )
  );

drop policy if exists broadcast_recipients_read on broadcast_recipients;
create policy broadcast_recipients_read on broadcast_recipients for select to authenticated
  using (user_id = auth.uid()::text or auth_role() = 'admin');

-- ------------------------------------------------------------------
-- Tulis. Menyiarkan adalah hak admin saja, dan itu ditegakkan di sini juga,
-- bukan cuma oleh can.* di aplikasi.
-- ------------------------------------------------------------------
drop policy if exists broadcasts_insert on broadcasts;
drop policy if exists broadcasts_update on broadcasts;
drop policy if exists broadcasts_delete on broadcasts;
create policy broadcasts_insert on broadcasts for insert to authenticated
  with check (auth_role() = 'admin');
create policy broadcasts_update on broadcasts for update to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
create policy broadcasts_delete on broadcasts for delete to authenticated
  using (auth_role() = 'admin');

drop policy if exists broadcast_recipients_insert on broadcast_recipients;
drop policy if exists broadcast_recipients_update on broadcast_recipients;
drop policy if exists broadcast_recipients_delete on broadcast_recipients;
create policy broadcast_recipients_insert on broadcast_recipients for insert to authenticated
  with check (auth_role() = 'admin');
create policy broadcast_recipients_delete on broadcast_recipients for delete to authenticated
  using (auth_role() = 'admin');
-- Penerima menandai pesannya sendiri sudah dibaca, jadi UPDATE terbuka untuk
-- pemilik barisnya. Yang membatasi dia hanya boleh menyentuh `read_at` adalah
-- GRANT per-kolom di bawah, pola yang sama dengan profiles di 0020.
create policy broadcast_recipients_update on broadcast_recipients for update to authenticated
  using (user_id = auth.uid()::text or auth_role() = 'admin')
  with check (user_id = auth.uid()::text or auth_role() = 'admin');

revoke update on broadcast_recipients from authenticated;
grant update (read_at) on broadcast_recipients to authenticated;

commit;
