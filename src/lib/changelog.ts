// ============================================================
// Riwayat perubahan yang tampil di Pengaturan.
//
// GAYA PENULISAN (ikuti ini saat menambah entri):
//   - Satu baris = satu perubahan, satu kalimat, langsung ke intinya.
//   - Mulai dari APA yang berubah bagi pengguna, bukan cerita teknisnya.
//   - Alasan/penyebab hanya ditulis kalau memang membantu ("karena X").
//   - Tanpa em dash. Pakai koma, titik dua, atau tanda kurung.
//   - Tiap baris wajib punya `kind` supaya bisa disaring per kategori.
// ============================================================

/** Kategori satu baris perubahan. Menentukan label & warnanya di Pengaturan. */
export type ChangeKind = "new" | "fix" | "security" | "ui" | "data";

export interface Change {
  kind: ChangeKind;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string; // ISO date
  title: string;
  changes: Change[];
}

/** Label + warna tiap kategori. Dipakai chip di daftar changelog. */
export const CHANGE_KIND: Record<ChangeKind, { label: string; className: string }> = {
  new: {
    label: "Baru",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  fix: {
    label: "Perbaikan",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  security: {
    label: "Keamanan",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  ui: {
    label: "Tampilan",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  data: {
    label: "Data",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
};

/** Urutan kategori pada filter chip. */
export const CHANGE_KINDS: ChangeKind[] = ["new", "fix", "security", "ui", "data"];

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.41.2",
    date: "2026-08-30",
    title: "Pencarian dan menu samping kini benar-benar bisa dipakai lewat keyboard",
    changes: [
      { kind: "fix", text: "Tombol Tab di dalam kotak pencarian cepat dan laci menu tidak lagi lolos ke halaman di belakangnya." },
      { kind: "fix", text: "Escape sekarang menutup kotak pencarian dari mana pun, bukan hanya saat kursor ada di kolom ketiknya. Laci menu di layar kecil juga bisa ditutup dengan Escape." },
      { kind: "fix", text: "Halaman di belakang berhenti ikut ter-scroll saat kotak pencarian atau laci menu terbuka." },
      { kind: "fix", text: "Setelah keduanya ditutup, kursor kembali ke tombol yang membukanya." },
      { kind: "fix", text: "Pembaca layar kini menyuarakan hasil pencarian yang sedang disorot saat panah atas-bawah ditekan. Sebelumnya tidak ada yang terbaca sama sekali." },
      { kind: "fix", text: "Enam teks bantu yang selama ini hanya berbahasa Indonesia kini ikut berganti bahasa, dan tombol ganti bahasa tidak lagi punya label yang terkunci di bahasa Inggris." },
    ],
  },
  {
    version: "1.41.1",
    date: "2026-08-30",
    title: "Kunci arsip ditulis lengkap di lapisan database",
    changes: [
      { kind: "security", text: "Aturan tulis untuk Divisi, Anggota, Tim, Reach & Offer, dan Anggaran sekarang menyebut kunci arsip secara eksplisit di database. Perilakunya tidak berubah hari ini, tapi kuncinya tidak akan ikut hilang kalau salah satu menu itu suatu saat dibuka untuk peran lain." },
      { kind: "security", text: "Ada pemeriksaan otomatis baru yang gagal kalau sebuah tabel berlingkup Ormawa Visit punya aturan tulis tanpa kunci arsip, atau kalau tabel baru ditambahkan tanpa memutuskan hal itu." },
    ],
  },
  {
    version: "1.41.0",
    date: "2026-08-30",
    title: "Halaman tidak lagi diam-diam menampilkan data kosong",
    changes: [
      { kind: "fix", text: "Kalau sebuah daftar gagal diambil dari database, halamannya sekarang bilang gagal dan menawarkan muat ulang. Sebelumnya daftarnya tampil kosong, jadi tidak ada bedanya dengan data yang memang belum ada." },
      { kind: "data", text: "Mengisi satu kolom Job di Rundown tidak bisa lagi menimpa kolom divisi lain di baris yang sama ketika pembacaannya gagal." },
      { kind: "fix", text: "Membuat tabel plotting FGD sekarang satu langkah utuh. Kalau gagal di tengah, tidak ada lagi kartu FGD kosong yang tertinggal." },
      { kind: "fix", text: "Menu Himpunan tidak lagi menampilkan halaman kosong ketika sambungan ke database bermasalah." },
      { kind: "fix", text: "Sesi yang kedaluwarsa tidak lagi melempar kamu ke halaman masuk dari proses latar belakang yang berjalan tiap menit." },
      { kind: "fix", text: "Berpindah-pindah tab tidak lagi mengirim satu penanda kehadiran setiap kali berpindah." },
    ],
  },
  {
    version: "1.40.1",
    date: "2026-08-29",
    title: "Angka pecahan di RAB, dan halaman yang lebih ringan dibuka",
    changes: [
      { kind: "fix", text: "Jumlah dan harga di RAB sekarang bisa diisi angka pecahan seperti 2,5. Sebelumnya titik desimalnya hilang begitu diketik." },
      { kind: "fix", text: "Mengosongkan kolom jumlah lalu berpindah tidak lagi diam-diam menyimpan angka nol. Kolomnya kembali ke nilai yang tersimpan." },
      { kind: "fix", text: "Kalau satu baris RAB gagal disimpan, hanya baris itu yang dikembalikan. Sebelumnya seluruh tabel ikut dikembalikan, termasuk baris lain yang sudah berhasil tersimpan." },
      { kind: "fix", text: "Asisten Violet baru dimuat ketika dibutuhkan, jadi setiap halaman lain terbuka lebih ringan." },
      { kind: "fix", text: "Halaman Pengaturan hanya mengirim riwayat versi terbaru; versi lama dimuat saat tombolnya ditekan." },
      { kind: "fix", text: "Daftar hasil pencarian dan daftar pengajuan peran tidak lagi dibangun ulang dari nol setiap kali layar berubah." },
    ],
  },
  {
    version: "1.40.0",
    date: "2026-08-29",
    title: "Menyeret urutan, memilih banyak baris, dan membuka halaman jadi lebih ringan",
    changes: [
      { kind: "fix", text: "Menyeret satu baris untuk mengurutkan ulang RAB, FAQ, atau Hari-H kini satu perintah saja. Sebelumnya satu seretan mengirim satu perintah per baris, jadi daftar panjang bisa tersimpan setengah-setengah kalau ada yang gagal." },
      { kind: "fix", text: "Mencentang banyak tugas lalu mengubah status atau menghapusnya tidak lagi membaca satu per satu ke database." },
      { kind: "fix", text: "Halaman Work Breakdown, Kalender, Papan Divisi, dan Reach & Offer memuat tautannya dengan lebih sedikit permintaan." },
      { kind: "fix", text: "Menyimpan tugas atau prospek dengan banyak tautan jadi jauh lebih cepat." },
      { kind: "fix", text: "Menambah FAQ, divisi, item RAB, atau Ormawa Visit baru bersamaan dengan orang lain tidak lagi bisa menghasilkan nomor urut kembar." },
      { kind: "fix", text: "Berpindah halaman tidak lagi menanyakan sesi ke server dua kali." },
    ],
  },
  {
    version: "1.39.1",
    date: "2026-08-28",
    title: "Pencarian lebih cepat, Violet tidak lagi menggantung lama",
    changes: [
      { kind: "fix", text: "Pencarian global jadi jauh lebih responsif: semua menu dibaca sekaligus, bukan satu per satu, dan pencarian berhenti begitu tiap kelompok sudah penuh." },
      { kind: "security", text: "Pencarian kini memvalidasi kata kunci yang dikirim, seperti seluruh aksi lain di sistem ini." },
      { kind: "fix", text: "Kalau penyedia Violet yang pertama menggantung, giliran penyedia cadangan sekarang dibatasi sisa waktu yang ada. Sebelumnya satu pertanyaan bisa memutar loading sampai satu menit." },
      { kind: "new", text: "Pengaturan menampilkan status penyedia Violet: mana yang utama, mana yang cadangan, dan apakah kuncinya sudah dipasang. Berguna saat Violet tiba-tiba tidak menjawab." },
      { kind: "fix", text: "Violet mengambil semua data yang dibutuhkannya dalam satu gelombang, bukan tiga, jadi jawabannya mulai lebih cepat." },
    ],
  },
  {
    version: "1.39.0",
    date: "2026-08-28",
    title: "Pemulihan backup kini sekali jalan: berhasil semua atau tidak sama sekali",
    changes: [
      { kind: "security", text: "Memulihkan backup sekarang berjalan sebagai satu langkah utuh. Kalau ada yang gagal di tengah, tidak ada satu pun data yang berubah. Sebelumnya kegagalan di tengah bisa meninggalkan sebagian data terhapus dan sebagian terisi, tanpa cara otomatis untuk kembali." },
      { kind: "fix", text: "Backup lama yang dibuat sebelum sebuah kolom ditambahkan kini tetap bisa dipulihkan: kolom yang tidak ada di berkas memakai nilai bawaannya." },
      { kind: "fix", text: "Berkas backup yang isinya janggal atau terlalu besar ditolak lebih awal dengan penjelasan, bukan diteruskan ke database." },
      { kind: "fix", text: "Membuat backup jadi lebih cepat karena semua tabel dibaca bersamaan, bukan satu per satu." },
    ],
  },
  {
    version: "1.38.4",
    date: "2026-08-28",
    title: "Bersih-bersih: kode dan paket yang tidak lagi dipakai dibuang",
    changes: [
      { kind: "fix", text: "Tidak ada yang berubah di layar. Ini pembersihan bagian dalam supaya sistem lebih ringan dan lebih mudah dirawat." },
      { kind: "ui", text: "Tabel hak akses di Pengaturan kini membaca satu sumber yang sama untuk label dan warnanya, jadi keterangan dan isi tabelnya tidak bisa lagi berbeda." },
      { kind: "fix", text: "Tiga paket pihak ketiga yang tidak pernah dipakai dihapus, dan sekarang ada pemeriksaan otomatis supaya paket menganggur tidak menumpuk lagi." },
      { kind: "fix", text: "Dua puluh lima tanda hubung panjang yang rusak encoding-nya di komentar kode diperbaiki." },
    ],
  },
  {
    version: "1.38.3",
    date: "2026-08-28",
    title: "Halaman divisi tidak lagi basi, dan tombol yang tidak bisa dibuka disembunyikan",
    changes: [
      { kind: "fix", text: "Mengubah tugas kini langsung terlihat di halaman detail divisi. Sebelumnya halaman itu masih menampilkan data lama sampai dimuat ulang." },
      { kind: "ui", text: "Pintasan di Dashboard sekarang hanya menampilkan menu yang memang bisa dibuka oleh peranmu. Tamu tidak lagi melihat tombol Anggaran yang kalau diklik hanya kembali ke Dashboard." },
      { kind: "fix", text: "Mengubah status atau menghapus banyak tugas sekaligus di Ormawa Visit yang diarsipkan kini memberi pesan yang jelas, bukan pesan teknis dari database." },
      { kind: "fix", text: "Tugas tidak bisa lagi dipindahkan ke Ormawa Visit yang sudah diarsipkan." },
      { kind: "security", text: "Anggota, prospek, tautan Super Link, baris rundown, dan tugas Hari-H kini selalu tercatat pada Ormawa Visit yang sedang dibuka. Sebelumnya data bisa tersimpan tanpa edisi dan muncul di semua Ormawa Visit sekaligus, melewati kunci arsip." },
      { kind: "security", text: "Menu yang belum terdaftar di matriks hak akses kini tertutup untuk semua peran, bukan terbuka untuk semua peran." },
    ],
  },
  {
    version: "1.38.2",
    date: "2026-08-28",
    title: "Tes komponen akhirnya benar-benar dijalankan",
    changes: [
      { kind: "fix", text: "Berkas tes untuk komponen tampilan dulu tidak pernah dijalankan sama sekali, tanpa peringatan apa pun. Sekarang dijalankan, jadi bug tampilan bisa ketahuan sebelum sampai ke pengguna." },
      { kind: "fix", text: "Dua bug Rundown yang diperbaiki di versi sebelumnya kini dijaga oleh tes yang gagal kalau bugnya kembali." },
    ],
  },
  {
    version: "1.38.1",
    date: "2026-08-28",
    title: "Perbaikan diam-diam: rundown, tanggal, dan Super Link yang tertinggal",
    changes: [
      { kind: "fix", text: "Di Rundown, mengisi dua kolom divisi berurutan pada baris yang sama tidak lagi menghapus isian yang pertama. Sebelumnya isian itu hilang tanpa pesan apa pun dan baru ketahuan setelah halaman dimuat ulang." },
      { kind: "fix", text: "Sel Rundown tidak lagi kehilangan kursor dan teks yang sedang diketik setiap kali indikator 'Tersimpan' muncul." },
      { kind: "fix", text: "Status Overtime dan tulisan 'Hari ini' atau 'Besok' kini mengikuti tanggal Waktu Indonesia Barat, bukan jam server. Sebelumnya keduanya meleset tujuh jam setiap pagi." },
      { kind: "fix", text: "Menghapus prospek di Reach & Offer kini langsung membersihkan tautannya dari Super Link. Sebelumnya tautan itu masih terlihat sampai ada perubahan lain." },
      { kind: "fix", text: "Menandai prospek sebagai partner utama kini langsung memperbarui nama partner di kepala halaman dan di Dashboard." },
    ],
  },
  {
    version: "1.38.0",
    date: "2026-08-19",
    title: "Compare dibuat manual, tampilan sanding, dan salin data yang lebih terarah",
    changes: [
      { kind: "new", text: "Di Compare, perbandingan kini dibuat lewat tombol 'Buat perbandingan' dan bisa dihapus, jadi tidak lagi muncul otomatis untuk tiap himpunan yang diterima. Satu himpunan tidak bisa dibuatkan dua kali." },
      { kind: "new", text: "Tambah tampilan 'Sanding' di Compare: dua himpunan ditaruh berdampingan, aspek demi aspek, untuk membandingkan kelebihan dan kekurangannya langsung." },
      { kind: "data", text: "Data Compare untuk Ormawa Visit HMSI ITS x HMD Eksternal (HMTI UNS dan HMTI UB) diisi dari berkas yang disediakan." },
      { kind: "new", text: "Salin data Ormawa Visit sekarang bisa memilih perlakuan data yang sudah ada: 'Ganti total' (hapus dulu) atau 'Tambahkan' (data lama tetap)." },
      { kind: "new", text: "Sebelum menyalin ke edisi yang sudah ada, wajib mencentang konfirmasi yang menyebut dari dan ke Ormawa Visit mana data disalin." },
      { kind: "new", text: "Salin data kini bisa dipersempit: Anggota & Tim dan Work Breakdown per divisi, Anggaran per rencana RAB. Super Link juga bisa ikut disalin." },
    ],
  },
  {
    version: "1.37.0",
    date: "2026-08-18",
    title: "Menu Himpunan: plotting FGD & perbandingan calon mitra",
    changes: [
      { kind: "new", text: "Menu baru Himpunan, di atas Reach & Offer. Admin, Koordinator, dan Staff bisa mengubah isinya; Intern dan Tamu hanya melihat." },
      { kind: "new", text: "Focus Group Discussion: tabel dua kolom untuk memasangkan tiap departemen HMSI ITS dengan departemen padanannya di himpunan mitra. Tabel baru langsung terisi sepuluh departemen HMSI ITS, barisnya bisa diubah, ditambah, dan dikurangi, dan satu Ormawa Visit boleh punya beberapa tabel." },
      { kind: "new", text: "Compare: membandingkan himpunan yang menerima ajakan lewat Aspek Penilaian, Indikator yang Dinilai, Plus / Kelebihan, dan Minus / Kekurangan. Terbuka setelah ada lebih dari satu himpunan berstatus DITERIMA di Reach & Offer." },
      { kind: "fix", text: "Daftar siapa yang sedang online hanya pernah mencatat satu akun. Sekarang setiap akun yang membuka aplikasi ikut tercatat." },
    ],
  },
  {
    version: "1.36.0",
    date: "2026-08-18",
    title: "Jejak perubahan di seluruh sistem",
    changes: [
      { kind: "security", text: "Setiap penambahan, perubahan, dan penghapusan data kini tercatat lengkap dengan pelaku, waktu, dan kolom apa saja yang berubah. Pencatatannya dilakukan di level database, jadi tidak ada penulisan yang bisa lolos." },
      { kind: "security", text: "Catatan itu tidak bisa disunting maupun dihapus oleh siapa pun lewat aplikasi, termasuk oleh akun yang tercatat di dalamnya." },
      { kind: "data", text: "Menyimpan formulir tanpa mengubah apa pun tidak lagi tercatat sebagai perubahan, jadi riwayatnya hanya berisi hal yang benar-benar terjadi." },
      // Deliberately vague about WHAT gained the tooling: the changelog is
      // rendered in Pengaturan, which every role can open.
      { kind: "new", text: "Halaman error kini melaporkan dirinya sendiri, sehingga masalah yang dialami pengguna bisa ditangani tanpa perlu menunggu laporan manual." },
    ],
  },
  {
    version: "1.35.0",
    date: "2026-08-14",
    title: "Filter centang, catatan bisa dibuka, dan banyak tautan per prospek",
    changes: [
      { kind: "ui", text: "Semua penyaring tabel sekarang memakai kotak centang, jadi beberapa nilai bisa aktif bersamaan: di Reach & Offer kamu bisa melihat tahap diterima dan ditolak sekaligus, di Work Breakdown status Belum dan Overtime sekaligus, dan fokus divisi bisa lebih dari satu divisi." },
      { kind: "ui", text: "Tidak mencentang apa pun berarti semua data tampil, dan ada tombol Bersihkan untuk mengosongkan pilihan tanpa menutup menunya." },
      { kind: "ui", text: "Catatan panjang di tabel Work Breakdown, Reach & Offer, Job Hari-H, dan Super Link tidak lagi berhenti di tanda titik-titik: ada tombol Selengkapnya untuk membacanya penuh di tempat, dan Tutup untuk merapikannya lagi." },
      { kind: "fix", text: "Membaca catatan tidak perlu lagi membuka tombol Edit, jadi peran yang hanya boleh melihat pun tetap bisa membacanya." },
      { kind: "new", text: "Satu prospek di Reach & Offer sekarang boleh punya lebih dari satu tautan (handbook, profil organisasi, proposal balasan), masing-masing dengan nama sendiri dan pilihan tampil di Super Link." },
      { kind: "data", text: "Tautan tunggal yang sudah tersimpan pada prospek dipindahkan otomatis ke daftar tautan yang baru, termasuk entri Super Link yang dimilikinya." },
      { kind: "new", text: "Violet kini juga paham cara kerja sistem ini, bukan hanya isinya: kolom apa saja yang disimpan tiap menu, kenapa sebuah tugas berubah jadi Overtime sendiri, beda tautan hasil dan tautan referensi, aturan arsip, dan istilah yang dipakai di sini." },
      { kind: "new", text: "Violet mengenal semua Ormawa Visit, bukan hanya yang sedang dibuka: edisi lain bisa ditanyakan ringkasannya (jumlah tugas, divisi, prospek, total anggaran, dan daftar namanya)." },
      { kind: "new", text: "Violet juga membaca tautan hasil tugas, tautan prospek, dan hasil Performance Measurement tiap edisi, dan datanya selalu diambil ulang tiap pertanyaan sehingga baris yang baru disimpan langsung bisa ditanyakan." },
    ],
  },
  {
    version: "1.34.0",
    date: "2026-08-13",
    title: "Violet tahu data rinci, dan jawabannya konsisten",
    changes: [
      { kind: "new", text: "Violet sekarang membaca data per baris, jadi bisa menjawab hal spesifik seperti deadline dan PIC satu tugas, jam dan MC satu sesi rundown, harga satu item anggaran, isi satu divisi, atau status satu prospek himpunan." },
      { kind: "fix", text: "Violet tidak lagi kadang tahu kadang tidak saat ditanya hal yang sama: urutan data yang dibaca dibuat tetap, jawaban ditarik dari baris datanya sendiri, dan modelnya disetel supaya tidak mengarang variasi jawaban." },
      { kind: "fix", text: "Pertanyaan daftar (misalnya divisi apa saja yang ada) kini dijawab lengkap, tidak lagi hanya sebagian yang kebetulan cocok dengan kata-kata pertanyaan." },
      { kind: "fix", text: "Kalau sebuah kolom memang belum diisi, Violet mengatakannya apa adanya alih-alih menebak." },
      { kind: "ui", text: "Membuka kembali panel Violet langsung menggulir ke pesan terbaru, bukan ke awal percakapan." },
      { kind: "fix", text: "Pemakaian kuota AI per pertanyaan dihemat sekitar setengahnya, jadi Violet bisa menjawab lebih banyak pertanyaan sebelum kena batas layanan gratisnya." },
    ],
  },
  {
    version: "1.33.0",
    date: "2026-08-13",
    title: "Violet: tulisan rapi, tautan yang benar, dan tetap jalan saat kuota habis",
    changes: [
      { kind: "fix", text: "Jawaban Violet kini tampil rapi: tebal, poin bernomor, dan daftar bertitik benar-benar dirender, tidak lagi muncul sebagai tanda bintang di tengah kalimat." },
      { kind: "fix", text: "Tautan yang diberikan Violet diperiksa dulu ke daftar halaman yang benar-benar ada, jadi tidak ada lagi pintasan ke halaman kosong seperti /violet." },
      { kind: "new", text: "Pintasan ke bagian tertentu langsung menggulir ke sana, misalnya changelog di Pengaturan, lengkap dengan sorotan sesaat pada bagian yang dituju." },
      { kind: "new", text: "Violet otomatis pindah ke layanan AI cadangan saat kuota layanan utamanya habis, jadi chat tetap bisa dipakai." },
      { kind: "fix", text: "Pesan kegagalan Violet ditulis untuk pengguna: kuota habis, layanan sedang ramai, atau koneksi bermasalah, masing-masing dengan saran tindakan dan tombol 'Coba lagi' bila mengulang memang membantu." },
      { kind: "ui", text: "Panel Violet dipercantik: kepala panel bergradasi, gelembung pesan baru, daftar sumber yang lebih jelas, tombol salin jawaban, dan Esc untuk menutup." },
    ],
  },
  {
    version: "1.32.0",
    date: "2026-08-12",
    title: "Violet, asisten chat sistem ini, dan referensi pada tugas",
    changes: [
      { kind: "new", text: "Violet: asisten chat di pojok kanan bawah yang menjawab seputar sistem ini saja, termasuk data Ormawa Visit yang sedang dibuka. Tiap jawaban menyertakan sumbernya." },
      { kind: "new", text: "Violet menolak pertanyaan di luar sistem ini dan mengaku tidak tahu kalau jawabannya tidak ada, jadi tidak mengarang nama menu atau angka." },
      { kind: "security", text: "Violet membaca data lewat sesi penanya sendiri, jadi aturan akses tetap berlaku. Tamu tidak bisa memancing daftar anggota lewat chat." },
      { kind: "new", text: "Work Breakdown: field Referensi pada tiap tugas. Boleh lebih dari satu, diketik manual atau diambil dari Super Link, dan ada tombol pintas untuk langsung membukanya." },
      { kind: "new", text: "Satu tautan Super Link boleh dirujuk banyak tugas sekaligus, tidak terbatas satu tugas." },
      { kind: "data", text: "Jalankan migrasi 0037 untuk membuat tabel referensi tugas." },
      { kind: "data", text: "Violet baru muncul kalau GEMINI_API_KEY diisi di .env.local. Kuncinya hanya dibaca di server dan tidak pernah ikut ke browser." },
    ],
  },
  {
    version: "1.31.0",
    date: "2026-08-11",
    title: "Tautan & catatan di Reach & Offer, anggota lama bisa ditambah ke divisi",
    changes: [
      { kind: "new", text: "Reach & Offer: kolom Tautan & Catatan. Tautan bisa diisi handbook atau profil himpunan." },
      { kind: "new", text: "Tautan prospek bisa ikut ditampilkan di Super Link, sama seperti tautan hasil di Work Breakdown." },
      { kind: "new", text: "Divisi: tombol 'Tambah anggota' kini memasukkan anggota yang SUDAH terdaftar ke divisi itu, bukan membuat orang baru. Divisi lain yang mereka ikuti tetap aman." },
      { kind: "ui", text: "Seluruh teks sistem tidak lagi memakai em dash." },
      { kind: "ui", text: "Changelog dikategorikan (Baru, Perbaikan, Keamanan, Tampilan, Data) dan bisa disaring." },
      { kind: "data", text: "Jalankan migrasi 0036 untuk menambah kolom tautan & catatan pada Reach & Offer." },
    ],
  },
  {
    version: "1.30.0",
    date: "2026-08-11",
    title: "Pilihan tidak hilang saat mencari, fokus PIC, penomoran WBS",
    changes: [
      { kind: "fix", text: "Centang di tabel tidak lagi hilang saat mengetik di kotak pencarian. Berlaku di Work Breakdown, Reach & Offer, Super Link, Anggaran, Divisi, dan Anggota EA." },
      { kind: "fix", text: "'Pilih semua' hanya menyentuh baris yang sedang tampil, tidak membuang pilihan di luar layar." },
      { kind: "fix", text: "Penomoran tabel Work Breakdown kini urutan baris (1 sampai terakhir), bukan nomor per divisi yang membuatnya terbaca 1,2,3,1,2,1." },
      { kind: "new", text: "Work Breakdown: filter 'Fokus PIC' dengan checkbox, bisa pilih beberapa orang sekaligus." },
      { kind: "new", text: "Work Breakdown: pilihan 'Tanpa divisi' untuk tugas yang tidak masuk divisi mana pun." },
      { kind: "new", text: "Rundown: filter untuk memilih kolom divisi yang ditampilkan. Divisi yang dikecualikan dari rundown tidak muncul sebagai pilihan." },
      { kind: "ui", text: "Semua pop-up sempat muncul melenceng ke kiri sebelum melompat ke tengah. Kini benar-benar di tengah." },
      { kind: "ui", text: "Kolom isian berpasangan pada pop-up menumpuk ke bawah di layar ponsel." },
      { kind: "ui", text: "Area sentuh kotak centang diperbesar jadi 32px." },
    ],
  },
  {
    version: "1.29.0",
    date: "2026-08-10",
    title: "Ubah kata sandi sendiri",
    changes: [
      { kind: "new", text: "Ubah kata sandi lewat menu akun di pojok kanan atas." },
      { kind: "security", text: "Kata sandi lama wajib diisi. Tanpa ini, siapa pun yang menemukan browser tak terjaga bisa mengunci anggota lain di luar, karena akun default memang dipakai bersama." },
      { kind: "new", text: "Akun Google diberi tahu bahwa kata sandinya diatur di akun Google, bukan gagal dengan pesan menyesatkan." },
    ],
  },
  {
    version: "1.28.1",
    date: "2026-08-10",
    title: "Akun default tidak bisa login (error \"{}\")",
    changes: [
      { kind: "fix", text: "Akun default gagal login dengan pesan \"{}\" karena skrip pembuatnya tidak mengisi kolom token milik sistem autentikasi Supabase." },
      { kind: "data", text: "Jalankan ulang supabase/default-accounts.sql. Skripnya sekaligus memperbaiki akun yang terlanjur dibuat versi lama." },
      { kind: "fix", text: "Halaman Masuk & Daftar tidak lagi menampilkan \"{}\": pesan error yang tidak terbaca diganti kalimat yang bisa ditindaklanjuti." },
    ],
  },
  {
    version: "1.28.0",
    date: "2026-08-10",
    title: "Ubah massal WBS, urutkan item RAB & FAQ, salin template antar OV",
    changes: [
      { kind: "new", text: "Work Breakdown: 'Ubah massal' untuk mengubah Divisi, PIC, dan Deadline sekaligus. Kolom yang tidak dicentang dibiarkan apa adanya." },
      { kind: "new", text: "Anggaran: item bisa diurutkan dengan geser, di dalam kategorinya masing-masing." },
      { kind: "new", text: "FAQ: pertanyaan bisa diurutkan dengan geser." },
      { kind: "new", text: "Ormawa Visit: tiap menu bisa disalin dari OV yang BERBEDA, misalnya Divisi dari OV A dan Rundown dari OV B." },
      { kind: "new", text: "Ormawa Visit: 'Reach & Offer' ikut bisa disalin. Status kontak dan PIC dikosongkan karena itu milik edisi yang menghubungi." },
      { kind: "new", text: "Ormawa Visit: salin template juga tersedia saat mengedit OV yang sudah ada, dengan peringatan bahwa data menu terpilih akan dihapus dan diganti." },
      { kind: "new", text: "Pengaturan: pulihkan data dari file JSON backup lewat 'Impor dari File'." },
      { kind: "security", text: "File backup yang diimpor disaring daftar-putih tabel, jadi file hasil edit manual tidak bisa dipakai mengembalikan peran admin yang sudah dicabut." },
      { kind: "ui", text: "Divisi: field 'Kode unik (opsional)' dihapus karena kodenya dibuat otomatis dan tidak pernah ditampilkan." },
    ],
  },
  {
    version: "1.27.0",
    date: "2026-08-05",
    title: "Rencana anggaran ikut OV yang dibuka, info kode sumber terbuka",
    changes: [
      { kind: "fix", text: "Anggaran: dropdown Ormawa Visit pada pop-up tambah rencana dihapus. Rencana otomatis masuk ke OV yang sedang dibuka, jadi tidak bisa lagi salah pilih edisi dan rencananya tidak terlihat." },
      { kind: "new", text: "Pengaturan: bagian 'Kode Sumber Terbuka' dengan tautan ke repositori GitHub." },
    ],
  },
  {
    version: "1.26.0",
    date: "2026-08-03",
    title: "Sidebar dikelompokkan ulang, akun default, 'Batch' dihapus",
    changes: [
      { kind: "ui", text: "Menu samping dibagi ulang: Organisasi (Anggota, Kegiatan), Bantuan (FAQ, Panduan), dan Sistem (Peran, Pengaturan)." },
      { kind: "new", text: "Akun default siap pakai untuk Koordinator, Staff, dan Intern lewat supabase/default-accounts.sql." },
      { kind: "ui", text: "Reach & Offer: kolom & filter 'Batch' dihapus karena data sudah terkategori per Ormawa Visit." },
      { kind: "fix", text: "Super Link: dropdown Divisi saat membuat tautan kini hanya menampilkan divisi milik OV yang dipilih." },
      { kind: "fix", text: "Rundown tidak lagi tampil ganda. Dulu ada versi A dan B untuk edisi yang sama." },
      { kind: "data", text: "Jalankan migrasi 0035 untuk membereskan rundown ganda pada data yang sudah ada." },
    ],
  },
  {
    version: "1.25.0",
    date: "2026-07-30",
    title: "Privasi roster, kunci arsip tautan tugas, gabung sel di Mode Demo",
    changes: [
      { kind: "security", text: "Nama dan NRP anggota hanya bisa dilihat akun yang sudah punya peran. Tamu tidak lagi bisa menarik daftar anggota." },
      { kind: "security", text: "Tautan hasil tugas di OV yang diarsipkan ternyata masih bisa diubah Koordinator/Staff/Intern karena aturan lama tertinggal. Kini benar-benar terkunci." },
      { kind: "fix", text: "Fitur gabung sel rundown gagal di Mode Demo karena database demo belum punya kolomnya. Jalankan ulang skrip demo untuk memperbaikinya." },
      { kind: "ui", text: "Indikator 'Tersimpan' muncul saat mengedit sel Rundown, mengurutkan Hari-H, dan mengubah Qty/Harga di Anggaran." },
      { kind: "fix", text: "Penyorotan 'tugasku' di Work Breakdown mencocokkan nama secara utuh: 'Ali' tidak lagi cocok dengan tugas 'Alifia'." },
      { kind: "security", text: "Halaman Daftar membatasi jumlah percobaan dalam waktu singkat." },
      { kind: "ui", text: "Kotak centang dan label status di tabel diperbesar area sentuhnya." },
    ],
  },
  {
    version: "1.24.0",
    date: "2026-07-29",
    title: "Reach & Offer dan Anggota EA terpisah per Ormawa Visit",
    changes: [
      { kind: "fix", text: "Seluruh 61 data Reach & Offer tersimpan tanpa penanda OV sehingga setiap edisi menampilkan semuanya. Kini tiap prospek terikat edisinya: OV1 2025 punya 19, OV2 2025 punya 16, OV1 2026 punya 12, OV2 2026 punya 14." },
      { kind: "fix", text: "44 anggota EA juga tanpa penanda OV dan muncul di semua edisi. Daftar anggota kini memakai roster asli per edisi." },
      { kind: "data", text: "Skrip data awal menolak berjalan kalau ada prospek tanpa Ormawa Visit, dan tidak lagi menulis anggota tanpa edisi." },
    ],
  },
  {
    version: "1.23.0",
    date: "2026-07-29",
    title: "Rebuild data bersih, 60 terjemahan Inggris, Tamu bisa buka Pengaturan",
    changes: [
      { kind: "data", text: "Akar masalah duplikat ditemukan: seed.sql berisi 529 perintah tambah-data tanpa pengaman anti-kembar, jadi menjalankannya dua kali menggandakan hampir semua tabel." },
      { kind: "data", text: "Tersedia reset-data.sql untuk mengosongkan seluruh data lalu mengisinya ulang sekali saja. Akun, peran, dan riwayat backup tidak terhapus." },
      { kind: "fix", text: "Gabung sel Rundown gagal karena kolomnya belum ada di skrip skema utama. Sekarang sudah termasuk." },
      { kind: "ui", text: "60 teks yang masih berbahasa Indonesia saat bahasa diatur ke English kini diterjemahkan." },
      { kind: "ui", text: "Changelog menampilkan 5 versi terbaru saja, dengan tombol untuk membuka sisanya." },
      { kind: "new", text: "Peran Tamu bisa membuka Pengaturan (matriks hak akses, arsip spreadsheet, changelog). Backup dan reset demo tetap tersembunyi." },
    ],
  },
  {
    version: "1.22.0",
    date: "2026-07-29",
    title: "Performance Measurement, gabung sel rundown, arsip spreadsheet",
    changes: [
      { kind: "new", text: "Performance Measurement di Dashboard: kehadiran fungsionaris, jumlah & rata-rata rating feedback dari kedua pihak, serta tautan LPJ. Diisi lewat Ormawa Visit, Edit." },
      { kind: "new", text: "Rundown: kolom MC, Kebutuhan Operator, dan kolom divisi bisa digabung ke baris di bawahnya. Kolom Catatan sengaja tidak bisa digabung." },
      { kind: "new", text: "Pengaturan: arsip tautan Main Sheet 2024, 2025, dan 2026." },
      { kind: "data", text: "Super Link diperbarui dari Main Sheet terbaru: 87 tautan disegarkan atau ditambahkan. Tautan buatan sendiri tidak tertimpa." },
      { kind: "fix", text: "Baris duplikat akibat skrip SQL dijalankan lebih dari sekali bisa dibersihkan. Hanya salinan yang benar-benar identik yang dibuang." },
      { kind: "ui", text: "Kotak tanggal pada timeline tidak lagi tertutup bilah atas saat ada spanduk Mode Demo atau Arsip." },
      { kind: "ui", text: "Kolom yang belum diisi tampil sebagai '-' agar tidak tertukar dengan nilai nol." },
    ],
  },
  {
    version: "1.21.0",
    date: "2026-07-28",
    title: "Pencarian di tengah layar, riwayat pencarian, penanda arsip",
    changes: [
      { kind: "ui", text: "Pop-up pencarian muncul di tengah layar dengan latar diburamkan, dan bisa ditutup lewat tombol X." },
      { kind: "new", text: "Pencarian menyimpan riwayat sementara di browser. Hilang saat halaman dimuat ulang dan tidak pernah dikirim ke server." },
      { kind: "ui", text: "Ormawa Visit yang diarsipkan ditandai spanduk abu-abu, dibedakan dari spanduk kuning Mode Demo." },
      { kind: "fix", text: "Timeline: garis bantu vertikal melintas di belakang kolom nama tugas, bukan menimpanya." },
      { kind: "fix", text: "Timeline: kotak tanggal tetap terlihat di bagian atas layar walau digulir jauh ke bawah." },
      { kind: "fix", text: "Pemilih peran di Mode Demo lokal sempat tidak berfungsi." },
    ],
  },
  {
    version: "1.20.0",
    date: "2026-07-28",
    title: "Perbaikan besar izin menyimpan, arsip Ormawa Visit, backup",
    changes: [
      { kind: "security", text: "Koordinator, Staff, dan Intern bisa gagal menyimpan tanpa pesan apa pun karena aturan database masih mengira tiap akun terikat satu divisi dan satu OV. Aturan itu dihapus." },
      { kind: "security", text: "Izin menyimpan kini hanya ditentukan PERAN, persis seperti matriks di Pengaturan." },
      { kind: "fix", text: "Setiap kegagalan menyimpan selalu memunculkan pesan merah. Sebelumnya 37 jenis penyimpanan diam saja saat gagal." },
      { kind: "new", text: "Arsip Ormawa Visit: admin bisa mengunci OV yang sudah selesai. Setelah dikunci, peran lain tidak bisa mengubah apa pun di dalamnya." },
      { kind: "fix", text: "Backup otomatis terjadwal tidak pernah berhasil sejak pengetatan keamanan, isinya selalu kosong. Backup kosong kini ditolak." },
      { kind: "fix", text: "Pemulihan sempat menghapus permanen semua tautan hasil tugas. Sekarang ikut tercadangkan dan dipulihkan." },
      { kind: "security", text: "Penambahan header proteksi standar, cookie tidak lagi bisa dibaca skrip halaman, dan kunci rahasia backup tidak boleh lewat URL." },
      { kind: "new", text: "Pencarian global: tekan Ctrl+K atau ketik '/' untuk mencari tugas, anggota, divisi, prospek, tautan, anggaran, rundown, Hari-H, dan FAQ sekaligus." },
      { kind: "security", text: "Backup otomatis dihapus sepenuhnya. Backup kini murni manual, tanpa kunci rahasia yang perlu dikonfigurasi." },
      { kind: "fix", text: "Mengubah Fokus Divisi lalu kembali ke 'Semua Divisi' membuat daftar tugas hilang sampai halaman dimuat ulang." },
      { kind: "ui", text: "Timeline diperbaiki menyeluruh: garis tugas sejajar dengan tanggalnya, sumbu menampilkan tanggal harian, ada penanda 'Hari ini' dan info tugas saat kursor diarahkan." },
    ],
  },
  {
    version: "1.19.0",
    date: "2026-07-27",
    title: "Divisi & Anggota menyatu, warna kategori anggaran",
    changes: [
      { kind: "new", text: "Anggota yang diberi divisi di tab Anggota EA otomatis muncul pada Struktur Tim kartu divisi itu. Tidak ada lagi daftar yang diketik dua kali." },
      { kind: "new", text: "Satu orang boleh berada di lebih dari satu divisi. Pilihan divisi kini berupa daftar centang." },
      { kind: "new", text: "Koordinator hanya bisa dipilih dari fungsionaris divisi bersangkutan, dan sebuah divisi boleh tidak punya koordinator." },
      { kind: "new", text: "Anggaran: warna bulatan kategori bisa diubah, lewat pop-up maupun langsung dari bulatannya." },
      { kind: "fix", text: "Anggaran: kolom Qty & Harga tersimpan saat menekan Enter, dan tombol panah ikut tersimpan sendiri." },
      { kind: "ui", text: "Role Request menjelaskan sendiri kenapa pengajuan peran tidak berjalan di Mode Demo." },
    ],
  },
  {
    version: "1.18.1",
    date: "2026-07-26",
    title: "Perbaikan internal: keamanan migrasi, kecepatan muat",
    changes: [
      { kind: "ui", text: "Halaman lebih ringan: kamus terjemahan Inggris (33KB) tidak lagi diunduh pengguna berbahasa Indonesia." },
      { kind: "security", text: "Perbaikan urutan migrasi database: pengetatan izin tugas sempat bisa terbatalkan." },
      { kind: "ui", text: "Menyimpan satu data tidak lagi menyegarkan seluruh halaman, hanya yang memakainya." },
      { kind: "fix", text: "Formulir tidak lagi berkedip saat dibuka." },
    ],
  },
  {
    version: "1.18.0",
    date: "2026-07-26",
    title: "Kebijakan Privasi & Ketentuan Layanan",
    changes: [
      { kind: "new", text: "Halaman Kebijakan Privasi: data apa yang dikumpulkan, cookie yang dipakai, siapa yang bisa melihat apa, dan hakmu atas datamu." },
      { kind: "new", text: "Halaman Ketentuan Layanan: aturan pemakaian akun, larangan penyalahgunaan data himpunan mitra, dan ketentuan Mode Demo." },
      { kind: "new", text: "Keduanya bisa dibuka tanpa akun, tersedia dalam Bahasa Indonesia dan English." },
    ],
  },
  {
    version: "1.16.0",
    date: "2026-07-26",
    title: "Perbaikan hak akses tugas, pengajuan peran bisa diubah",
    changes: [
      { kind: "security", text: "Staff & Intern kini bisa mengubah dan mengisi hasil SEMUA tugas. Sebelumnya hak akses ikut terkunci ke divisi di profil akun." },
      { kind: "new", text: "Anggaran dan Pengaturan bisa dibuka Koordinator, Staff, dan Intern dalam mode hanya-lihat." },
      { kind: "new", text: "Pengajuan peran yang belum diputuskan bisa diperbaiki dan dikirim ulang." },
      { kind: "new", text: "Akun yang sudah punya peran bisa mengajukan perubahan peran, naik maupun turun." },
      { kind: "fix", text: "Rundown: kolom Durasi terisi otomatis untuk semua baris yang punya waktu mulai & selesai." },
      { kind: "fix", text: "Rundown: kolom beku tidak lagi tampak berlubang saat tabel digeser." },
    ],
  },
  {
    version: "1.15.0",
    date: "2026-07-26",
    title: "Akses Terbatas, daftar akun sendiri, permintaan peran",
    changes: [
      { kind: "new", text: "Tingkat akses 'Akses terbatas': bisa membuat, mengubah, dan mengisi hasil, tapi tidak bisa menghapus." },
      { kind: "new", text: "Staff & Intern punya Akses terbatas di Work Breakdown, Rundown, Hari-H, dan Super Link." },
      { kind: "ui", text: "Matriks Hak Akses punya empat status: penuh, terbatas, hanya lihat, tidak ada akses." },
      { kind: "new", text: "Menu samping bisa diciutkan jadi ikon saja, dan otomatis terbuka saat kursor diarahkan. Pilihanmu diingat." },
      { kind: "new", text: "Halaman Daftar: bikin akun sendiri pakai email & kata sandi, atau lewat Google." },
      { kind: "new", text: "Menu 'Role Request' khusus Admin untuk menyetujui atau mengabaikan pengajuan peran." },
    ],
  },
  {
    version: "1.14.0",
    date: "2026-07-20",
    title: "Perbaikan Mode Demo, status otomatis Overtime",
    changes: [
      { kind: "fix", text: "Mode Demo: ubah status & simpan hasil tugas kini berfungsi." },
      { kind: "new", text: "Status tugas otomatis jadi 'Overtime' bila melewati tenggat dan belum selesai." },
      { kind: "fix", text: "Rundown: kolom beku tidak lagi tampak tembus pandang saat tabel digeser." },
      { kind: "fix", text: "Reset data Mode Demo benar-benar mengembalikan semua data, termasuk OV yang kamu buat." },
      { kind: "fix", text: "Aksi massal status tugas menampilkan pesan bila gagal." },
    ],
  },
  {
    version: "1.13.0",
    date: "2026-07-20",
    title: "Perbaikan Work Breakdown & data utama Reach & Offer",
    changes: [
      { kind: "fix", text: "Ubah status tugas dan simpan hasil berfungsi kembali. Kesalahan tersembunyi dari database kini ditampilkan." },
      { kind: "new", text: "PIC tugas: dropdown hanya menampilkan anggota divisi tersebut, dikelompokkan Koordinator / Fungsionaris / Intern." },
      { kind: "new", text: "Reach & Offer: tandai satu prospek sebagai 'data utama' Ormawa Visit. Data OV otomatis mengikuti, dan hanya boleh satu per OV." },
      { kind: "ui", text: "Rundown dijadikan satu versi (versi B dihapus) dan kolom No/Waktu/Durasi/Kegiatan dibekukan." },
      { kind: "ui", text: "Mode Demo: nama pengguna sesuai peran." },
    ],
  },
  {
    version: "1.12.0",
    date: "2026-07-20",
    title: "Hasil tugas terstruktur, sinkron Super Link, panduan lengkap",
    changes: [
      { kind: "new", text: "Hasil tugas dipisah: kolom deskripsi dan daftar tautan tersendiri, bisa lebih dari satu tautan." },
      { kind: "new", text: "Tautan hasil bisa ditampilkan di Super Link lengkap dengan namanya, cukup centang saat mengisi hasil." },
      { kind: "fix", text: "Tautan tidak terduplikat walau tugas disimpan berkali-kali. Mengubah atau menghapusnya di tugas ikut memperbarui Super Link." },
      { kind: "new", text: "Panduan: bagian 'Panduan Lengkap per Fitur' berisi tujuan, langkah pemakaian, dan hak akses tiap menu." },
    ],
  },
  {
    version: "1.11.0",
    date: "2026-07-20",
    title: "Sortir bertingkat, duplikat, penyegaran tampilan",
    changes: [
      { kind: "new", text: "Pengurutan tabel bertingkat: klik kolom kedua tidak menghapus urutan kolom pertama." },
      { kind: "new", text: "Tombol 'Duplikat' pada Tugas, item Anggaran, baris Rundown, Job Hari-H, dan Ormawa Visit." },
      { kind: "ui", text: "Work Breakdown: kolom Hasil tidak bisa diketik langsung di tabel agar tidak tertimpa tak sengaja." },
      { kind: "new", text: "Work Breakdown: tombol 'Simpan & Selesai' untuk menyimpan sekaligus menandai tugas selesai." },
      { kind: "ui", text: "Dashboard: Akses Cepat dipindah ke atas dengan tampilan geser, dan diagram donat diperbarui." },
      { kind: "new", text: "Kalender: ikon plus muncul saat tanggal disorot untuk menambah tugas di tanggal itu." },
    ],
  },
  {
    version: "1.10.1",
    date: "2026-07-20",
    title: "Perbaikan gagal kembali ke login & kebocoran akses",
    changes: [
      { kind: "fix", text: "Membuka situs tanpa sesi login kini diarahkan ke halaman Masuk, tidak lagi menampilkan error di dashboard." },
      { kind: "security", text: "Anggaran, Super Link, dan Pengaturan benar-benar tertutup untuk peran yang tidak berhak, termasuk saat berganti peran." },
      { kind: "fix", text: "Sistem tidak lagi gagal total saat daftar Ormawa Visit kosong." },
    ],
  },
  {
    version: "1.10.0",
    date: "2026-07-20",
    title: "Divisi & Anggota digabung, multi-select, drag-and-drop Hari-H",
    changes: [
      { kind: "ui", text: "Menu 'Divisi' dan 'Anggota & Tim' digabung jadi satu menu dengan tab Divisi, Anggota, dan Struktur Tim." },
      { kind: "new", text: "Daftar Divisi bisa multi-select untuk hapus massal atau ubah status rundown sekaligus." },
      { kind: "new", text: "Job Hari-H bisa diurutkan dengan drag-and-drop." },
      { kind: "new", text: "Reach & Offer, Super Link, dan item Anggaran bisa multi-select untuk hapus massal." },
      { kind: "new", text: "Mode Demo: opsi Backup diganti 'Reset ke data awal'." },
    ],
  },
  {
    version: "1.9.0",
    date: "2026-07-20",
    title: "Koordinator sebagai peran & data roster asli",
    changes: [
      { kind: "ui", text: "Koordinator jadi peran di dalam divisi, bukan divisi tersendiri." },
      { kind: "data", text: "Data divisi, anggota, dan struktur tim diisi dengan data asli External Affairs untuk tiap Ormawa Visit." },
      { kind: "new", text: "Angkatan anggota otomatis dari NRP." },
    ],
  },
  {
    version: "1.8.0",
    date: "2026-07-20",
    title: "Divisi & anggota kini per Ormawa Visit",
    changes: [
      { kind: "new", text: "Tiap Ormawa Visit bisa punya nama, singkatan, warna, dan susunan divisi sendiri tanpa memengaruhi OV lain." },
      { kind: "new", text: "Anggota & tim juga per Ormawa Visit. Roster lama otomatis ditautkan ke OV paling awal." },
      { kind: "new", text: "Template pembuatan OV baru bisa ikut menyalin Divisi dan Anggota & Tim." },
    ],
  },
  {
    version: "1.7.0",
    date: "2026-07-20",
    title: "Penguatan keamanan, validasi, ketepatan data",
    changes: [
      { kind: "security", text: "Data termasuk NRP anggota tidak lagi bisa dibaca tanpa sesi login. Mode Tamu memakai sesi anonim." },
      { kind: "security", text: "Hak akses database diselaraskan dengan aturan aplikasi. Koordinator benar-benar bisa mengelola rundown, Hari-H, & tim." },
      { kind: "security", text: "Semua input Reach & Offer, Super Link, Rundown, Hari-H, dan Tim divalidasi penuh." },
      { kind: "fix", text: "Anggaran: total dibulatkan ke rupiah utuh dan kolom tidak menerima nilai negatif." },
      { kind: "fix", text: "Penomoran tugas & job Hari-H otomatis dan aman dari tabrakan saat dua orang menambah bersamaan." },
    ],
  },
  {
    version: "1.6.1",
    date: "2026-07-20",
    title: "Identitas baru, penyempurnaan rundown & divisi",
    changes: [
      { kind: "ui", text: "Nama sistem jadi 'Ormawa Visit Management System' dengan logo & favicon baru." },
      { kind: "ui", text: "Rundown: field kegiatan menyesuaikan tinggi, kolom MC & Kebutuhan Operator dipindah ke samping Kegiatan." },
      { kind: "new", text: "Rundown: durasi otomatis dihitung dari waktu, dan kegiatan baru mulai dari waktu selesai kegiatan sebelumnya." },
      { kind: "fix", text: "Divisi: singkatan Coordinator diperbaiki jadi 'CORD'." },
    ],
  },
  {
    version: "1.6.0",
    date: "2026-07-20",
    title: "Rundown tabel dinamis, Panduan, FAQ CRUD",
    changes: [
      { kind: "new", text: "Rundown jadi tabel: tiap divisi otomatis jadi kolom, kegiatannya diisi langsung di tabel." },
      { kind: "new", text: "Rundown: edit & hapus langsung di tabel, plus catatan cepat 'terlalu cepat/lama [menit]'." },
      { kind: "new", text: "Divisi: opsi edit & hapus, singkatan otomatis kapital maksimal 4 huruf, dan opsi 'tidak diikutsertakan pada rundown'." },
      { kind: "new", text: "FAQ bisa CRUD penuh, dan Panduan dipisah ke menu tersendiri dengan flowchart alur penggunaan." },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-07-19",
    title: "Mode Demo, template pembuatan, integrasi anggota",
    changes: [
      { kind: "new", text: "Mode Demo: sandbox dengan database Supabase terpisah, bisa coba-coba tanpa akun. Data demo dan data asli benar-benar terisolasi." },
      { kind: "new", text: "Template pembuatan Ormawa Visit: data bisa disalin dari OV sebelumnya, tidak lagi diisi satu per satu." },
      { kind: "new", text: "PIC tugas & job Hari-H dipilih langsung dari daftar anggota." },
      { kind: "new", text: "Anggota & Tim: pilih banyak anggota sekaligus untuk hapus atau ubah divisi/tipe massal." },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-07-18",
    title: "Penomoran otomatis, RAB & Anggota penuh CRUD, backup",
    changes: [
      { kind: "new", text: "Penomoran tugas & Hari-H otomatis. ID lama dari spreadsheet dihapus." },
      { kind: "ui", text: "Super Link dikelompokkan per Ormawa Visit & divisi, dan wajib punya URL." },
      { kind: "new", text: "Anggaran (RAB) bisa CRUD penuh: tambah/hapus rencana & item." },
      { kind: "new", text: "Struktur Tim: pengisian anggota lewat dropdown multi-select, bukan teks bebas." },
      { kind: "new", text: "Backup manual, backup otomatis terjadwal, dan pemulihan data." },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-07-18",
    title: "Optimasi performa navigasi",
    changes: [
      { kind: "ui", text: "Skeleton loading supaya perpindahan menu terasa instan." },
      { kind: "ui", text: "Query berulang ke Supabase dikurangi lewat cache per-request." },
      { kind: "fix", text: "Proxy tidak lagi memvalidasi sesi saat prefetch, mencegah rate limit." },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-18",
    title: "Multi-select tugas & pengalih bahasa",
    changes: [
      { kind: "new", text: "Work Breakdown: pilih banyak tugas sekaligus untuk ubah status atau hapus massal." },
      { kind: "new", text: "Tombol ganti bahasa Indonesia/English di sebelah tombol tema." },
      { kind: "new", text: "Reach & Offer dan Super Link bisa difilter per Ormawa Visit." },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-07-17",
    title: "Terhubung ke Supabase & deploy",
    changes: [
      { kind: "new", text: "Sistem login sungguhan (email & password) via Supabase Auth." },
      { kind: "new", text: "Mode Tamu, lihat saja tanpa akun." },
      { kind: "data", text: "Data dipindahkan dari mode demo lokal ke database Supabase cloud." },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-16",
    title: "Peluncuran awal",
    changes: [
      { kind: "new", text: "Sistem dibangun dari digitalisasi Main Sheet Ormawa Visit (Google Sheets)." },
      { kind: "new", text: "Dashboard, Work Breakdown Structure, Papan Divisi, Reach & Offer, Anggaran, Super Link." },
      { kind: "new", text: "Kalender, Rundown Acara, Job Hari-H, Anggota & Tim, Edisi Ormawa Visit, FAQ." },
      { kind: "new", text: "Hak akses berjenjang: Admin/PIC, Koordinator, Staff, Intern, Tamu." },
    ],
  },
];
