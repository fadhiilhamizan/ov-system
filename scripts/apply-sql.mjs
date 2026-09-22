// ============================================================
// Jalankan sebuah berkas SQL langsung ke database Supabase, tanpa Dashboard.
//
//   npm run db:apply -- supabase/migrations/0050_broadcasts_inbox.sql
//
// KENAPA ADA. SQL Editor di Dashboard adalah cara normal menerapkan migrasi,
// tapi Dashboard-nya bisa mati sendiri tanpa ada yang salah di database kita:
// September 2026 Studio tampil blank karena satu chunk JavaScript-nya macet di
// edge Cloudflare (supabase/supabase#50652, dilabeli external-issue). Postgres
// tetap sehat; yang hilang cuma UI-nya. Skrip ini bicara ke Postgres langsung,
// jadi tidak peduli Studio hidup atau tidak.
//
// Ini BUKAN pengganti alur migrasi. Urutan dan isi berkasnya tetap sama persis
// dengan yang dipaste ke SQL Editor, dan berkasnya tetap satu-satunya sumber
// kebenaran. Skrip ini hanya saluran lain menuju database yang sama.
//
// KENAPA POOLER, BUKAN KONEKSI LANGSUNG. Host `db.<ref>.supabase.co` sekarang
// hanya punya alamat IPv6, dan banyak ISP rumahan (termasuk yang dipakai di
// sini) tidak punya IPv6 keluar sama sekali - koneksinya gagal sebagai timeout
// jaringan yang membingungkan, bukan sebagai kesalahan kredensial. Pooler
// punya alamat IPv4. Pakai PORT 5432 (session mode), BUKAN 6543 (transaction
// mode): berkas migrasi memakai `begin; ... commit;` dan DDL, dan transaction
// mode tidak menjamin keduanya berjalan di sesi yang sama.
//
// KATA SANDI TIDAK PERNAH DITULIS DI MANA PUN. Skrip ini menanyakannya lewat
// prompt tersembunyi, jadi tidak masuk riwayat shell, tidak masuk berkas, dan
// tidak pernah dicetak. Kalau kamu lebih suka, isi SUPABASE_DB_URL di
// environment, tapi prompt lebih aman.
// ============================================================
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Sertifikat root Supabase, dipakai untuk MEMVERIFIKASI server - bukan rahasia,
// memang diterbitkan publik, dan sengaja disimpan di repo supaya menerapkan
// migrasi tidak bergantung pada Dashboard yang sedang mati.
// Sumbernya: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
// (CN=Supabase Root 2021 CA, berlaku sampai April 2031.)
//
// Alternatifnya adalah rejectUnauthorized:false, dan itu ditolak di sini:
// koneksinya tetap terenkripsi tapi tidak ada lagi yang membuktikan kita bicara
// dengan database kita sendiri - persis jaminan yang justru kita butuhkan saat
// mengirim DDL beserta kata sandi database.
const CA_PATH = join(dirname(fileURLToPath(import.meta.url)), "../supabase/prod-ca-2021.crt");

const file = process.argv[2];
if (!file) {
  console.error("Pakai: npm run db:apply -- <berkas.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");

/** Baca satu baris tanpa menampilkannya di layar. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    // Matikan echo: readline sendiri tidak punya mode "password".
    const onData = (char) => {
      if (["\n", "\r", ""].includes(String(char))) {
        process.stdin.removeListener("data", onData);
      } else {
        // Timpa apa pun yang sempat tercetak, supaya panjangnya pun tidak bocor.
        process.stdout.clearLine?.(0);
        process.stdout.cursorTo?.(0);
        process.stdout.write(question);
      }
    };
    process.stdin.on("data", onData);
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); resolve(a.trim()); });
  });
}

/** Tebak project ref dari .env.local supaya tidak perlu diketik ulang. */
function refFromEnv() {
  try {
    const env = readFileSync(".env.local", "utf8");
    const m = env.match(/^NEXT_PUBLIC_SUPABASE_URL=\s*https:\/\/([a-z0-9]+)\.supabase\.co/m);
    return m?.[1] ?? "";
  } catch {
    return "";
  }
}

const connectionString = process.env.SUPABASE_DB_URL || (await (async () => {
  const ref = refFromEnv();
  console.log("Menyusun koneksi ke database Supabase.");
  console.log("Tekan Enter untuk memakai nilai di dalam kurung - keduanya sudah");
  console.log("diverifikasi benar untuk project ini (tenant ditemukan di host itu).\n");
  const project = (await ask(`Project ref [${ref}]: `)) || ref;
  const host = (await ask("Host pooler [aws-0-ap-southeast-1.pooler.supabase.com]: "))
    || "aws-0-ap-southeast-1.pooler.supabase.com";
  const password = await askHidden("Database password (tidak ditampilkan): ");
  if (!project || !password) {
    console.error("\nProject ref dan password wajib diisi.");
    process.exit(1);
  }
  // Port 5432 = session mode. Lihat catatan di atas.
  return `postgresql://postgres.${project}:${encodeURIComponent(password)}@${host}:5432/postgres`;
})());

const client = new pg.Client({
  connectionString,
  // Supabase mewajibkan TLS. Verifikasi sertifikat TIDAK dimatikan di sini:
  // kalau gagal, itu informasi yang perlu kamu lihat, bukan yang perlu
  // dibungkam. Node memakai CA bawaannya.
  ssl: { ca: readFileSync(CA_PATH, "utf8"), rejectUnauthorized: true },
  // Sebuah migrasi bisa memakan waktu; jangan putus di tengah DDL.
  statement_timeout: 120_000,
});

console.log(`\nMenerapkan ${file} …`);
try {
  await client.connect();
} catch (e) {
  console.error(`\nGAGAL tersambung: ${e.message}`);
  if (/self.signed|certificate/i.test(e.message)) {
    console.error("Sertifikat server tidak cocok dengan CA di supabase/prod-ca-2021.crt.");
    console.error("Kalau Supabase sudah memutar CA-nya, unduh yang baru dari");
    console.error("https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt");
    console.error("dan timpa berkas itu. JANGAN mematikan verifikasi sertifikat.");
  } else if (/tenant.*not found/i.test(e.message)) {
    // Diperiksa SEBELUM pola jaringan: pooler mengemas pesan ini di dalam
    // error ber-ENOTFOUND, jadi urutan terbalik akan menyalahkan jaringan
    // untuk masalah yang sebenarnya cuma salah host pooler.
    console.error("Host pooler-nya bukan yang ini. Coba tukar awalan aws-0 <-> aws-1,");
    console.error("atau region lain. 'Tenant not found' berarti TLS dan jaringan sudah benar.");
  } else if (/password|authentication/i.test(e.message)) {
    console.error("Password database salah. Ini BUKAN anon key dan bukan kata sandi akunmu;");
    console.error("ini password Postgres yang dibuat saat project dibuat.");
  } else if (/ENOTFOUND|ETIMEDOUT|ENETUNREACH/i.test(e.message)) {
    console.error("Host tidak terjangkau. Kalau host-nya db.<ref>.supabase.co, itu IPv6-only;");
    console.error("pakai host pooler (aws-…pooler.supabase.com) port 5432.");
  }
  process.exit(1);
}

try {
  // Dikirim sebagai SATU perintah, persis seperti mem-paste seluruh berkas ke
  // SQL Editor. Berkas migrasinya sudah membungkus dirinya dalam
  // `begin; ... commit;`, jadi kegagalan di tengah membatalkan semuanya.
  await client.query(sql);
  console.log("BERHASIL. Berkas diterapkan tanpa error.\n");

  // "Tidak ada error" belum tentu "ada isinya": berkas yang seluruhnya memakai
  // `if not exists` juga selesai mulus di database yang tidak berubah sama
  // sekali. Jadi laporkan apa yang SEKARANG benar-benar ada.
  const { rows: tables } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name = any($1) order by table_name`,
    [["broadcasts", "broadcast_recipients", "task_comments"]],
  );
  const { rows: policies } = await client.query(
    `select tablename, count(*)::int as n from pg_policies
      where schemaname = 'public' and tablename = any($1)
      group by tablename order by tablename`,
    [["broadcasts", "broadcast_recipients", "task_comments"]],
  );
  console.log("Tabel fitur baru yang ada sekarang:");
  for (const t of tables) {
    const pol = policies.find((x) => x.tablename === t.table_name);
    console.log(`  - ${t.table_name} (${pol ? pol.n : 0} policy RLS)`);
  }
  if (!tables.length) console.log("  (tidak ada - periksa lagi berkas yang kamu jalankan)");
} catch (e) {
  console.error(`\nGAGAL menerapkan: ${e.message}`);
  if (e.position) console.error(`Posisi karakter: ${e.position}`);
  if (e.hint) console.error(`Petunjuk: ${e.hint}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
