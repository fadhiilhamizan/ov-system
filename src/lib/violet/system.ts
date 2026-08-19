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
      "Salinan tugas selalu mulai dari nol: status kembali todo, PIC dan hasil dikosongkan."),

    p("archive", "Aturan: arsip / kunci edisi", "/events",
      "Sebuah Ormawa Visit bisa DIARSIPKAN (dikunci, locked, archive). Setelah dikunci, seluruh datanya " +
      "hanya bisa DILIHAT oleh semua peran kecuali Admin: tombol simpan, tambah, dan hapus mati di setiap menu " +
      "yang berisi data edisi itu. Admin tetap bisa mengubah supaya bisa memperbaiki lalu membuka kuncinya lagi. " +
      "Aturan ini ditegakkan di database, bukan hanya di tampilan, jadi tidak bisa diakali dari sisi browser. " +
      "Kalau sebuah tombol hilang dan ada spanduk 'Ormawa Visit ini diarsipkan', itu sebabnya."),

    p("task", "Struktur data: tugas (Work Breakdown)", "/tasks",
      "Satu tugas di Work Breakdown (WBS) menyimpan: nomor urut, divisi pemilik, judul, PIC (boleh lebih dari " +
      "satu nama dipisah koma), tanggal mulai, tanggal selesai alias deadline atau tenggat atau batas waktu, " +
      "catatan, hasil (deskripsi teks), status, tautan hasil, dan tautan referensi. " +
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
      "TAUTAN HASIL adalah keluaran tugas (Drive, Docs, foto). Kalau kotak 'Tampilkan juga di Super Link' " +
      "dicentang, tautan itu ikut terbit sebagai entri Super Link dan tugas tersebut MEMILIKI entri itu: " +
      "menyimpan ulang memperbarui entri yang sama (tidak menggandakan), melepas centangnya menghapus entrinya, " +
      "dan menghapus tugasnya ikut menghapus entrinya. Satu entri Super Link hanya boleh dimiliki satu tugas. " +
      "TAUTAN REFERENSI adalah bahan rujukan yang DIPAKAI tugas (handbook, template, proposal tahun lalu). " +
      "Referensi boleh diketik manual atau diambil dari Super Link, dan satu entri Super Link boleh dirujuk " +
      "oleh banyak tugas sekaligus. Menghapus entri Super Link tidak menghapus referensinya, alamatnya tetap " +
      "tersimpan sebagai teks."),

    p("himpunan", "Struktur data: menu Himpunan (FGD & Compare)", "/himpunan",
      "Menu Himpunan menyiapkan pertemuan dengan himpunan mitra dan berisi dua hal. " +
      "PLOTTING FGD (Focus Group Discussion): tabel dua kolom yang memasangkan tiap departemen HMSI ITS " +
      "dengan departemen padanannya di himpunan mitra. Satu Ormawa Visit boleh punya beberapa tabel, " +
      "tiap tabel menyimpan judul opsional dan nama himpunan mitra, dan barisnya bisa ditambah, diubah, " +
      "maupun dihapus. Tabel baru otomatis terisi sepuluh departemen HMSI ITS: Executive Board, " +
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
      "dan masih bisa ditemukan lewat pilihan 'Tanpa divisi' pada filter divisi."),

    p("member", "Struktur data: anggota & tim", "/members",
      "Anggota (roster External Affairs) menyimpan: nama, nama panggilan, NRP, tipe (fungsionaris atau intern), " +
      "angkatan, dan daftar divisi. " +
      "Satu anggota boleh berada di BEBERAPA divisi sekaligus; divisi pertamanya dipakai sebagai divisi utama " +
      "untuk badge dan pengurutan. " +
      "Angkatan tidak diketik: sistem menurunkannya dari NRP (digit ke-5 dan ke-6 adalah tahun masuk). " +
      "Struktur tim sebuah divisi TIDAK disimpan terpisah, melainkan diturunkan dari roster: siapa saja yang " +
      "punya divisi itu, dialah anggotanya. Yang disimpan pada tim hanyalah KOORDINATOR divisi, dan itu opsional " +
      "(sebuah divisi boleh belum punya koordinator). " +
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
      "Satu item menyimpan: kategori, nomor, nama, qty (jumlah), satuan, harga satuan, dan total. " +
      "Total dihitung dari qty dikali harga satuan dan selalu dibulatkan ke rupiah utuh. " +
      "Warna titik kategori dimiliki oleh KATEGORINYA, bukan oleh satu item: menggantinya mengubah warna " +
      "seluruh item dalam kategori itu pada rencana yang sama. " +
      "Kolom angka tersimpan sambil diketik (termasuk lewat panah naik-turun), Enter menyimpan lalu keluar " +
      "dari sel, dan Esc membatalkan."),

    p("superlink", "Struktur data: Super Link", "/links",
      "Super Link adalah direktori tautan penting: dokumen, form, folder Drive. Satu entri menyimpan: " +
      "Ormawa Visit pemilik, divisi (boleh kosong, berarti Umum), nama, alamat URL, dan catatan. " +
      "URL WAJIB diisi dan harus berupa tautan sungguhan; aturan itu ditegakkan sampai di database. " +
      "Entri dikelompokkan dua tingkat: per Ormawa Visit, lalu per divisi. " +
      "Sebagian entri tidak dibuat langsung di sini melainkan TERBIT OTOMATIS dari tempat lain: dari tautan " +
      "hasil sebuah tugas (kelompok 'Hasil Tugas') atau dari tautan sebuah prospek (kelompok 'Reach & Offer'). " +
      "Entri semacam itu tetap mengikuti sumbernya, jadi memperbaikinya sebaiknya dari tugas atau prospek asalnya."),

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
      "Percakapan dengan Violet tidak disimpan: menutup panel atau memuat ulang halaman menghapusnya."),

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
