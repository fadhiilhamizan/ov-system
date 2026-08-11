// ============================================================
// Runs supabase/setup.sql on a REAL Postgres (PGlite, Postgres compiled to
// WASM - no Docker, no server) and asserts the security model it produces.
//
//   npm run db:test
//
// Why this exists: the anon key is public and the session token lives in the
// user's browser, so RLS is the only real boundary - `can.*` in permissions.ts
// is advisory. A mistake in a policy is therefore a product-wide hole, and it
// is invisible to tsc, eslint and Vitest. It has bitten this project twice:
//   * 0002's profiles_update_own let ANY session (including the credential-less
//     anonymous "Tamu") set its own role to admin.
//   * 0020/0026 gated writes on owns_scope(event_id, division), columns that are
//     always null here - so every coordinator/staff/intern write silently failed
//     in production for weeks.
// Both are asserted below. `npm run db:lint` catches SQL that will not parse;
// this catches SQL that parses and does the wrong thing.
// ============================================================
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETUP = join(__dirname, "../supabase/setup.sql");

const U = {
  admin: "11111111-1111-1111-1111-111111111111",
  coord: "22222222-2222-2222-2222-222222222222",
  staff: "33333333-3333-3333-3333-333333333333",
  intern: "44444444-4444-4444-4444-444444444444",
  viewer: "55555555-5555-5555-5555-555555555555",
  anon: "66666666-6666-6666-6666-666666666666",
};

const db = await PGlite.create({ extensions: { pgcrypto } });

// Only what Supabase itself provides: the auth schema, auth.users, and the two
// JWT helpers (driven here by session GUCs so the test can play any identity).
// Everything else has to come from setup.sql alone.
await db.exec(`
create role anon;
create role authenticated;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create or replace function auth.uid() returns uuid
language sql stable as $fn$ select nullif(current_setting('test.uid', true), '')::uuid $fn$;
create or replace function auth.jwt() returns jsonb
language sql stable as $fn$
  select jsonb_build_object('is_anonymous',
    coalesce(nullif(current_setting('test.anon', true), ''), 'false')::boolean) $fn$;
`);

let pass = 0;
let fail = 0;
const ok = (label, good) => {
  console.log(`  ${good ? "PASS" : "FAIL"}  ${label}`);
  good ? pass++ : fail++;
};

const sql = readFileSync(SETUP, "utf8");
try {
  await db.exec(sql);
  ok("setup.sql berjalan di database kosong", true);
} catch (e) {
  console.error(`  FAIL  setup.sql tidak bisa dijalankan:\n${e.message}`);
  process.exit(1);
}
try {
  await db.exec(sql);
  ok("setup.sql aman dijalankan ulang (idempotent)", true);
} catch (e) {
  console.error(`  FAIL  setup.sql tidak idempotent:\n${e.message}`);
  process.exit(1);
}

// Supabase grants these to anon/authenticated by default; setup.sql narrows
// profiles and widens tasks on top, so re-apply its two column rules after.
await db.exec(`
grant usage on schema public, auth to anon, authenticated;
grant select, insert, delete on all tables in schema public to anon, authenticated;
grant update on all tables in schema public to anon, authenticated;
revoke update on public.profiles from authenticated, anon;
grant update (name, avatar_color) on public.profiles to authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
`);

await db.exec(`
insert into auth.users (id) values
  ('${U.admin}'), ('${U.coord}'), ('${U.staff}'), ('${U.intern}'), ('${U.viewer}'), ('${U.anon}');
insert into events (id, code, title) values ('ov-open','OV1','Terbuka'), ('ov-lock','OV2','Terkunci');
update profiles set role='admin'       where id='${U.admin}';
update profiles set role='coordinator' where id='${U.coord}';
update profiles set role='staff'       where id='${U.staff}';
update profiles set role='intern'      where id='${U.intern}';
insert into divisions (event_id, key, name, short, color) values
  ('ov-open','EVENT','Event','EVE','#111'), ('ov-open','CONSUMPTION','Konsumsi','CON','#222');
insert into tasks (id, event_id, division, title) values
  ('aaaaaaaa-0000-0000-0000-000000000001','ov-open','EVENT','Tugas Event'),
  ('aaaaaaaa-0000-0000-0000-000000000002','ov-open','CONSUMPTION','Tugas Konsumsi'),
  ('aaaaaaaa-0000-0000-0000-000000000003','ov-lock','EVENT','Tugas Arsip');
insert into budget_plans (id, name, event_id) values ('bbbbbbbb-0000-0000-0000-000000000001','RAB','ov-open');
insert into links (id, name, url, event_id) values ('cccccccc-0000-0000-0000-000000000001','Doc','https://x.test','ov-open');
insert into rundown (id, event_id, no, activity) values
  ('dddddddd-0000-0000-0000-000000000001','ov-open',1,'Registrasi'),
  ('dddddddd-0000-0000-0000-000000000002','ov-lock',1,'Arsip');
insert into task_links (id, task_id, url) values
  ('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','https://y.test'),
  ('eeeeeeee-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000003','https://arsip.test');
insert into members (event_id, name, nrp, type, year) values
  ('ov-open','Budi Santoso','5026221001','fungsionaris',2022);
insert into teams (event_id, division, coordinator) values ('ov-open','EVENT','Budi');
update events set locked = true where id = 'ov-lock';
`);

const profiles = await db.query(`select count(*)::int as n from profiles`);
ok("trigger handle_new_user membuat profil tiap akun baru", profiles.rows[0].n === 6);

async function as(uid, anon, statement) {
  await db.exec(`set role authenticated;`);
  await db.exec(`set test.uid = '${uid}'; set test.anon = '${anon}';`);
  try {
    const r = await db.query(statement);
    return { rows: r.rows.length, affected: r.affectedRows ?? 0 };
  } catch (e) {
    return { error: e.message.split("\n")[0] };
  } finally {
    await db.exec(`reset role;`);
  }
}

/**
 * expect:
 *   allow  - the write succeeded AND touched a row
 *   deny   - rejected, or silently filtered to zero rows by a USING clause
 *   rows   - the read returned data
 *   norows - the read returned nothing
 */
async function check(label, uid, anon, statement, expect) {
  const r = await as(uid, anon, statement);
  let good;
  let got;
  if (r.error) { got = `error: ${r.error}`; good = expect === "deny"; }
  else if (expect === "allow") { got = `${r.affected} baris`; good = r.affected > 0; }
  else if (expect === "deny") { got = `${r.affected} baris tersentuh`; good = r.affected === 0; }
  else if (expect === "rows") { got = `${r.rows} baris`; good = r.rows > 0; }
  else { got = `${r.rows} baris`; good = r.rows === 0; }
  console.log(`  ${good ? "PASS" : "FAIL"}  ${label}${good ? "" : `   -> ${got}`}`);
  good ? pass++ : fail++;
}

const T_EVENT = "'aaaaaaaa-0000-0000-0000-000000000001'";
const T_CONS = "'aaaaaaaa-0000-0000-0000-000000000002'";
const T_LOCK = "'aaaaaaaa-0000-0000-0000-000000000003'";
const PLAN = "'bbbbbbbb-0000-0000-0000-000000000001'";
const LINK = "'cccccccc-0000-0000-0000-000000000001'";
const RUN = "'dddddddd-0000-0000-0000-000000000001'";
const TL = "'eeeeeeee-0000-0000-0000-000000000001'";

console.log("\nTugas - hak tulis mengikuti PERAN saja, bukan divisi");
await check("staff mengubah tugas divisi lain", U.staff, false, `update tasks set status='ongoing' where id=${T_CONS}`, "allow");
await check("intern mengubah tugas divisi lain", U.intern, false, `update tasks set result='x' where id=${T_CONS}`, "allow");
await check("staff membuat tugas", U.staff, false, `insert into tasks (event_id,division,title) values ('ov-open','CONSUMPTION','Baru')`, "allow");
await check("staff mengubah kolom non-progres", U.staff, false, `update tasks set title='Judul' where id=${T_CONS}`, "allow");
await check("staff DITOLAK menghapus tugas", U.staff, false, `delete from tasks where id=${T_CONS}`, "deny");
await check("koordinator boleh menghapus tugas", U.coord, false, `delete from tasks where title='Baru'`, "allow");

const numbered = await as(U.admin, false, `insert into tasks (event_id,division,title) values ('ov-open','EVENT','Auto') returning no`);
ok("trigger assign_task_no memberi nomor otomatis", !numbered.error);

console.log("\nKunci arsip");
await check("staff DITOLAK mengubah tugas di arsip", U.staff, false, `update tasks set status='done' where id=${T_LOCK}`, "deny");
await check("koordinator DITOLAK di arsip", U.coord, false, `update tasks set status='done' where id=${T_LOCK}`, "deny");
await check("staff DITOLAK menambah tugas ke arsip", U.staff, false, `insert into tasks (event_id,division,title) values ('ov-lock','EVENT','Nyelip')`, "deny");
await check("staff DITOLAK memindah tugas KE arsip", U.staff, false, `update tasks set event_id='ov-lock' where id=${T_CONS}`, "deny");
await check("staff DITOLAK mengubah rundown arsip", U.staff, false, `update rundown set activity='X' where id='dddddddd-0000-0000-0000-000000000002'`, "deny");
await check("admin TETAP boleh mengubah arsip", U.admin, false, `update tasks set status='done' where id=${T_LOCK}`, "allow");

console.log("\nModul yang hanya boleh disentuh admin");
await check("koordinator DITOLAK menulis anggaran", U.coord, false, `insert into budget_items (plan_id,name) values (${PLAN},'X')`, "deny");
await check("staff DITOLAK menulis anggota", U.staff, false, `insert into members (event_id,name,type) values ('ov-open','X','intern')`, "deny");
await check("staff DITOLAK menulis divisi", U.staff, false, `insert into divisions (event_id,key,name,short,color) values ('ov-open','ZZ','Z','ZZ','#333')`, "deny");
await check("koordinator DITOLAK menulis Reach & Offer", U.coord, false, `insert into prospects (event_id,org_name) values ('ov-open','X')`, "deny");
await check("admin boleh menulis anggaran", U.admin, false, `insert into budget_items (plan_id,name) values (${PLAN},'X')`, "allow");
await check("admin boleh menulis anggota", U.admin, false, `insert into members (event_id,name,type) values ('ov-open','X','intern')`, "allow");

console.log("\nRundown / Hari-H / Super Link");
await check("staff mengubah rundown", U.staff, false, `update rundown set activity='Ubah' where id=${RUN}`, "allow");
await check("intern menambah job Hari-H", U.intern, false, `insert into job_harih (event_id,no,job) values ('ov-open','1','J')`, "allow");
await check("staff mengubah Super Link", U.staff, false, `update links set name='Ubah' where id=${LINK}`, "allow");
await check("staff DITOLAK menghapus Super Link", U.staff, false, `delete from links where id=${LINK}`, "deny");
await check("intern DITOLAK menghapus rundown", U.intern, false, `delete from rundown where id=${RUN}`, "deny");
await check("koordinator boleh menghapus rundown", U.coord, false, `delete from rundown where id=${RUN}`, "allow");
await check("staff mengubah tautan hasil tugas", U.staff, false, `update task_links set label='L' where id=${TL}`, "allow");
await check("Super Link menolak URL yang bukan http(s)", U.admin, false, `insert into links (event_id,name,url) values ('ov-open','X','bukan-url')`, "deny");

console.log("\nRoster = PII, hanya untuk akun berperan");
await check("staff BISA baca anggota (nama+NRP)", U.staff, false, `select * from members`, "rows");
await check("koordinator BISA baca tim", U.coord, false, `select * from teams`, "rows");
await check("Tamu terdaftar TIDAK bisa baca anggota", U.viewer, false, `select * from members`, "norows");
await check("Tamu terdaftar TIDAK bisa baca tim", U.viewer, false, `select * from teams`, "norows");
await check("Tamu anonim TIDAK bisa baca anggota (NRP)", U.anon, true, `select * from members`, "norows");
await check("Tamu anonim TIDAK bisa baca tim", U.anon, true, `select * from teams`, "norows");

console.log("\ntask_links ikut kunci arsip (celah 0025 yang ditambal)");
await check("staff mengubah tautan tugas di edisi terbuka", U.staff, false, `update task_links set label='ok' where id=${TL}`, "allow");
await check("staff DITOLAK mengubah tautan tugas di edisi ARSIP", U.staff, false, `update task_links set label='X' where id='eeeeeeee-0000-0000-0000-000000000002'`, "deny");
await check("koordinator DITOLAK menghapus tautan tugas di ARSIP", U.coord, false, `delete from task_links where id='eeeeeeee-0000-0000-0000-000000000002'`, "deny");
await check("admin TETAP bisa mengubah tautan tugas di ARSIP", U.admin, false, `update task_links set label='fix' where id='eeeeeeee-0000-0000-0000-000000000002'`, "allow");

console.log("\nAkun terdaftar yang belum punya peran");
await check("belum-berperan TIDAK bisa baca anggaran", U.viewer, false, `select * from budget_plans`, "norows");
await check("belum-berperan TIDAK bisa baca Super Link", U.viewer, false, `select * from links`, "norows");
await check("belum-berperan masih bisa baca tugas", U.viewer, false, `select * from tasks`, "rows");
await check("belum-berperan DITOLAK membuat tugas", U.viewer, false, `insert into tasks (event_id,division,title) values ('ov-open','EVENT','X')`, "deny");
await check("staff BISA baca Super Link", U.staff, false, `select * from links`, "rows");
await check("staff BISA baca anggaran", U.staff, false, `select * from budget_plans`, "rows");

console.log("\nTamu anonim (tanpa kredensial)");
await check("tamu anonim TIDAK bisa baca anggaran", U.anon, true, `select * from budget_plans`, "norows");
await check("tamu anonim masih bisa baca tugas", U.anon, true, `select * from tasks`, "rows");
await check("tamu anonim DITOLAK membuat tugas", U.anon, true, `insert into tasks (event_id,division,title) values ('ov-open','EVENT','X')`, "deny");
await check("tamu anonim DITOLAK menulis tautan hasil", U.anon, true, `insert into task_links (task_id,url) values (${T_EVENT},'https://z.test')`, "deny");

console.log("\nCelah angkat-diri-jadi-admin");
await check("staff DITOLAK mengangkat dirinya jadi admin", U.staff, false, `update profiles set role='admin' where id='${U.staff}'`, "deny");
await check("tamu anonim DITOLAK mengangkat dirinya", U.anon, true, `update profiles set role='admin' where id='${U.anon}'`, "deny");
await check("staff tetap boleh mengubah namanya sendiri", U.staff, false, `update profiles set name='Baru' where id='${U.staff}'`, "allow");

console.log("\nKebersihan skema");
const stale = await db.query(`select policyname from pg_policies where schemaname='public'
  and (coalesce(qual,'')||coalesce(with_check,'')) ~ '(owns_scope|auth_event\\()'`);
ok("tidak ada policy yang memakai scoping divisi/edisi lama", stale.rows.length === 0);

const cols = await db.query(`select table_name, column_name from information_schema.columns where table_schema='public'`);
const have = new Set(cols.rows.map((r) => `${r.table_name}.${r.column_name}`));
const REQUIRED = [
  "events.locked", "events.plan_start", "events.plan_end",
  "divisions.event_id", "divisions.exclude_from_rundown",
  "members.divisions", "members.event_id",
  "tasks.event_id", "tasks.status", "prospects.is_primary", "prospects.mode",
  "links.event_id", "task_links.link_id", "budget_items.category_color",
  "rundown.division_jobs", "rundown.operator", "teams.coordinator",
  "role_requests.requested_role", "backups.data", "profiles.role",
];
const missing = REQUIRED.filter((c) => !have.has(c));
ok(`semua kolom yang dipakai aplikasi ada${missing.length ? ` - hilang: ${missing.join(", ")}` : ""}`, missing.length === 0);
ok("kolom warisan tasks.source_id sudah dibuang", !have.has("tasks.source_id"));

const noRls = await db.query(`select tablename from pg_tables where schemaname='public' and not rowsecurity`);
ok(`RLS aktif di semua tabel${noRls.rows.length ? ` - kecuali: ${noRls.rows.map((r) => r.tablename).join(", ")}` : ""}`, noRls.rows.length === 0);

// ------------------------------------------------------------------
// Migrasi yang belum tentu sudah dijalankan user, diuji SATU STATEMENT PER
// EKSEKUSI - persis seperti SQL editor menjalankannya.
//
// Ada karena migrasi 0030 pernah gagal di tangan user dengan
//   ERROR: 42P01: relation "dedupe_report" does not exist
// Penyebabnya tabel sementara: ia hanya hidup di satu sesi, sementara SQL
// editor Supabase lewat connection pooler. `db:lint` sekarang menolak
// `create temporary table` secara statis; bagian ini menangkap sisanya -
// statement yang hanya jalan kalau dieksekusi sekaligus dalam satu batch.
// ------------------------------------------------------------------
console.log("\nMigrasi lanjutan - dijalankan per statement");

const PENDING = [
  "0029_performance_measurement.sql",
  "0030_dedupe_rows.sql",
  "0031_rundown_merge_cells.sql",
  "0032_import_superlink_from_sheet.sql",
  "0033_performance_measurement_data.sql",
  "0034_task_links_scope_and_roster_pii.sql",
  "0035_rundown_single_version.sql",
  "0036_prospect_link_notes.sql",
];

// The editions the imports target must exist first.
await db.exec(`insert into events (id, code, title) values
  ('ov1-2025','OV1 2025','Edisi 1 2025'), ('ov2-2025','OV2 2025','Edisi 2 2025'),
  ('ov1-2026','OV1 2026','Edisi 1 2026'), ('ov2-2026','OV2 2026','Edisi 2 2026')
  on conflict (id) do nothing;`);

/** Split on top-level semicolons, respecting strings, comments and $tag$ bodies. */
function splitStatements(sql) {
  const out = [];
  let buf = "";
  let i = 0;
  const at = (n) => sql.slice(i, i + n);
  while (i < sql.length) {
    if (at(2) === "--") { const e = sql.indexOf("\n", i); buf += sql.slice(i, e === -1 ? sql.length : e); i = e === -1 ? sql.length : e; continue; }
    if (at(2) === "/*") { const e = sql.indexOf("*/", i + 2); buf += sql.slice(i, e === -1 ? sql.length : e + 2); i = e === -1 ? sql.length : e + 2; continue; }
    if (sql[i] === "'") {
      buf += sql[i++];
      while (i < sql.length) { if (sql[i] === "'" && sql[i + 1] === "'") { buf += "''"; i += 2; continue; } if (sql[i] === "'") { buf += sql[i++]; break; } buf += sql[i++]; }
      continue;
    }
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
    if (dollar) {
      const tag = dollar[0];
      const close = sql.indexOf(tag, i + tag.length);
      const end = close === -1 ? sql.length : close + tag.length;
      buf += sql.slice(i, end);
      i = end;
      continue;
    }
    if (sql[i] === ";") { out.push(buf.trim()); buf = ""; i++; continue; }
    buf += sql[i++];
  }
  if (buf.trim()) out.push(buf.trim());
  // Strip the comment block that precedes a statement rather than discarding the
  // statement: nearly every statement here is introduced by a `--` header, and
  // dropping them silently made the harness "pass" migrations it never ran.
  return out
    .map((s) => s.replace(/^(?:\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/\s*))+/, "").trim())
    .filter((s) => /[A-Za-z]/.test(s));
}

for (const round of ["pertama", "kedua (idempotency)"]) {
  for (const file of PENDING) {
    const statements = splitStatements(readFileSync(join(__dirname, "../supabase/migrations/", file), "utf8"));
    let failedAt = null;
    for (const [n, stmt] of statements.entries()) {
      try {
        await db.exec(stmt);
      } catch (e) {
        failedAt = `statement #${n + 1}: ${e.message.split("\n")[0]} - ${stmt.slice(0, 70).replace(/\s+/g, " ")}`;
        break;
      }
    }
    ok(`${file} (jalan ${round}, ${statements.length} statement terpisah)`, failedAt === null);
    if (failedAt) console.log(`        ${failedAt}`);
  }
}

// ------------------------------------------------------------------
// Alur rebuild data (supabase/README.md → "Rebuild data").
//
// Ada karena `seed.sql` memuat 529 INSERT tanpa `on conflict`: menjalankannya
// dua kali menggandakan hampir semua tabel, dan itulah sumber baris kembar yang
// terus muncul. Bagian ini membuktikan tiga hal sekaligus - seed dua kali
// MEMANG menggandakan, reset-data.sql menyembuhkannya, dan akun tidak ikut
// terhapus.
// ------------------------------------------------------------------
console.log("\nAlur rebuild data");

const fresh = await PGlite.create({ extensions: { pgcrypto } });
await fresh.exec(`
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create or replace function auth.uid() returns uuid language sql stable as $fn$ select nullif(current_setting('test.uid', true), '')::uuid $fn$;
create or replace function auth.jwt() returns jsonb language sql stable as $fn$
  select jsonb_build_object('is_anonymous', coalesce(nullif(current_setting('test.anon', true), ''), 'false')::boolean) $fn$;
`);

const sb = (p) => readFileSync(join(__dirname, "../supabase/", p), "utf8");
const rows = async (t) => Number((await fresh.query(`select count(*) c from ${t}`)).rows[0].c);
const shape = async () => ({
  events: await rows("events"), members: await rows("members"), tasks: await rows("tasks"),
  links: await rows("links"), prospects: await rows("prospects"), rundown: await rows("rundown"),
  teams: await rows("teams"), faqs: await rows("faqs"), job_harih: await rows("job_harih"),
});

try {
  await fresh.exec(sb("setup.sql"));
  const hasMerges = (await fresh.query(
    `select 1 from information_schema.columns
      where table_schema='public' and table_name='rundown' and column_name='merges'`,
  )).rows.length === 1;
  ok("setup.sql menyediakan rundown.merges (kolom yang bikin merge gagal)", hasMerges);

  await fresh.exec(sb("seed.sql"));
  const once = await shape();
  ok("seed.sql mengisi data", once.events > 0 && once.tasks > 0);

  await fresh.exec(sb("seed.sql"));
  const twice = await shape();
  ok(`seed dua kali MENGGANDAKAN (tasks ${once.tasks} -> ${twice.tasks}) - inilah sumber duplikat`,
    twice.tasks === once.tasks * 2);

  // An account must outlive the reset; that is why profiles is excluded.
  await fresh.exec(`insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999','x@y.z')`);
  await fresh.query(`update profiles set role='admin' where id='99999999-9999-9999-9999-999999999999'`);

  await fresh.exec(sb("reset-data.sql"));
  const emptied = await shape();
  ok("reset-data.sql mengosongkan seluruh data aplikasi",
    Object.values(emptied).every((v) => v === 0), JSON.stringify(emptied));
  const keptAdmin = (await fresh.query(
    `select role from profiles where id='99999999-9999-9999-9999-999999999999'`,
  )).rows[0];
  ok("akun & peran selamat dari reset", keptAdmin?.role === "admin");

  await fresh.exec(sb("seed.sql"));
  const rebuilt = await shape();
  ok("seed ulang menghasilkan jumlah baris yang sama seperti seed pertama",
    JSON.stringify(rebuilt) === JSON.stringify(once), `${JSON.stringify(rebuilt)} vs ${JSON.stringify(once)}`);

  const before = await shape();
  await fresh.exec(sb("migrations/0030_dedupe_rows.sql"));
  ok("0030 tidak menemukan kembar apa pun pada data hasil rebuild",
    JSON.stringify(await shape()) === JSON.stringify(before));

  // ---- isolasi antar-edisi ----
  // `getProspects`/`getMembers` menganggap event_id null milik SEMUA edisi, jadi
  // satu baris tanpa edisi merembes ke mana-mana. Ini yang bikin tiap Ormawa
  // Visit menampilkan 61 prospek padahal miliknya 12-19.
  const nulls = async (t) => Number((await fresh.query(`select count(*) c from ${t} where event_id is null`)).rows[0].c);
  ok("tidak ada prospek tanpa edisi (merembes ke semua Ormawa Visit)", (await nulls("prospects")) === 0);
  ok("tidak ada anggota tanpa edisi", (await nulls("members")) === 0);

  const perEvent = async (t) =>
    (await fresh.query(`select event_id, count(*)::int c from ${t} group by 1 order by 1`)).rows;
  const pros = await perEvent("prospects");
  console.log(`        prospek/edisi: ${pros.map((r) => `${r.event_id}=${r.c}`).join(", ")}`);
  ok("prospek terbagi ke 4 edisi, tidak seragam", pros.length === 4 && new Set(pros.map((r) => r.c)).size > 1);

  await fresh.exec(sb("migrations/0019_real_roster.sql"));
  const mem = await perEvent("members");
  console.log(`        anggota/edisi: ${mem.map((r) => `${r.event_id}=${r.c}`).join(", ")}`);
  ok("0019 mengisi roster asli per edisi", mem.length === 4 && mem.every((r) => r.c > 0));
  ok("masih tidak ada anggota tanpa edisi setelah 0019", (await nulls("members")) === 0);
} catch (e) {
  ok("alur rebuild berjalan tanpa error", false, e.message.split("\n")[0]);
}

// ------------------------------------------------------------------
// 0034 memperbaiki celah JALUR MIGRASI (bukan setup.sql).
//
// Database produksi menjalankan migrasi satu per satu. Migrasi 0025 membuat
// policy `task_links_write` (FOR ALL, tanpa scope edisi); 0028 menambah versi
// ter-scope tapi LUPA men-drop yang lama. Policy permissive di-OR, jadi yang
// longgar tetap mengizinkan tulis di Ormawa Visit yang diarsipkan. Bagian ini
// membangun keadaan cacat itu persis, membuktikan celahnya ADA, lalu bahwa 0034
// menutupnya.
// ------------------------------------------------------------------
console.log("\n0034 - menutup celah task_links jalur migrasi");

const leak = await PGlite.create({ extensions: { pgcrypto } });
await leak.exec(`
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $fn$ select nullif(current_setting('test.uid', true), '')::uuid $fn$;
create or replace function auth.jwt() returns jsonb language sql stable as $fn$
  select jsonb_build_object('is_anonymous', coalesce(nullif(current_setting('test.anon', true), ''), 'false')::boolean) $fn$;
create type app_role as enum ('admin','coordinator','staff','intern','viewer');
`);
try {
  // Minimal slice of the schema + the helper functions 0028 introduced.
  await leak.exec(`
create table profiles (id uuid primary key, role app_role not null default 'viewer');
create table events (id text primary key, locked boolean not null default false);
create table tasks (id uuid primary key default gen_random_uuid(), event_id text references events(id));
create table task_links (id uuid primary key default gen_random_uuid(), task_id uuid references tasks(id), label text);
-- 0034 bagian B menyentuh members & teams juga (read PII), jadi harus ada.
create table members (id uuid primary key default gen_random_uuid(), name text);
create table teams (id uuid primary key default gen_random_uuid(), coordinator text);
alter table members enable row level security;
alter table teams enable row level security;
create or replace function auth_role() returns app_role language sql stable security definer set search_path=public as $fn$ select role from profiles where id=auth.uid() $fn$;
create or replace function is_anon() returns boolean language sql stable as $fn$ select coalesce((auth.jwt()->>'is_anonymous')::boolean,false) $fn$;
create or replace function has_role() returns boolean language sql stable security definer set search_path=public as $fn$
  select coalesce(auth_role()::text in ('admin','coordinator','staff','intern'),false) and not is_anon() $fn$;
create or replace function writable_event(row_event text) returns boolean language sql stable security definer set search_path=public as $fn$
  select auth_role()='admin' or not coalesce((select e.locked from events e where e.id=row_event),false) $fn$;
alter table task_links enable row level security;

-- Keadaan hasil 0025 + 0028: policy lama TIDAK di-drop.
create policy "task_links_write" on task_links for all to authenticated
  using (auth_role()::text in ('admin','coordinator','staff','intern'))
  with check (auth_role()::text in ('admin','coordinator','staff','intern'));
create policy "task_links_update" on task_links for update to authenticated
  using (has_role() and writable_event((select t.event_id from tasks t where t.id=task_links.task_id)))
  with check (has_role() and writable_event((select t.event_id from tasks t where t.id=task_links.task_id)));

grant usage on schema public, auth to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public, auth to anon, authenticated;

insert into events (id, locked) values ('open', false), ('arsip', true);
insert into profiles (id, role) values ('22222222-2222-2222-2222-222222222222','coordinator');
insert into tasks (id, event_id) values ('aaaaaaaa-0000-0000-0000-0000000000aa','arsip');
insert into task_links (id, task_id, label) values ('bbbbbbbb-0000-0000-0000-0000000000bb','aaaaaaaa-0000-0000-0000-0000000000aa','awal');
`);

  const coordWrites = async () => {
    await leak.exec(`set role authenticated; set test.uid='22222222-2222-2222-2222-222222222222'; set test.anon='false';`);
    let affected = 0;
    try {
      const r = await leak.query(`update task_links set label='ubah' where id='bbbbbbbb-0000-0000-0000-0000000000bb'`);
      affected = r.affectedRows ?? 0;
    } catch { /* denied */ }
    await leak.exec(`reset role;`);
    return affected;
  };

  ok("SEBELUM 0034: celah nyata - koordinator bisa tulis tautan di ARSIP", (await coordWrites()) === 1);
  await leak.exec(readFileSync(join(__dirname, "../supabase/migrations/0034_task_links_scope_and_roster_pii.sql"), "utf8"));
  ok("SESUDAH 0034: koordinator DITOLAK menulis tautan di ARSIP", (await coordWrites()) === 0);
  const stale = (await leak.query(
    `select 1 from pg_policies where tablename='task_links' and policyname='task_links_write'`,
  )).rows.length;
  ok("policy task_links_write yang basi sudah dibuang", stale === 0);
} catch (e) {
  ok("uji celah 0034 berjalan", false, e.message.split("\n")[0]);
}

// ------------------------------------------------------------------
// demo-seed.sql menyembuhkan project demo yang skema-nya basi.
//
// Project demo berhenti di migrasi 0018 + 0027 dan tidak pernah dapat kolom
// rundown.merges (0031) - itulah kenapa fitur gabung sel gagal di Mode Demo.
// demo-seed.sql punya "Part 0" yang menambah kolom itu (idempotent), jadi
// menjalankan ulang demo-seed memperbaikinya. Ini membangun rundown TANPA
// merges (seperti demo basi), menjalankan catch-up, lalu membuktikan tulis
// merges berhasil.
// ------------------------------------------------------------------
console.log("\nMode Demo - catch-up kolom merges");
const demo = await PGlite.create({ extensions: { pgcrypto } });
try {
  // A stale demo schema: the tables exist, the newer columns do not. `links`
  // is here because prospects.link_id references it (0036).
  await demo.exec(`
create table events (id text primary key);
create table rundown (id uuid primary key default gen_random_uuid(), event_id text, activity text);
create table links (id uuid primary key default gen_random_uuid(), name text, url text);
create table prospects (id uuid primary key default gen_random_uuid(), event_id text, org_name text);
insert into events (id) values ('demo-ov');
insert into rundown (event_id, activity) values ('demo-ov','Registrasi');
insert into prospects (event_id, org_name) values ('demo-ov','HIMA X');
`);
  const tryWrite = async (sql) => {
    try { await demo.query(sql); return null; }
    catch (e) { return e.message.split("\n")[0]; }
  };
  const MERGES = `update rundown set merges='{"mc":2}'::jsonb where event_id='demo-ov'`;
  const PLINK = `update prospects set link='https://x.test', notes='n' where event_id='demo-ov'`;

  const beforeErr = await tryWrite(MERGES);
  ok("SEBELUM catch-up: tulis merges GAGAL (kolom tidak ada)", beforeErr !== null && /merges/.test(beforeErr));
  const beforeLink = await tryWrite(PLINK);
  ok("SEBELUM catch-up: tulis link prospek GAGAL (kolom tidak ada)", beforeLink !== null && /link/.test(beforeLink));

  // Jalankan hanya statement Part 0 dari demo-seed (add column if not exists).
  const demoSeed = readFileSync(join(__dirname, "../supabase/demo/demo-seed.sql"), "utf8");
  for (const m of demoSeed.matchAll(/alter table \w+ add column if not exists [^\n;]+;/g)) {
    await demo.exec(m[0]);
  }
  const afterErr = await tryWrite(MERGES);
  ok("SESUDAH catch-up: tulis merges BERHASIL (fitur gabung sel jalan)", afterErr === null);
  const afterLink = await tryWrite(PLINK);
  ok("SESUDAH catch-up: tulis link prospek BERHASIL (Reach & Offer jalan)", afterLink === null);
} catch (e) {
  ok("uji catch-up demo berjalan", false, e.message.split("\n")[0]);
}

// ------------------------------------------------------------------
// 0035 mengkonsolidasi rundown ke satu versi (buang 'variant B').
//
// Data lama punya baris A DAN B untuk edisi yang sama; halaman rundown yang
// tidak menyaring variant menampilkannya dua kali. Bagian ini membangun tiga
// kasus - edisi dengan A+B, edisi hanya-B, edisi hanya-A - dan membuktikan
// hasilnya: semua jadi variant A, jumlah A dipertahankan, B hilang, dan edisi
// yang tadinya hanya-B tidak jadi kosong.
// ------------------------------------------------------------------
console.log("\n0035 - rundown satu versi");
const rd = await PGlite.create({ extensions: { pgcrypto } });
try {
  await rd.exec(`
create table rundown (id uuid primary key default gen_random_uuid(), event_id text, variant text, no int, activity text);
insert into rundown (event_id, variant, no, activity) values
  ('ov-ab','A',1,'A1'), ('ov-ab','A',2,'A2'), ('ov-ab','B',1,'B1'), ('ov-ab','B',2,'B2'),
  ('ov-bonly','B',1,'Bonly1'), ('ov-bonly','B',2,'Bonly2'),
  ('ov-aonly','A',1,'Aonly1');
`);
  await rd.exec(readFileSync(join(__dirname, "../supabase/migrations/0035_rundown_single_version.sql"), "utf8"));
  const grp = (await rd.query(`select event_id, variant, count(*)::int c from rundown group by 1,2 order by 1,2`)).rows;
  const at = (e, v) => grp.find((r) => r.event_id === e && r.variant === v)?.c ?? 0;
  ok("edisi A+B: B dibuang, A dipertahankan (2)", at("ov-ab", "A") === 2 && at("ov-ab", "B") === 0);
  ok("edisi hanya-B: dipromosikan jadi A, tidak kosong (2)", at("ov-bonly", "A") === 2 && at("ov-bonly", "B") === 0);
  ok("edisi hanya-A: tak berubah (1)", at("ov-aonly", "A") === 1);
  ok("tidak ada lagi baris variant B di mana pun", grp.every((r) => r.variant === "A"));
  // idempotent
  await rd.exec(readFileSync(join(__dirname, "../supabase/migrations/0035_rundown_single_version.sql"), "utf8"));
  const total = Number((await rd.query(`select count(*) c from rundown`)).rows[0].c);
  ok("dijalankan dua kali tidak mengubah jumlah (5)", total === 5);
} catch (e) {
  ok("uji 0035 berjalan", false, e.message.split("\n")[0]);
}

// ------------------------------------------------------------------
// default-accounts.sql membuat tiga akun login siap pakai (koordinator/staff/
// intern). Ia menyisipkan baris auth.users + auth.identities lalu memastikan
// profiles.role benar (trigger handle_new_user membuatnya 'viewer' dulu).
//
// Kita tidak bisa menguji GoTrue di sini, tapi kita BISA membuktikan logikanya:
// akun terbentuk, perannya benar, password ter-hash (bisa diverifikasi crypt),
// dan menjalankan ulang tidak menggandakan apa pun.
// ------------------------------------------------------------------
console.log("\ndefault-accounts - akun default koordinator/staff/intern");
const da = await PGlite.create({ extensions: { pgcrypto } });
try {
  // Skema auth yang lebih lengkap dari yang disediakan Supabase: kolom yang
  // dipakai skrip, plus auth.identities. Helper uid/jwt tidak dibutuhkan di sini.
  await da.exec(`
create role anon;
create role authenticated;
create schema auth;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text unique,
  encrypted_password text, email_confirmed_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}',
  -- GoTrue's token columns. Nullable with NO default, exactly as Supabase
  -- ships them - that is the whole point: a hand-written INSERT that skips
  -- them leaves NULL, GoTrue scans NULL into a Go string, and login dies with
  -- an empty-bodied 500 that the app renders as "{}".
  confirmation_token varchar(255),
  recovery_token varchar(255),
  email_change varchar(255),
  email_change_token_new varchar(255),
  email_change_token_current varchar(255),
  phone_change varchar(255),
  phone_change_token varchar(255),
  reauthentication_token varchar(255));
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users(id), provider_id text,
  identity_data jsonb, provider text, last_sign_in_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  unique (provider, provider_id));
create or replace function auth.uid() returns uuid
language sql stable as $fn$ select nullif(current_setting('test.uid', true), '')::uuid $fn$;
create or replace function auth.jwt() returns jsonb
language sql stable as $fn$ select '{}'::jsonb $fn$;
`);
  await da.exec(readFileSync(SETUP, "utf8"));
  await da.exec(readFileSync(join(__dirname, "../supabase/default-accounts.sql"), "utf8"));

  const roleOf = async (email) =>
    (await da.query(`select role from public.profiles where email = $1`, [email])).rows[0]?.role;
  ok("koordinator dibuat dengan peran coordinator", (await roleOf("coordinator@ormawavisit.id")) === "coordinator");
  ok("staff dibuat dengan peran staff", (await roleOf("staff@ormawavisit.id")) === "staff");
  ok("intern dibuat dengan peran intern", (await roleOf("intern@ormawavisit.id")) === "intern");

  const nUsers = Number((await da.query(`select count(*) c from auth.users`)).rows[0].c);
  const nIdent = Number((await da.query(`select count(*) c from auth.identities`)).rows[0].c);
  ok("tepat 3 auth.users + 3 identity email", nUsers === 3 && nIdent === 3);

  const pwOk = (await da.query(
    `select encrypted_password = crypt('OrmawaVisit123', encrypted_password) m
       from auth.users where email = 'staff@ormawavisit.id'`)).rows[0].m;
  ok("password ter-hash bcrypt & cocok dengan default", pwOk === true);

  // ----------------------------------------------------------------
  // Kolom token GoTrue TIDAK BOLEH NULL.
  //
  // Ini bug yang benar-benar terjadi: versi pertama skrip ini tidak mengisi
  // kolom token, GoTrue membacanya sebagai string Go, dan login gagal dengan
  // HTTP 500 tanpa isi - aplikasi menampilkannya sebagai "{}". Postgres sendiri
  // tidak keberatan, jadi hanya assertion inilah yang bisa menangkapnya.
  // ----------------------------------------------------------------
  const TOKEN_COLS = [
    "confirmation_token", "recovery_token", "email_change", "email_change_token_new",
    "email_change_token_current", "phone_change", "phone_change_token", "reauthentication_token",
  ];
  const nullTokens = Number((await da.query(
    `select count(*) c from auth.users where ${TOKEN_COLS.map((c) => `${c} is null`).join(" or ")}`,
  )).rows[0].c);
  ok("tidak ada kolom token yang NULL (penyebab error '{}' saat login)", nullTokens === 0);

  // Baris rusak peninggalan skrip versi lama harus ikut diperbaiki, bukan cuma
  // baris yang dibuat oleh skrip baru.
  await da.exec(`
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        'lama@ormawavisit.id', crypt('x', gen_salt('bf')), now(), now(), now());
`);
  const brokenBefore = Number((await da.query(
    `select count(*) c from auth.users where confirmation_token is null`)).rows[0].c);
  await da.exec(readFileSync(join(__dirname, "../supabase/default-accounts.sql"), "utf8"));
  const brokenAfter = Number((await da.query(
    `select count(*) c from auth.users where ${TOKEN_COLS.map((c) => `${c} is null`).join(" or ")}`,
  )).rows[0].c);
  ok("akun lama yang rusak ikut diperbaiki, bukan hanya akun baru", brokenBefore === 1 && brokenAfter === 0);

  // Idempotensi: jalankan lagi - jumlah tidak berubah, peran tetap benar.
  const nUsers2 = Number((await da.query(`select count(*) c from auth.users`)).rows[0].c);
  ok("dijalankan dua kali tidak menggandakan akun (tetap 3 + 1 akun lama)", nUsers2 === 4);
  ok("peran tetap benar setelah dijalankan ulang", (await roleOf("intern@ormawavisit.id")) === "intern");

  const ident = Number((await da.query(`select count(*) c from auth.identities`)).rows[0].c);
  ok("identity tidak digandakan saat dijalankan ulang (tetap 3)", ident === 3);
} catch (e) {
  ok("uji default-accounts berjalan", false, e.message.split("\n")[0]);
}

console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
