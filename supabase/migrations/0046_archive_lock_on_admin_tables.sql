-- ============================================================
-- 0046 - Kunci arsip masuk ke policy tulis yang selama ini "admin saja".
--
-- Delapan tabel dapat satu policy polos:
--
--   create policy "<t>_write" on <t> for all to authenticated
--     using (auth_role() = 'admin' and not is_anon()) ...
--
-- tanpa writable_event(), sementara tabel modul "limited" (tasks, rundown,
-- job_harih, links, task_links, prospect_links, fgd_*, compare_*) semuanya
-- membawanya.
--
-- JUJUR SOAL DAMPAKNYA: hari ini ini TIDAK mengubah perilaku apa pun.
-- writable_event() berbunyi "admin, ATAU edisinya tidak terkunci", jadi bagi
-- satu-satunya peran yang lolos policy ini nilainya selalu true. Yang diperbaiki
-- adalah bentuknya, bukan sebuah lubang yang menganga.
--
-- Kenapa tetap dikerjakan: yang membuat kunci arsip menghilang bukan penyerang,
-- melainkan satu baris di MODULE_ACCESS_LEVEL. Begitu satu modul di sini naik
-- dari "admin saja" ke "limited" - persis yang terjadi pada Pengaturan, dan
-- persis yang dicatat AGENTS.md sebagai pelajaran - policy-nya ditulis ulang
-- dengan daftar peran baru, dan klausa yang tidak pernah ada di sana tidak akan
-- diingat siapa pun. Menaruhnya sekarang berarti perubahan peran berikutnya
-- hanya mengganti daftar perannya.
--
-- DUA dari delapan tabel itu ternyata memang tidak boleh ikut, dan npm run
-- db:test yang menemukannya:
--
--   * events - kolom `locked` ada DI tabel itu, jadi menjaga penulisan events
--     dengan writable_event(id) berarti mengunci pintu dari dalam. Itulah tabel
--     tempat admin MEMBUKA kunci arsip.
--   * faqs   - tidak punya event_id sama sekali. FAQ berlaku untuk seluruh
--     sistem, bukan milik satu Ormawa Visit, jadi tidak ada edisi untuk dikunci.
--
-- Keduanya tetap dipisah menjadi insert/update/delete supaya seluruh berkas ini
-- memakai satu bentuk, dan keduanya terdaftar sebagai pengecualian yang
-- DISENGAJA di pemeriksa struktural (scripts/test-sql.mjs), supaya "tidak punya
-- writable_event" harus dinyatakan, bukan sekadar terlewat.
--
-- budget_items tidak punya event_id sendiri; ia ikut rencana induknya, pola
-- yang sama dengan task_links dan prospect_links.
-- ============================================================

-- ---------- (A) lima tabel yang punya event_id sendiri -----------------------
do $do$
declare t text;
begin
  foreach t in array array['divisions', 'members', 'teams', 'prospects', 'budget_plans']
  loop
    -- DROP berdasarkan NAMA. Policy permissive di-OR-kan, jadi satu policy lama
    -- yang longgar dan dibiarkan hidup akan selalu menang atas yang baru - itu
    -- persis bagaimana task_links yang diarsipkan tetap bisa ditulis sampai
    -- 0034 (lihat AGENTS.md).
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format('drop policy if exists "%s_admin_write" on %I;', t, t);
    execute format('drop policy if exists "%s_insert" on %I;', t, t);
    execute format('drop policy if exists "%s_update" on %I;', t, t);
    execute format('drop policy if exists "%s_delete" on %I;', t, t);

    execute format($p$create policy "%s_insert" on %I for insert to authenticated
      with check (auth_role() = 'admin' and not is_anon()
                  and writable_event(event_id));$p$, t, t);

    -- WITH CHECK wajib ada di samping USING: USING memilih baris mana yang boleh
    -- disasar, WITH CHECK memeriksa bentuk baris SESUDAHNYA. Tanpa itu satu
    -- baris bisa dipindahkan ke Ormawa Visit terkunci dalam satu perintah.
    execute format($p$create policy "%s_update" on %I for update to authenticated
      using (auth_role() = 'admin' and not is_anon()
             and writable_event(event_id))
      with check (auth_role() = 'admin' and not is_anon()
                  and writable_event(event_id));$p$, t, t);

    execute format($p$create policy "%s_delete" on %I for delete to authenticated
      using (auth_role() = 'admin' and not is_anon()
             and writable_event(event_id));$p$, t, t);
  end loop;
end $do$;

-- ---------- (B) budget_items: ikut rencana induknya ---------------------------
drop policy if exists "budget_items_write" on budget_items;
drop policy if exists "budget_items_admin_write" on budget_items;
drop policy if exists "budget_items_insert" on budget_items;
drop policy if exists "budget_items_update" on budget_items;
drop policy if exists "budget_items_delete" on budget_items;

create policy "budget_items_insert" on budget_items for insert to authenticated
  with check (auth_role() = 'admin' and not is_anon()
    and writable_event((select b.event_id from budget_plans b where b.id = budget_items.plan_id)));

create policy "budget_items_update" on budget_items for update to authenticated
  using (auth_role() = 'admin' and not is_anon()
    and writable_event((select b.event_id from budget_plans b where b.id = budget_items.plan_id)))
  with check (auth_role() = 'admin' and not is_anon()
    and writable_event((select b.event_id from budget_plans b where b.id = budget_items.plan_id)));

create policy "budget_items_delete" on budget_items for delete to authenticated
  using (auth_role() = 'admin' and not is_anon()
    and writable_event((select b.event_id from budget_plans b where b.id = budget_items.plan_id)));

-- ---------- (C) events dan faqs: hanya membereskan bentuknya ------------------
-- Tidak ada edisi untuk dikunci di sini (lihat kepala berkas). Aturannya tetap
-- persis sama, hanya dipisah menjadi insert/update/delete supaya seluruh berkas
-- memakai satu bentuk.
do $do$
declare t text;
begin
  foreach t in array array['events', 'faqs']
  loop
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format('drop policy if exists "%s_admin_write" on %I;', t, t);
    execute format('drop policy if exists "%s_insert" on %I;', t, t);
    execute format('drop policy if exists "%s_update" on %I;', t, t);
    execute format('drop policy if exists "%s_delete" on %I;', t, t);

    execute format($p$create policy "%s_insert" on %I for insert to authenticated
      with check (auth_role() = 'admin' and not is_anon());$p$, t, t);
    execute format($p$create policy "%s_update" on %I for update to authenticated
      using (auth_role() = 'admin' and not is_anon())
      with check (auth_role() = 'admin' and not is_anon());$p$, t, t);
    execute format($p$create policy "%s_delete" on %I for delete to authenticated
      using (auth_role() = 'admin' and not is_anon());$p$, t, t);
  end loop;
end $do$;
