import "server-only";
import { APP_VERSION } from "@/lib/version";
import type { Passage } from "./retrieve";

// ============================================================
// How this system is BUILT, as retrievable passages.
//
// The other three sources answer different questions. The Panduan says what to
// click, the FAQ answers what people asked before, and ./live.ts holds the rows
// currently in the database. None of them says what a task actually IS: which
// fields it has, where its number comes from, why its status can change without
// anybody touching it, or what happens to a Super Link entry when the task that
// published it is deleted.
//
// That gap is what "Violet only knows about Work Breakdown" was really about.
// Ask "what does the Catatan column store" or "why did this task go overtime
// by itself" and the retriever found a Panduan step about clicking Tambah, so
// the answer was either vague or an "I do not know" about behaviour the system
// very much has.
//
// RULES FOR EDITING THIS FILE:
//  * Describe BEHAVIOUR and FIELDS, never credentials, environment variables,
//    table DDL, or anything an attacker would find useful. Rule 6 of the system
//    prompt forbids Violet repeating raw schema at people, and the passages
//    here are written the way a colleague would explain it, not as SQL.
//  * Spell out synonyms. Retrieval is lexical (see retrieve.ts): a passage is
//    only findable through words it literally contains, and people ask about
//    "tenggat", "deadline" and "batas waktu" interchangeably.
//  * When you add a field or change a rule anywhere in the app, update the
//    matching passage here in the same change. This is now part of the
//    "update the Panduan too" habit in AGENTS.md.
// ============================================================

const p = (id: string, source: string, href: string | undefined, text: string): Passage => ({
  id: `system-${id}`,
  parent: "system-overview",
  source,
  href,
  text,
});

/**
 * The one passage every other system passage points at, so a question that
 * matches one field ends up with the shape of the whole thing beside it.
 */
const overview: Passage = {
  id: "system-overview",
  source: "Cara kerja sistem",
  href: "/panduan",
  text:
    "Ormawa Visit Management System, versi " + APP_VERSION + ", dipakai Departemen External Affairs HMSI ITS " +
    "untuk mengelola program Ormawa Visit (kunjungan benchmarking antar himpunan mahasiswa). " +
    "Sistem ini menggantikan spreadsheet Main Sheet Ormawa Visit. " +
    "Struktur datanya bertingkat: satu ORMAWA VISIT (edisi, edition, event) memuat divisi, anggota, tugas, " +
    "prospek himpunan, rundown, job hari-H, anggaran, dan tautan. " +
    "Menu yang ada: Dashboard, Work Breakdown (WBS, tugas), Kalender, Rundown, Job Hari-H, " +
    "Reach & Offer (prospek), Super Link (tautan), Anggaran (RAB), Divisi & Anggota, Daftar Ormawa Visit, " +
    "Role Request, FAQ, Panduan, dan Pengaturan. " +
    "Hampir semua data terikat pada satu Ormawa Visit, jadi mengganti Ormawa Visit aktif di bagian atas " +
    "mengganti isi hampir seluruh menu.",
};

/**
 * Field-level descriptions of every entity, plus the rules that are not
 * visible on screen. Static, so this costs nothing until something matches.
 */
export function systemPassages(): Passage[] {
  return [
    overview,

    p("event", "Struktur data: Ormawa Visit (edisi)", "/events",
      "Satu Ormawa Visit (edisi, edition, event, OV) menyimpan: judul, kode, himpunan partner, kampus, " +
      "lokasi, tipe (internal atau external), mode (offline atau online), kabinet, tanggal acara, " +
      "rentang tanggal perencanaan, status (planning, active, done), urutan, dan tanda arsip (locked). " +
      "Setelah acara selesai ada juga Performance Measurement: jumlah kehadiran fungsionaris HMSI, " +
      "jumlah dan rata-rata rating feedback dari HMSI, jumlah dan rata-rata rating feedback dari himpunan partner, " +
      "serta tautan LPJ (laporan pertanggungjawaban). Semua isian Performance Measurement boleh dikosongkan, " +
      "dan Dashboard menampilkan 'belum diisi' alih-alih angka nol yang menyesatkan. " +
      "Ormawa Visit baru bisa MENYALIN data dari edisi lain per menu (divisi, anggota, prospek, tugas, rundown, " +
      "job hari-H, anggaran), dan tiap menu boleh disalin dari edisi yang berbeda. " +
      "Salinan tugas selalu mulai dari nol: status kembali todo, PIC dan hasil dikosongkan. " +
      "MENGHAPUS sebuah Ormawa Visit menghapus SELURUH datanya: divisi, anggota, tugas, prospek, rundown, " +
      "job hari-H, anggaran, dan entri Super Link-nya. Tidak ada yang tertinggal atau pindah ke edisi lain."),

    p("archive", "Aturan: arsip / kunci edisi", "/events",
      "Sebuah Ormawa Visit bisa DIARSIPKAN (dikunci, locked, archive). Setelah dikunci, seluruh datanya " +
      "hanya bisa DILIHAT oleh semua peran kecuali Admin: tombol simpan, tambah, dan hapus mati di setiap menu " +
      "yang berisi data edisi itu. Admin tetap bisa mengubah supaya bisa memperbaiki lalu membuka kuncinya lagi. " +
      "Aturan ini ditegakkan di database, bukan hanya di tampilan, jadi tidak bisa diakali dari sisi browser. " +
      "Kalau sebuah tombol hilang dan ada spanduk 'Ormawa Visit ini diarsipkan', itu sebabnya."),

    p("task", "Struktur data: tugas (Work Breakdown)", "/tasks",
      "Satu tugas di Work Breakdown (WBS) menyimpan: nomor urut, divisi pemilik, judul, PIC (boleh lebih dari " +
      "satu nama dipisah koma), tanggal mulai, tanggal selesai alias deadline atau tenggat atau batas waktu, " +
      "catatan, evaluasi, hasil (deskripsi teks), status, tautan hasil, dan tautan referensi. " +
      "Kolom EVALUASI (di sebelah kanan kolom Tugas) berisi pelajaran atau masukan untuk tugas itu dari " +
      "Ormawa Visit sebelumnya dan/atau Ormawa Visit sekarang; saat tugas disalin ke Ormawa Visit baru, " +
      "evaluasinya ikut tersalin supaya pelajarannya tidak hilang. " +
      "Statusnya ada empat: Belum (todo), Berjalan (ongoing), Selesai (done), dan Overtime. " +
      "Kolom Catatan berisi keterangan bebas soal tugas itu; kalau isinya panjang, tabel memotongnya dan " +
      "ada tombol Selengkapnya untuk membuka teks penuh tanpa masuk ke mode edit. " +
      "Nomor tugas diberikan otomatis dan berurut PER DIVISI dalam satu Ormawa Visit, jadi angka yang sama " +
      "bisa muncul di divisi berbeda. Karena itu kolom '#' di tabel hanyalah nomor baris di layar."),

    p("overtime", "Aturan: status Overtime muncul sendiri", "/tasks",
      "Status Overtime TIDAK perlu diisi manual dan tidak diubah oleh siapa pun. Sebuah tugas otomatis " +
      "terbaca Overtime ketika deadline-nya sudah lewat sedangkan statusnya belum Selesai. " +
      "Perhitungannya dilakukan setiap kali data dibaca, bukan lewat penjadwalan harian, jadi angkanya selalu " +
      "sesuai hari ini. Status yang tersimpan hanya bisa NAIK ke Overtime, tidak pernah turun sendiri: " +
      "menandai tugas Selesai langsung menghapus status Overtime-nya."),

    p("task-links", "Aturan: tautan hasil tugas vs tautan referensi", "/tasks",
      "Satu tugas punya DUA jenis tautan yang arahnya berlawanan. " +
      "TAUTAN HASIL adalah keluaran tugas (Drive, Docs, foto). SETIAP tautan hasil WAJIB diberi judul dan " +
      "SELALU terbit sebagai entri Super Link (tidak bisa dimatikan), dan tugas tersebut MEMILIKI entri itu: " +
      "menyimpan ulang memperbarui entri yang sama (tidak menggandakan), menghapus tautan hasilnya menghapus " +
      "entrinya, dan menghapus tugasnya ikut menghapus entrinya. Satu entri Super Link hanya boleh dimiliki satu " +
      "tugas. Entri milik tugas tidak bisa dihapus dari menu Super Link; hapus tautannya dari tugasnya. " +
      "TAUTAN REFERENSI adalah bahan rujukan yang DIPAKAI tugas (handbook, template, proposal tahun lalu). " +
      "Referensi boleh diketik manual atau diambil dari Super Link, dan satu entri Super Link boleh dirujuk " +
      "oleh banyak tugas sekaligus. Referensi yang diambil dari Super Link SELALU memakai URL terbaru entri itu, " +
      "jadi memperbaiki alamatnya di Super Link langsung memperbaiki semua tugas yang merujuknya, dan " +
      "mengganti judul entrinya ikut mengganti nama referensinya (kecuali nama referensi itu sudah diubah sendiri). " +
      "Kalau entri Super Link yang dirujuk DIHAPUS (misalnya tugas pemiliknya menghapus tautan hasilnya), " +
      "referensinya tidak ikut hilang: alamat dan judul terakhirnya disimpan, lalu referensi itu diberi tanda " +
      "segitiga kuning 'sumbernya sudah dihapus dari Super Link' dan bisa diganti lewat tombol Ganti. " +
      "Sebelum menghapus tautan hasil yang sedang dirujuk tugas lain, formulir meminta konfirmasi sekali lagi."),

    p("task-comments", "Aturan: catatan & diskusi pada tugas", "/tasks",
      "Tiap tugas di Work Breakdown bisa diberi CATATAN (komentar, comment, diskusi, revisi, masukan) yang " +
      "berbentuk obrolan kecil menempel pada tugas itu saja. Satu tugas boleh punya lebih dari satu catatan. " +
      "Catatan dibuka lewat tombol Edit pada tugasnya, di bagian 'Catatan & Diskusi' paling bawah. " +
      "SIAPA YANG BOLEH: catatan awal (catatan pembuka, komentar inisiasi) hanya bisa dibuat oleh Admin, " +
      "Koordinator, dan Staff. Intern TIDAK bisa memulai catatan baru, tapi Intern BOLEH membalas catatan " +
      "yang sudah ada. Tamu hanya bisa membaca. " +
      "NOTIFIKASI: tugas yang punya catatan belum selesai menampilkan lencana kecil berisi angka jumlahnya, " +
      "tepat di samping judul tugas di tabel Work Breakdown dan di kartu Kanban, ditambah garis penanda " +
      "di tepi kiri barisnya. Lencananya diklik untuk membuka obrolan mini berisi catatan itu, siapa " +
      "penulisnya, dan kapan dikirim. Kalau sebuah tugas tidak punya catatan terbuka, lencananya tidak " +
      "muncul sama sekali. " +
      "SELESAI: catatan awal punya tombol centang 'Tandai selesai'. Menandainya selesai menutup " +
      "notifikasi pada tugas itu, tapi percakapannya TETAP bisa dibalas dan tetap terbaca lewat tombol Edit. " +
      "Tombol 'Buka lagi' mengembalikannya jadi belum selesai. " +
      "Balasan hanya satu tingkat: balasan ditujukan ke catatan awal, bukan ke balasan lain. " +
      "Menghapus catatan awal ikut menghapus seluruh balasannya. Seseorang boleh menghapus catatannya " +
      "sendiri; menghapus catatan orang lain butuh akses penuh (Admin atau Koordinator). " +
      "Catatan tidak ikut tersalin ketika tugas disalin ke Ormawa Visit lain, karena salinan selalu mulai dari nol."),

    p("inbox", "Struktur data & aturan: Kotak Masuk (siaran admin)", "/inbox",
      "Menu KOTAK MASUK (inbox, pesan, pengumuman, siaran, broadcast) berisi pesan yang dikirim admin ke " +
      "akun-akun tertentu. Satu siaran menyimpan judul, isi pesan, siapa pengirimnya, kapan dikirim, dan " +
      "kapan terakhir diubah. " +
      "SIAPA YANG BOLEH MENGIRIM: hanya Admin. Koordinator, Staff, dan Intern hanya bisa membaca " +
      "kotak masuknya sendiri, dan tidak bisa melihat pesan milik akun lain. " +
      "TAMU TIDAK PUNYA AKSES sama sekali ke menu Kotak Masuk: menunya tidak muncul untuknya dan " +
      "alamatnya dialihkan ke Dashboard. Sesi Tamu dipakai bersama banyak orang sehingga tidak mewakili " +
      "satu akun, jadi tidak ada kotak masuk yang bisa jadi miliknya, dan Tamu juga tidak bisa dipilih " +
      "sebagai tujuan siaran. " +
      "TUJUAN SIARAN ada tiga bentuk: seluruh akun; akun dengan peran tertentu (boleh beberapa peran " +
      "sekaligus); atau akun tertentu yang dipilih satu per satu, termasuk kalau yang dipilih hanya satu " +
      "akun. Sebelum dikirim, sistem menunjukkan berapa kotak masuk yang akan menerimanya, dan menolak " +
      "mengirim kalau tidak ada akun yang cocok. " +
      "DAFTAR PENERIMA DIBEKUKAN saat siaran dikirim. Akun yang mendaftar setelah itu tidak menerima siaran " +
      "lama, dan mengubah peran seseorang tidak menambah maupun mengurangi isi kotak masuknya. " +
      "BELUM DIBACA: pesan ditandai sudah dibaca ketika DIBUKA, bukan saat halamannya dibuka. Jumlah pesan " +
      "yang belum dibaca muncul sebagai angka di samping menu Kotak Masuk, terlihat dari halaman mana pun. " +
      "Ada tombol untuk menandai satu pesan kembali belum dibaca, dan tombol untuk menandai semuanya sudah dibaca. " +
      "Admin bisa mengubah dan menghapus siaran yang sudah terkirim; menghapusnya menghilangkan pesan itu dari " +
      "kotak masuk semua penerimanya, dan mengubah tujuannya tidak menandai ulang pesan bagi yang sudah membaca. " +
      "Siaran TIDAK terikat Ormawa Visit mana pun, karena ditujukan ke akun, dan akun tidak punya lingkup edisi. " +
      "Menu Role Request juga menampilkan angka notifikasi berisi jumlah pengajuan peran yang belum ditangani, " +
      "dan itu hanya terlihat oleh Admin."),

    p("account", "Aturan: akun, foto profil, dan akun bersama", "/settings",
      "AKUN di sistem ini menyimpan nama tampilan, email, peran, dan foto profil. " +
      "MENGUBAH INFORMASI AKUN: lewat menu akun di pojok kanan atas, pilih 'Ubah Informasi Akun', " +
      "atau tombol Ubah pada kartu Akun Saya di menu Pengaturan. Yang bisa diubah sendiri hanya " +
      "NAMA TAMPILAN dan FOTO PROFIL. Email dan peran TIDAK bisa diubah dari sana: peran diberikan " +
      "admin lewat menu Role Request, dan email adalah kredensial login. " +
      "FOTO PROFIL (avatar, gambar profil, karakter): tersedia lima pilihan karakter - Rubah, Panda, " +
      "Burung, Kucing, dan Beruang - atau tetap memakai inisial nama, yang merupakan tampilan bawaannya. " +
      "AKUN BERSAMA: tiga akun default coordinator@ormawavisit.id, staff@ormawavisit.id, dan " +
      "intern@ormawavisit.id ditandai sebagai akun bersama karena dipakai banyak orang sekaligus. " +
      "Kata sandi akun bersama TIDAK BISA DIUBAH dari dalam aplikasi, dan menu 'Ubah Kata Sandi' " +
      "memang tidak muncul untuknya: kalau satu orang menggantinya, semua orang lain terkunci. " +
      "Rotasinya hanya bisa dilakukan admin lewat SQL, dan itu ditegakkan database, bukan hanya tampilan. " +
      "KATA SANDI AKUN GOOGLE: akun yang mendaftar lewat Google tidak punya kata sandi di sistem ini, " +
      "jadi tidak ada yang bisa diubah di sini. Kata sandinya diatur di akun Google masing-masing."),

    p("himpunan", "Struktur data: menu Himpunan (FGD & Compare)", "/himpunan",
      "Menu Himpunan menyiapkan pertemuan dengan himpunan mitra dan berisi dua hal. " +
      "PLOTTING FGD (Focus Group Discussion): tabel dua kolom yang memasangkan tiap departemen HMSI ITS " +
      "dengan departemen padanannya di himpunan mitra. Satu Ormawa Visit boleh punya beberapa tabel, " +
      "tiap tabel menyimpan judul opsional dan nama himpunan mitra, dan barisnya bisa ditambah, diubah, " +
      "dihapus, maupun DISERET untuk mengubah urutannya (urutan itu tersimpan untuk semua orang). Tabel baru otomatis terisi sepuluh departemen HMSI ITS: Executive Board, " +
      "External Affairs, Human Resource Development, Manage, Internal Affair, Student Welfare, " +
      "Research and Technology Application, Information Media, Social Development, dan Entrepreneurship. " +
      "Departemen ini BUKAN divisi kepanitiaan: divisi (LO, Event, Konsumsi, dan seterusnya) adalah " +
      "pembagian kerja di dalam External Affairs untuk satu Ormawa Visit, sedangkan departemen adalah " +
      "struktur himpunannya. " +
      "COMPARE: membandingkan himpunan yang MENERIMA ajakan, untuk memilih mitra. Tiap penilaian berisi " +
      "Aspek Penilaian, Indikator yang Dinilai, Plus atau Kelebihan, dan Minus atau Kekurangan. " +
      "Compare hanya terbuka kalau di Reach & Offer ada LEBIH DARI SATU himpunan dengan Respons Mereka " +
      "DITERIMA, karena dengan satu himpunan saja tidak ada pilihan yang perlu ditimbang. " +
      "Hak akses menu ini: Admin, Koordinator, dan Staff bisa membuat, mengubah, dan menghapus; " +
      "Intern dan Tamu hanya melihat."),

    p("prospect", "Struktur data: prospek (Reach & Offer)", "/prospects",
      "Reach & Offer mencatat himpunan yang dihubungi untuk diajak Ormawa Visit. Satu prospek menyimpan: " +
      "nomor urut, nama ormawa atau himpunan, asal kampus, kontak, PIC dari pihak kita, lokasi, " +
      "mode (offline atau online), Status Hubungi (MENGHUBUNGI atau DIHUBUNGI), Respons Mereka " +
      "(DITUNGGU, DITERIMA, DITOLAK), Respons Kita (TUNGGU, TERIMA, TOLAK), tanda selesai, catatan bebas, " +
      "dan sekumpulan tautan. " +
      "Tahap pipeline (reach, menunggu, diterima, ditolak, dan seterusnya) TIDAK disimpan sebagai kolom " +
      "tersendiri: tahapnya disimpulkan dari kombinasi Status Hubungi, Respons Mereka, dan Respons Kita."),

    p("prospect-links", "Aturan: banyak tautan per prospek", "/prospects",
      "Sejak versi 1.35.0 satu prospek boleh punya LEBIH DARI SATU tautan, karena satu himpunan biasanya " +
      "mengirim beberapa berkas sekaligus: handbook, profil organisasi, dan proposal balasan. " +
      "Sebelumnya hanya ada satu kolom tautan, jadi menyimpan yang kedua berarti menimpa yang pertama. " +
      "Tiap tautan punya alamat, nama opsional, dan kotak 'Tampilkan juga di Super Link'. " +
      "Aturannya sama persis dengan tautan hasil tugas: tautan yang diterbitkan memiliki entri Super Link-nya " +
      "sendiri di kelompok 'Reach & Offer', menyimpan ulang memperbaruinya alih-alih menggandakan, " +
      "melepas centang atau menghapus tautannya ikut menghapus entri Super Link-nya, dan menghapus prospeknya " +
      "membawa semuanya. Satu alamat tidak boleh dipasang dua kali pada prospek yang sama."),

    p("prospect-primary", "Aturan: data utama Ormawa Visit", "/prospects",
      "Salah satu prospek bisa ditandai sebagai DATA UTAMA (primary) sebuah Ormawa Visit, artinya himpunan " +
      "itulah partner yang jadi. Menandainya MENYALIN nama himpunan, kampus, lokasi, dan mode prospek tersebut " +
      "ke data Ormawa Visit-nya, dan mengedit prospek utama itu menyalinkannya lagi. " +
      "Hanya boleh ada satu data utama per Ormawa Visit: menandai yang baru otomatis melepas yang lama. " +
      "Di tabel, prospek utama ditandai bintang kuning dan prospek yang sudah selesai ditandai hijau bercoret."),

    p("division", "Struktur data: divisi", "/members",
      "Divisi menyimpan: kunci (key), nama, singkatan maksimal 4 huruf huruf besar, warna, urutan, " +
      "dan pilihan 'tidak diikutsertakan pada rundown'. " +
      "Divisi bersifat PER ORMAWA VISIT, bukan global: tiap edisi punya daftar divisinya sendiri, dan dua edisi " +
      "boleh memakai nama divisi yang sama tanpa saling terkait. " +
      "Divisi yang ditandai tidak ikut rundown (biasanya PIC, Koordinator, Sekretaris, Bendahara) tidak muncul " +
      "sebagai kolom di tabel rundown. " +
      "Kalau sebuah divisi dihapus, tugas yang dulu miliknya TIDAK ikut terhapus: tugas itu jadi tanpa divisi " +
      "dan masih bisa ditemukan lewat pilihan 'Tanpa divisi' pada filter divisi. Anggotanya dilepas dari divisi " +
      "itu (divisi lain yang mereka ikuti tetap), dan koordinator divisi itu ikut terhapus. " +
      "Kunci (key) divisi tidak pernah berubah setelah dibuat; yang bisa diganti hanya nama, singkatan, dan warna."),

    p("member", "Struktur data: anggota & tim", "/members",
      "Anggota (roster External Affairs) menyimpan: nama, nama panggilan, NRP, tipe (fungsionaris atau intern), " +
      "angkatan, dan daftar divisi. " +
      "Satu anggota boleh berada di BEBERAPA divisi sekaligus; divisi pertamanya dipakai sebagai divisi utama " +
      "untuk badge dan pengurutan. " +
      "Angkatan tidak diketik: sistem menurunkannya dari NRP (digit ke-5 dan ke-6 adalah tahun masuk). " +
      "Struktur tim sebuah divisi TIDAK disimpan terpisah, melainkan diturunkan dari roster: siapa saja yang " +
      "punya divisi itu, dialah anggotanya. Yang disimpan pada tim hanyalah KOORDINATOR divisi, dan itu opsional " +
      "(sebuah divisi boleh belum punya koordinator). " +
      "MENGGANTI NAMA anggota (nama diganti, ganti nama, rename) atau nama panggilannya ikut mengganti namanya " +
      "di PIC tugas, PIC Job Hari-H, PIC " +
      "prospek, dan koordinator divisi pada Ormawa Visit yang sama, kecuali ada anggota lain yang memakai nama " +
      "yang sama (supaya tugas orang lain tidak ikut berpindah). Anggota yang dihapus, keluar dari sebuah divisi, " +
      "atau diubah menjadi intern otomatis dilepas dari kursi koordinator divisi itu. Namanya TETAP tercatat " +
      "sebagai PIC tugas lama, karena tugas yang sudah dikerjakan tetap mencatat siapa yang mengerjakannya. " +
      "Nama dan NRP adalah data pribadi, jadi peran Tamu tidak bisa membacanya sama sekali dan akan melihat " +
      "roster kosong beserta pemberitahuannya."),

    p("rundown", "Struktur data: rundown", "/rundown",
      "Rundown adalah susunan acara hari-H, satu baris per sesi, dan diisi langsung di tabel (bukan lewat " +
      "dialog): setiap sel tersimpan otomatis saat kamu berpindah dari sel itu. " +
      "Satu baris menyimpan: nomor, jam mulai, jam selesai, durasi, kegiatan, MC, kebutuhan operator, " +
      "kolom tugas untuk SETIAP divisi yang ikut rundown, dan catatan. " +
      "Durasi TIDAK diketik: sistem menghitungnya dari jam mulai dan jam selesai. " +
      "Menambah baris baru memakai jam selesai baris terakhir sebagai jam mulainya. " +
      "Empat kolom pertama (No, Waktu, Durasi, Kegiatan) dibekukan supaya tetap terlihat saat menggulir " +
      "ke samping, dan sel yang isinya sama pada beberapa baris berurutan bisa digabung."),

    p("jobs", "Struktur data: Job Hari-H", "/jobs",
      "Job Hari-H adalah pembagian tugas saat acara berlangsung, terpisah dari Work Breakdown yang berisi " +
      "persiapan. Satu baris menyimpan: nomor, PIC (boleh beberapa orang), pekerjaan, dan catatan. " +
      "Urutannya diatur dengan menyeret baris memakai pegangan di kiri, dan nomornya ditulis ulang mengikuti " +
      "urutan baru. Catatan yang panjang dipotong di tabel dengan tombol Selengkapnya untuk membukanya."),

    p("budget", "Struktur data: anggaran (RAB)", "/budget",
      "Anggaran berisi satu atau beberapa RENCANA (RAB) per Ormawa Visit, dan tiap rencana berisi item. " +
      "Satu rencana ditandai sebagai RENCANA UTAMA, dan totalnya itulah angka anggaran edisi tersebut: " +
      "itu yang tampil di Dashboard, di kartu atas halaman Anggaran, dan di daftar Ormawa Visit. " +
      "Rencana lain (misalnya RAB Minimal di samping RAB Maksimal) adalah SKENARIO pembanding untuk uang " +
      "yang sama, jadi totalnya TIDAK dijumlahkan dengan rencana utama. " +
      "Rencana pertama sebuah Ormawa Visit otomatis menjadi rencana utama, dan hanya boleh ada SATU " +
      "rencana utama per Ormawa Visit: menunjuk yang baru otomatis melepas yang lama. " +
      "Satu item menyimpan: kategori, nomor, nama, qty (jumlah), satuan, harga satuan, dan total. " +
      "Total dihitung dari qty dikali harga satuan dan selalu dibulatkan ke rupiah utuh. " +
      "Warna titik kategori dimiliki oleh KATEGORINYA, bukan oleh satu item: menggantinya mengubah warna " +
      "seluruh item dalam kategori itu pada rencana yang sama. " +
      "Nama item, qty, satuan, dan harga satuan semuanya diedit LANGSUNG di tabelnya, tanpa membuka pop-up. " +
      "Kolom angka tersimpan sambil diketik (termasuk lewat panah naik-turun); kolom teks tersimpan saat " +
      "kamu keluar dari selnya atau menekan Enter, dan Esc membatalkan. Nama item tidak boleh dikosongkan, " +
      "satuan boleh. " +
      "Item bisa DISERET untuk mengubah urutannya, dan seretan itu boleh KELUAR dari kategorinya: " +
      "menjatuhkannya di baris judul kategori lain memindahkannya ke urutan teratas kategori itu, " +
      "menjatuhkannya di antara item kategori lain memindahkan sekaligus menentukan posisinya. " +
      "Item yang pindah mengambil warna kategori tujuannya, dan judul kategori di tabel diturunkan dari " +
      "urutan item, jadi tiap kategori selalu tampil sebagai satu blok utuh."),

    p("superlink", "Struktur data: Super Link", "/links",
      "Super Link adalah direktori tautan penting: dokumen, form, folder Drive. Satu entri menyimpan: " +
      "Ormawa Visit pemilik, divisi (boleh kosong, berarti Umum), nama, alamat URL, dan catatan. " +
      "URL WAJIB diisi dan harus berupa tautan sungguhan; aturan itu ditegakkan sampai di database. " +
      "Entri dikelompokkan dua tingkat: per Ormawa Visit, lalu per divisi. " +
      "Sebagian entri tidak dibuat langsung di sini melainkan TERBIT OTOMATIS dari tempat lain: dari tautan " +
      "hasil sebuah tugas (kelompok 'Hasil Tugas') atau dari tautan sebuah prospek (kelompok 'Reach & Offer'). " +
      "Entri semacam itu diberi label sumbernya ('Dari Work Breakdown' atau 'Dari Reach & Offer') dan tetap " +
      "tersambung dua arah: mengubah NAMA atau URL-nya di Super Link ikut mengubahnya di tugas atau prospek " +
      "asalnya, sedangkan divisi dan catatannya mengikuti sumbernya dan dikunci di sini. Menghapusnya dari " +
      "Super Link mencabut centang 'Tampilkan juga di Super Link' pada sumbernya, tautannya sendiri tetap ada. " +
      "Memindahkan tugas ke divisi lain ikut memindahkan entri hasilnya ke kelompok divisi baru."),

    p("integration", "Aturan: menu yang saling terhubung (integrasi otomatis)", "/panduan",
      "Menu-menu di sistem ini SALING TERHUBUNG: mengubah data di satu menu otomatis memperbarui menu lain, " +
      "tanpa perlu mengetik ulang. Hubungan terpentingnya: " +
      "Work Breakdown dan Kalender dan Papan Divisi menampilkan tugas yang SAMA, jadi mengubah di satu tempat " +
      "langsung terlihat di semuanya, begitu juga progres per divisi di Divisi & Anggota dan angka di Dashboard. " +
      "Tautan hasil tugas dan tautan prospek bisa terbit ke Super Link dan tetap tersambung dua arah. " +
      "Prospek yang dijadikan data utama menyalin nama himpunan, kampus, lokasi, dan mode ke Ormawa Visit-nya. " +
      "Respons DITERIMA di Reach & Offer membuka fitur Compare di menu Himpunan, dan mengganti nama himpunan " +
      "di Reach & Offer ikut mengganti nama kartu perbandingannya. " +
      "Anggota di Divisi & Anggota adalah sumber daftar PIC di Work Breakdown, Job Hari-H, dan Reach & Offer; " +
      "mengganti namanya ikut mengganti nama PIC tersebut. Divisi menentukan kolom di Rundown dan kelompok di " +
      "Super Link. Rencana utama Anggaran menentukan angka anggaran di Dashboard dan daftar Ormawa Visit. " +
      "Yang sengaja TIDAK tersambung: nama mitra di tabel Plotting FGD (diketik bebas karena sering dibuat " +
      "sebelum mitranya pasti), MC dan operator di Rundown (teks bebas), dan data Ormawa Visit yang tetap " +
      "seperti semula ketika tanda data utama dilepas."),

    p("filters", "Cara pakai: filter dan pencarian di tabel", undefined,
      "Setiap tabel yang punya penyaring memakai KOTAK CENTANG, bukan pilihan tunggal, jadi beberapa nilai bisa " +
      "aktif bersamaan: misalnya melihat prospek yang DITERIMA dan yang DITOLAK sekaligus, atau tugas yang " +
      "Belum dan yang Overtime sekaligus. " +
      "Tidak mencentang apa pun berarti tidak menyaring, yaitu semuanya tampil. Menunya tetap terbuka saat " +
      "mencentang, dan ada tombol Bersihkan untuk mengosongkan pilihan. " +
      "Penyaring yang tersedia: Work Breakdown punya fokus divisi, fokus PIC, dan status; Reach & Offer punya " +
      "tahap; Super Link punya Ormawa Visit; Divisi & Anggota punya tipe anggota. " +
      "Selain itu ada kotak pencarian teks di tiap menu, dan pencarian global lintas menu lewat tombol pencarian " +
      "di bagian atas. " +
      "Mengurutkan tabel bisa BERTINGKAT: mengklik kolom kedua menambahkannya sebagai pengurut cadangan, " +
      "bukan menggantikan yang pertama, dan angka kecil di sebelah panah menunjukkan urutan prioritasnya."),

    p("notes", "Cara pakai: catatan panjang di tabel", undefined,
      "Kolom catatan di tabel (Work Breakdown, Reach & Offer, Job Hari-H, Super Link) memotong teks yang " +
      "kepanjangan dan menampilkan tombol Selengkapnya di bawahnya. Klik untuk membaca isinya secara penuh " +
      "di tempat, lalu Tutup untuk merapikannya lagi. Tidak perlu membuka tombol Edit hanya untuk membaca " +
      "catatan, dan itu berlaku juga untuk peran yang memang tidak boleh mengubah data. " +
      "Catatan di tabel Rundown berbeda: sel-nya bisa diketik langsung dan tingginya melar mengikuti isi, " +
      "jadi tidak pernah terpotong."),

    p("roles", "Aturan: peran, akses, dan pengajuan peran", "/settings#akses",
      "Ada lima peran: Admin, Koordinator, Staff, Intern, dan Tamu. Peran berlaku GLOBAL untuk semua Ormawa " +
      "Visit; sebuah akun tidak terikat divisi maupun edisi tertentu, karena akun mewakili tingkat akses, " +
      "bukan orang. Satu akun bahkan boleh dipakai bersama beberapa orang. " +
      "Tiap menu punya salah satu dari empat tingkat akses: penuh (buat, ubah, hapus), terbatas (buat dan ubah, " +
      "tidak boleh hapus), hanya lihat, atau tidak ada akses. Tabel lengkapnya ada di Pengaturan. " +
      "Siapa pun boleh mendaftar sendiri lewat email dan kata sandi atau lewat Google; akun baru otomatis jadi " +
      "Tamu dan harus mengajukan peran lewat menu akun, lalu disetujui Admin di menu Role Request. " +
      "Pengajuan yang masih menunggu boleh diubah dan diajukan ulang oleh pemiliknya; yang sudah diputuskan " +
      "tidak bisa diubah lagi. Admin tidak bisa mengajukan peran (tidak ada jalur menurunkan diri sendiri)."),

    p("backup", "Aturan: backup, pulihkan, dan Mode Demo", "/settings#backup",
      "Backup dibuat MANUAL dari Pengaturan, tidak ada penjadwalan otomatis. Sebuah backup memotret seluruh " +
      "data operasional Ormawa Visit dan bisa diunduh sebagai JSON atau dipulihkan kembali. " +
      "Yang sengaja TIDAK ikut: akun beserta perannya, pengajuan peran, dan daftar backup itu sendiri, " +
      "supaya memulihkan data lama tidak diam-diam mengembalikan peran yang sudah dicabut. " +
      "Memulihkan backup selalu membuat snapshot pengaman lebih dulu dan harus dikonfirmasi dengan mengetik " +
      "kata PULIHKAN. " +
      "Mode Demo adalah database yang benar-benar TERPISAH berisi data contoh: apa pun yang dilakukan di sana " +
      "tidak menyentuh data asli, dan datanya bisa dikembalikan ke contoh awal kapan saja."),

    p("violet-limits", "Aturan: apa yang Violet lihat dan tidak lihat", "/panduan#guide-violet",
      "Violet hanya MEMBACA. Violet tidak bisa membuat, mengubah, menghapus, mengunggah, atau mengirim apa pun, " +
      "dan tidak bisa mengubah peran siapa pun. " +
      "Apa yang bisa dijawab Violet dibatasi oleh hak akses PENANYA: pembacaannya lewat jalur yang sama dengan " +
      "halaman biasa, jadi Tamu yang bertanya soal roster memang tidak mendapat apa-apa untuk dijawab. " +
      "Data yang Violet pakai selalu diambil ulang setiap pertanyaan, jadi baris yang baru saja kamu simpan " +
      "sudah bisa ditanyakan saat itu juga, tanpa perlu menunggu atau memuat ulang. " +
      "Rincian per baris tersedia untuk Ormawa Visit yang sedang DIBUKA; untuk edisi lain Violet tahu ringkasannya " +
      "(jumlah tugas, divisi, prospek, anggaran, dan daftar namanya), dan untuk rinciannya edisi itu perlu " +
      "dijadikan aktif dulu lewat pemilih Ormawa Visit di bagian atas. " +
      "Percakapan dengan Violet tidak disimpan: menutup panel atau memuat ulang halaman menghapusnya. " +
      "MODEL AI-nya bisa diganti penanya sendiri lewat nama model di kepala panel Violet, tepat di bawah tulisan " +
      "\"Violet\". Pilihannya: Otomatis (bawaan, boleh berpindah layanan sendiri kalau satu layanan penuh), " +
      "dua model Google (Gemini Flash Lite dan Gemini Flash), dan tiga model Groq (GPT-OSS 120B, GPT-OSS 20B, " +
      "Qwen 3.8 27B). Model yang dipilih sendiri dipakai apa adanya: kalau layanannya bermasalah Violet melapor " +
      "gagal, tidak diam-diam memakai model lain. Pilihan itu diingat di perangkat penanya saja. " +
      "Di bawah tiap jawaban tertulis model mana yang menulisnya."),

    p("glossary", "Istilah yang dipakai di sistem ini", "/faq",
      "Ormawa: organisasi mahasiswa. Ormawa Visit (OV): program kunjungan benchmarking antar himpunan. " +
      "HMSI ITS: Himpunan Mahasiswa Sistem Informasi ITS. EA atau External Affairs: departemen yang menjalankan " +
      "program ini. Edisi atau event: satu penyelenggaraan Ormawa Visit. " +
      "WBS atau Work Breakdown: daftar tugas persiapan. PIC: penanggung jawab. Deadline, tenggat, batas waktu: " +
      "tanggal selesai sebuah tugas. Overtime: lewat deadline dan belum selesai. " +
      "Reach & Offer: proses menghubungi dan menawari himpunan. Prospek: himpunan yang dihubungi. " +
      "Rundown: susunan acara hari-H. Job Hari-H: pembagian tugas saat acara. " +
      "RAB: rencana anggaran biaya. Super Link: direktori tautan penting. " +
      "Fungsionaris: anggota tetap departemen. Intern: anggota magang. Koordinator: atasan sebuah divisi. " +
      "Kabinet: periode kepengurusan. LPJ: laporan pertanggungjawaban."),
  ];
}
