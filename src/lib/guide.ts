import type { Lang } from "./i18n/config";

// ============================================================
// Per-feature usage guide, in Indonesian AND English side by side.
//
// Kept as data (not JSX/dict strings) so both languages live together and a
// feature change only means editing one entry here.
//
// MAINTENANCE: when you add or change a feature, update its section below -
// see AGENTS.md → "Panduan".
// ============================================================

/** A string in both supported languages. */
export interface Bi { id: string; en: string }

export interface GuideSection {
  /** Matches the nav/module key so access rules line up. */
  key: string;
  title: Bi;
  /** One-line answer to "what is this for?" */
  purpose: Bi;
  /** Ordered how-to. */
  steps: Bi[];
  /** Gotchas / things people get wrong. */
  tips?: Bi[];
  /** Who can use it, in plain language. */
  access?: Bi;
}

export const pick = (b: Bi, lang: Lang) => (lang === "en" ? b.en : b.id);

export const GUIDE: GuideSection[] = [
  {
    key: "dashboard",
    title: { id: "Dashboard", en: "Dashboard" },
    purpose: {
      id: "Ringkasan cepat satu Ormawa Visit: progres tugas, pipeline himpunan, anggaran, dan deadline terdekat.",
      en: "A quick overview of one Ormawa Visit: task progress, outreach pipeline, budget, and upcoming deadlines.",
    },
    steps: [
      { id: "Pastikan Ormawa Visit yang benar sedang aktif (pemilih di kanan atas, atau lewat menu Ormawa Visit).", en: "Make sure the right Ormawa Visit is active (the picker at the top right, or via the Ormawa Visit menu)." },
      { id: "Gunakan Akses Cepat di bagian atas untuk melompat ke menu yang sering dipakai; geser ke samping bila menu tidak muat.", en: "Use Quick Access at the top to jump to frequently used menus; scroll sideways if they don't all fit." },
      { id: "Arahkan kursor ke tiap bagian diagram donat untuk melihat jumlah dan persentase tugas per status.", en: "Hover each donut segment to see the task count and percentage per status." },
      { id: "Cek kartu 'Deadline Terdekat' untuk tugas yang paling mendesak; klik untuk membuka Work Breakdown.", en: "Check the 'Upcoming Deadlines' card for the most urgent tasks; click through to the Work Breakdown." },
      { id: "Butuh sesuatu dengan cepat? Tekan Ctrl+K (⌘K di Mac) atau ketik “/” di mana pun untuk membuka pencarian global.", en: "Need something fast? Press Ctrl+K (⌘K on Mac) or type “/” anywhere to open global search." },
    ],
    tips: [
      { id: "Semua angka di Dashboard mengikuti Ormawa Visit yang sedang aktif - kalau angkanya terasa aneh, cek dulu edisi yang dipilih.", en: "Every number here follows the active Ormawa Visit - if the figures look odd, check which edition is selected." },
      { id: "Pencarian global menjangkau tugas, anggota, divisi, Reach & Offer, Super Link, anggaran, rundown, Hari-H, dan FAQ sekaligus. Pakai panah atas/bawah lalu Enter untuk langsung membukanya.", en: "Global search covers tasks, members, divisions, Reach & Offer, Super Link, budget, rundown, event-day jobs, and FAQ at once. Use the up/down arrows then Enter to jump straight there." },
      { id: "Begitu dibuka, pencarian menampilkan 'Pencarian terakhir' - data yang barusan kamu buka, supaya cepat kembali ke sana. Riwayat ini hanya sementara: hilang saat halaman dimuat ulang dan tidak pernah dikirim ke server.", en: "On opening, search shows 'Recent searches' - what you just opened, so you can get back to it fast. The history is temporary: it clears on reload and is never sent to the server." },
      { id: "Tutup pencarian dengan tombol X di pojok kanan kotak pencarian, tombol Esc, atau klik area gelap di luar kotaknya.", en: "Close search with the X button in the corner of the box, the Esc key, or by clicking the dimmed area outside it." },
      { id: "Hasil pencarian hanya menampilkan menu yang memang boleh kamu buka, dan hanya dari Ormawa Visit yang sedang aktif.", en: "Search only returns modules you are allowed to open, and only from the active Ormawa Visit." },
    ],
  },
  {
    key: "tasks",
    title: { id: "Work Breakdown Structure (WBS)", en: "Work Breakdown Structure (WBS)" },
    purpose: {
      id: "Sumber kebenaran semua tugas: siapa mengerjakan apa, kapan tenggatnya, dan apa hasilnya.",
      en: "The single source of truth for every task: who does what, when it's due, and what the result was.",
    },
    steps: [
      { id: "Klik 'Tambah Tugas', isi judul, divisi, PIC, dan tanggal mulai/selesai. Pilihan PIC hanya menampilkan anggota divisi itu, dikelompokkan Koordinator / Fungsionaris / Intern.", en: "Click 'Add Task', then fill in the title, division, PIC, and start/end dates. The PIC picker only shows that division's members, grouped by Coordinator / Staff / Intern." },
      { id: "Saring dengan kolom pencarian, 'Fokus divisi', 'Fokus PIC', dan filter Status di toolbar. 'Fokus PIC' pakai checkbox, jadi bisa menampilkan tugas milik beberapa orang sekaligus; menunya sengaja tetap terbuka saat mencentang.", en: "Narrow things down with the search box, the division focus picker, the PIC focus picker, and the Status filter. PIC focus uses checkboxes so you can show several people's tasks at once; the menu deliberately stays open while ticking." },
      { id: "'Fokus divisi' punya pilihan 'Tanpa divisi' untuk tugas yang tidak masuk divisi mana pun - termasuk tugas yang divisinya sudah dihapus.", en: "The division focus picker has a 'No division' option for tasks that belong to none - including tasks whose division was deleted." },
      { id: "Urutkan dengan mengklik judul kolom. Klik kolom kedua untuk menambah urutan bertingkat - angka kecil menunjukkan prioritas urutan. Klik ketiga menghapus kolom itu dari urutan.", en: "Sort by clicking a column header. Click a second column to add a tiebreaker - the small number shows sort priority. A third click removes that column from the sort." },
      { id: "Untuk mengisi hasil, buka tugasnya (menu titik tiga → Edit). Kolom Hasil di tabel hanya bisa dilihat, tidak bisa diketik langsung.", en: "To submit a result, open the task (three-dot menu → Edit). The Result column in the table is read-only." },
      { id: "Di dalam pop-up, isi 'Hasil - deskripsi' lalu tambahkan tautan lewat 'Tambah tautan'. Bisa lebih dari satu tautan.", en: "Inside the dialog, fill in 'Result - description', then attach links via 'Add link'. You can add more than one." },
      { id: "Bagian 'Referensi' di bawahnya untuk bahan rujukan yang DIPAKAI mengerjakan tugas (handbook, template, proposal tahun lalu). Ketik URL-nya, atau klik 'Ambil dari Super Link' untuk memilih dari direktori. Tombol panah di samping tiap baris langsung membuka tautannya.", en: "The 'References' block below is for material you WORK FROM (a handbook, a template, last year's proposal). Type a URL or click 'Pick from Super Link'. The arrow button next to each row opens it straight away." },
      { id: "Referensi berbeda dari tautan hasil: hasil adalah keluaran tugas yang diterbitkan KE Super Link, sedangkan referensi menunjuk KE Super Link. Satu tautan Super Link boleh dijadikan referensi oleh banyak tugas sekaligus.", en: "References are the opposite of result links: a result is the task's OUTPUT, published TO Super Link, while a reference points AT Super Link. One Super Link entry may be referenced by any number of tasks." },
      { id: "Centang 'Tampilkan juga di Super Link' bila tautan itu perlu muncul di direktori Super Link, lalu beri nama tautannya.", en: "Tick 'Also show in Super Link' if the link belongs in the Super Link directory, then give it a name." },
      { id: "Simpan dengan 'Simpan Perubahan', atau 'Simpan & Selesai' untuk sekaligus menandai tugas selesai.", en: "Save with 'Save Changes', or use 'Save & Done' to save and mark the task complete in one step." },
      { id: "Pilih beberapa tugas lewat kotak centang untuk ubah status atau hapus massal.", en: "Select several tasks with the checkboxes to change status or delete them in bulk." },
      { id: "Tombol 'Ubah massal' pada baris pilihan mengubah Divisi, PIC, dan Deadline sekaligus untuk semua tugas yang dicentang. Centang dulu kolom mana yang ingin diubah - kolom yang tidak dicentang tidak akan tersentuh, jadi mengganti deadline tidak ikut mengosongkan PIC-nya.", en: "The 'Bulk edit' button on the selection bar changes Division, PIC, and Deadline for every ticked task at once. First tick which fields to change - unticked fields are left alone, so changing the deadline won't also clear the PIC." },
    ],
    tips: [
      { id: "Tautan hasil tidak akan terduplikat di Super Link walau tugas disimpan berkali-kali; mengubah atau menghapus tautan di tugas juga otomatis memperbarui Super Link.", en: "Result links never duplicate in Super Link no matter how many times you save; editing or removing a link on the task updates Super Link automatically." },
      { id: "Tugas yang lewat tenggat dan belum selesai otomatis berstatus 'Overtime' - tanpa perlu diubah manual.", en: "A task past its deadline and not yet done automatically shows as 'Overtime' - no manual change needed." },
      { id: "Tampilan Timeline: geser ke samping untuk melihat tanggal lain (kolom nama tugas tetap menempel di kiri), arahkan kursor ke batang tugas untuk melihat rentang tanggal, durasi, divisi, dan PIC-nya. Garis bantu vertikal mengikuti kursor untuk menunjuk tanggal, dan garis berwarna menandai hari ini.", en: "In Timeline view: scroll sideways to reach other dates (the task-name column stays pinned), and hover a bar to see its date range, duration, division, and PIC. A vertical guide follows your cursor to point at the date, and a coloured line marks today." },
      { id: "Kolom # pada tabel adalah nomor urut baris yang sedang tampil (1 sampai baris terakhir), bukan nomor tugas. Kalau difokuskan ke satu divisi, penomorannya tetap mulai dari 1.", en: "The # column is the row position in the current view (1 to the last row), not the task number. Focus on one division and it still starts at 1." },
      { id: "Tampilan bisa diganti antara Tabel, Kanban, dan Timeline.", en: "You can switch between Table, Kanban, and Timeline views." },
    ],
    access: {
      id: "Admin & Koordinator akses penuh (termasuk hapus). Staff & Intern akses terbatas: boleh membuat tugas baru, mengubah, dan mengisi hasil - tapi tidak boleh menghapus. Tamu hanya melihat.",
      en: "Admins & Coordinators have full access (including delete). Staff & Interns have limited access: they can create new tasks, edit them, and fill in results - but never delete. Guests view only.",
    },
  },
  {
    key: "members",
    title: { id: "Divisi & Anggota", en: "Divisions & Members" },
    purpose: {
      id: "Mengelola divisi tiap Ormawa Visit beserta koordinator, fungsionaris, intern, dan daftar anggota.",
      en: "Manage each Ormawa Visit's divisions along with coordinators, staff, interns, and the member roster.",
    },
    steps: [
      { id: "Tab 'Divisi' menampilkan semua divisi Ormawa Visit yang aktif, lengkap dengan progres tugas dan struktur timnya.", en: "The 'Divisions' tab lists the active Ormawa Visit's divisions with their task progress and team structure." },
      { id: "Klik 'Tambah Divisi' untuk membuat divisi baru (nama, singkatan maks. 4 huruf, warna).", en: "Click 'Add Division' to create one (name, short code up to 4 letters, colour)." },
      { id: "Tab 'Anggota EA' berisi daftar orang: nama, NRP, divisi, tipe, dan angkatan. Angkatan terisi otomatis dari NRP.", en: "The 'EA Members' tab lists people: name, student ID, division, type, and cohort. The cohort is derived from the student ID automatically." },
      { id: "Saat menambah atau mengubah anggota, pilih divisinya lewat daftar centang - boleh lebih dari satu divisi untuk satu orang.", en: "When adding or editing a member, pick their divisions from the checkbox list - one person may be in more than one division." },
      { id: "Tombol 'Tambah anggota' pada kartu divisi memasukkan anggota yang SUDAH terdaftar ke divisi itu, bukan membuat orang baru. Bisa pilih beberapa sekaligus, dan divisi lain yang mereka ikuti tidak hilang. Untuk orang yang memang belum terdaftar, pakai tab Anggota EA.", en: "The 'Add member' button on a division card puts people who are ALREADY on the roster into that division, rather than creating a new record. You can pick several at once, and the other divisions they belong to are kept. For someone genuinely new, use the EA Members tab." },
      { id: "Begitu divisi anggota diisi, namanya OTOMATIS muncul di bagian 'Struktur Tim' pada kartu divisi tersebut. Tidak perlu mengetik ulang daftar anggota di dua tempat.", en: "As soon as a member has a division, their name shows up AUTOMATICALLY in that division card's 'Team Structure'. There is no second roster to retype." },
      { id: "Yang masih diisi manual hanyalah koordinatornya: klik 'Tunjuk koordinator' (atau menu titik tiga) pada kartu divisi, lalu pilih salah satu fungsionaris divisi itu. Boleh juga dikosongkan.", en: "The only thing still set by hand is the coordinator: click 'Assign coordinator' (or the three-dot menu) on a division card and pick one of that division's staff. Leaving it empty is fine." },
      { id: "Centang beberapa divisi untuk menghapus massal atau mengatur ikut/tanpa rundown sekaligus.", en: "Tick several divisions to bulk-delete them or toggle rundown participation together." },
      { id: "Klik kartu divisi untuk membuka papan tugas divisi tersebut.", en: "Click a division card to open that division's task board." },
    ],
    tips: [
      { id: "Koordinator adalah PERAN di dalam divisi, bukan divisi tersendiri. Koordinator selalu diambil dari fungsionaris divisi itu, dan sebuah divisi boleh tidak punya koordinator sama sekali.", en: "Coordinator is a ROLE inside a division, not a division of its own. A coordinator is always one of that division's staff, and a division is allowed to have none at all." },
      { id: "Anggota dengan lebih dari satu divisi muncul di semua kartu divisinya, dan ikut terdaftar sebagai pilihan PIC di tiap divisi tersebut. Divisi pertama dipakai sebagai divisi utama di tabel.", en: "A member in several divisions appears on all of their division cards and can be picked as PIC in each of them. The first division is used as the primary one in tables." },
      { id: "Divisi dan anggota berbeda untuk tiap Ormawa Visit, jadi mengubahnya di satu edisi tidak memengaruhi edisi lain.", en: "Divisions and members are per Ormawa Visit, so changes in one edition don't affect the others." },
      { id: "Nama anggota tidak boleh mengandung koma karena koma dipakai sebagai pemisah daftar.", en: "Member names can't contain commas - commas are used as the list separator." },
      { id: "Nama dan NRP adalah data pribadi, jadi daftar anggota hanya tampil untuk akun yang sudah punya peran. Tamu - termasuk akun baru yang perannya belum disetujui - akan melihat halaman ini tanpa daftar nama.", en: "Names and student IDs are personal data, so the roster only appears for accounts that already have a role. A Guest - including a new account whose role isn't approved yet - sees this page without the name list." },
    ],
    access: { id: "Hanya Admin yang bisa mengubah divisi & anggota; peran lain hanya melihat. Daftar nama & NRP tidak tampil untuk Tamu.", en: "Only Admins can edit divisions & members; other roles have view access. Names & student IDs are hidden from Guests." },
  },
  {
    key: "calendar",
    title: { id: "Kalender", en: "Calendar" },
    purpose: {
      id: "Melihat tenggat tugas dan hari pelaksanaan dalam tampilan bulanan.",
      en: "See task deadlines and the event day itself in a monthly view.",
    },
    steps: [
      { id: "Klik tanggal mana pun untuk melihat daftar tugas yang jatuh tempo di tanggal tersebut.", en: "Click any date to see the tasks due on it." },
      { id: "Arahkan kursor ke sebuah tanggal, lalu klik ikon + di pojok kanan atas untuk langsung menambah tugas di tanggal itu.", en: "Hover a date and click the + icon at its top right to add a task on that date directly." },
      { id: "Tanggal Hari-H ditandai bintang dan label khusus.", en: "The event day is marked with a star and its own label." },
    ],
  },
  {
    key: "rundown",
    title: { id: "Rundown (Juklak-Juknis)", en: "Rundown" },
    purpose: {
      id: "Susunan acara hari pelaksanaan, lengkap dengan tugas tiap divisi per sesi.",
      en: "The run of show for the event day, including what each division does per segment.",
    },
    steps: [
      { id: "Gunakan 'Fokus divisi' di atas tabel untuk memilih kolom divisi mana yang ditampilkan - rundown adalah tabel terlebar di aplikasi, jadi ini sangat membantu di layar kecil. Divisi yang ditandai 'tidak diikutsertakan pada rundown' tidak muncul di pilihan karena memang tidak punya kolom.", en: "Use the division focus picker above the table to choose which division columns to show - the rundown is the widest table in the app, so this helps a lot on a small screen. Divisions marked 'excluded from rundown' are not offered, since they have no column." },
      { id: "Klik 'Tambah baris' untuk menambah sesi; waktu mulai otomatis melanjutkan waktu selesai baris sebelumnya.", en: "Click 'Add row' to add a segment; the start time automatically continues from the previous row's end time." },
      { id: "Isi sel langsung di tabel - perubahan tersimpan otomatis saat kursor berpindah.", en: "Edit cells straight in the table - changes save automatically when the field loses focus." },
      { id: "Durasi dihitung otomatis dari waktu mulai & selesai setiap kali tabel dibuka, jadi tidak perlu diisi manual - baris lama yang dulu kosong pun ikut terisi.", en: "Duration is computed from the start and end times every time the table is opened, so you never fill it in - older rows that used to show nothing now display it too." },
      { id: "Tiap divisi punya kolom sendiri; isi kegiatan divisi tersebut pada sesi itu.", en: "Each division has its own column; fill in what that division does during the segment." },
      { id: "Gunakan ikon catatan untuk menulis evaluasi cepat seperti 'Terlalu cepat 5 menit'.", en: "Use the note icon to jot a quick evaluation such as 'Ran 5 minutes early'." },
      { id: "Gunakan ikon salin untuk menduplikat baris yang mirip.", en: "Use the copy icon to duplicate a similar row." },
      { id: "Bila kolom 'Kebutuhan Operator' diisi tautan, tombol buka tautan otomatis muncul di sampingnya.", en: "If the 'Operator Needs' cell contains a link, an open-link button appears next to it." },
      { id: "Kalau sebuah divisi mengerjakan hal yang SAMA selama beberapa sesi berturut-turut, gabungkan selnya: arahkan kursor ke sel itu, lalu klik ikon gabung di pojok kanan bawah. Sekali klik menelan satu baris di bawahnya; klik lagi untuk menelan baris berikutnya.", en: "When a division does the SAME thing across several consecutive segments, merge the cells: hover the cell and click the merge icon in its bottom-right corner. Each click swallows one more row below." },
      { id: "Untuk membatalkan, klik ikon pisah di sel yang sama - sel kembali terpisah per baris.", en: "To undo, click the split icon on that same cell - it returns to one cell per row." },
    ],
    tips: [
      { id: "Rundown kini satu versi saja (versi B dihapus). Kolom No, Waktu, Durasi, dan Kegiatan dibekukan agar tetap terlihat saat menggeser tabel ke samping, dan kini benar-benar menutupi kolom di belakangnya (tidak lagi tampak berlubang).", en: "The rundown is now a single version (version B was removed). The No, Time, Duration, and Activity columns are frozen so they stay visible while scrolling sideways, and they now fully cover the columns behind them (no more see-through gaps)." },
      { id: "Sel yang digabung diberi latar sedikit lebih gelap, jadi terlihat bahwa satu kegiatan memang berjalan melintasi beberapa sesi - bukan kebetulan tertulis sama. Kolom Catatan sengaja tidak bisa digabung karena isinya khas per baris.", en: "A merged cell gets a slightly darker background, so it reads as one activity running across several segments rather than a coincidence of identical text. The Catatan column deliberately cannot be merged - its content is specific to each row." },
      { id: "Divisi yang dicentang 'tidak diikutsertakan pada rundown' (mis. Sekretaris/Bendahara) tidak akan muncul sebagai kolom.", en: "Divisions marked 'excluded from rundown' (e.g. Secretary/Treasurer) won't appear as columns." },
    ],
    access: {
      id: "Admin & Koordinator akses penuh. Staff & Intern akses terbatas: boleh menambah dan mengubah baris, tapi tidak boleh menghapus. Tamu hanya melihat.",
      en: "Admins & Coordinators have full access. Staff & Interns have limited access: they can add and edit rows but not delete them. Guests view only.",
    },
  },
  {
    key: "jobs",
    title: { id: "Job Hari-H", en: "Event-Day Jobs" },
    purpose: {
      id: "Pembagian tugas panitia khusus saat hari pelaksanaan.",
      en: "Who does what among the committee on the event day itself.",
    },
    steps: [
      { id: "Klik 'Tambah Tugas', isi deskripsi tugas dan PIC (dipilih dari anggota).", en: "Click 'Add Task', then fill in the job description and PIC (chosen from members)." },
      { id: "Seret ikon titik-titik di kiri baris untuk mengurutkan; nomor urut menyesuaikan otomatis.", en: "Drag the grip icon on the left of a row to reorder; the numbering updates automatically." },
      { id: "Gunakan menu titik tiga untuk mengubah, menduplikat, atau menghapus tugas. Pilihan 'Hapus' hanya muncul untuk peran yang berhak.", en: "Use the three-dot menu to edit, duplicate, or delete a job. 'Delete' only appears for roles allowed to remove rows." },
    ],
    access: {
      id: "Admin & Koordinator akses penuh. Staff & Intern akses terbatas: boleh menambah, mengubah, dan mengurutkan, tapi tidak boleh menghapus.",
      en: "Admins & Coordinators have full access. Staff & Interns have limited access: they can add, edit, and reorder, but not delete.",
    },
  },
  {
    key: "prospects",
    title: { id: "Reach & Offer", en: "Reach & Offer" },
    purpose: {
      id: "Melacak himpunan/ormawa yang dihubungi, sampai mana prosesnya, dan hasilnya.",
      en: "Track which student associations you've contacted, how far the process got, and the outcome.",
    },
    steps: [
      { id: "Tambah prospek dengan minimal nama ormawa atau kontak. PIC dipilih dari daftar anggota EA; Lokasi dan Mode (offline/online) kini terpisah.", en: "Add a prospect with at least an organisation name or a contact. PIC is picked from the EA member list; Location and Mode (offline/online) are now separate fields." },
      { id: "Perbarui status kontak dan respons untuk menggerakkan prospek di pipeline.", en: "Update the contact status and response to move the prospect along the pipeline." },
      { id: "Tandai 'selesai/terkonfirmasi' bila sudah fix - barisnya akan tampil berbeda (hijau, dicoret) di tabel.", en: "Mark it 'done/confirmed' once settled - the row then looks distinct (green, struck through) in the table." },
      { id: "Lewat menu titik tiga, pilih 'Jadikan data utama' untuk menetapkan prospek ini sebagai partner resmi Ormawa Visit. Detail OV (partner, kampus, lokasi, mode) otomatis mengikuti prospek ini.", en: "From the three-dot menu, choose 'Set as primary' to make this the OV's official partner. The OV's details (partner, campus, location, mode) then follow this prospect." },
      { id: "Isi kolom Tautan dengan handbook, profil organisasi, atau proposal dari himpunan itu, lalu centang 'Tampilkan juga di Super Link' kalau perlu muncul di direktori Super Link. Kolom Catatan untuk catatan bebas.", en: "Use the Link field for their handbook, org profile, or a proposal they sent back, then tick 'Also show in Super Link' if it belongs in the Super Link directory. The Notes field is free text." },
      { id: "Ganti tampilan antara Tabel dan Pipeline; di Tabel bisa hapus massal & sortir bertingkat.", en: "Switch between Table and Pipeline; the Table supports bulk delete & stacked sorting." },
    ],
    tips: [
      { id: "Hanya boleh ada satu data utama per Ormawa Visit. Menetapkan yang baru otomatis melepas yang lama, dan mengubah data prospek utama ikut memperbarui data Ormawa Visit.", en: "There can be only one primary per Ormawa Visit. Setting a new one clears the old; editing the primary prospect also updates the OV's data." },
    ],
    access: { id: "Hanya Admin yang bisa mengubah; peran lain hanya melihat.", en: "Only Admins can edit; every other role views only." },
  },
  {
    key: "links",
    title: { id: "Super Link", en: "Super Link" },
    purpose: {
      id: "Direktori semua dokumen & tautan penting, dikelompokkan per Ormawa Visit dan divisi.",
      en: "A directory of every important document and link, grouped by Ormawa Visit and division.",
    },
    steps: [
      { id: "Klik 'Tambah' untuk menambah tautan: nama, URL, Ormawa Visit, dan divisi. Dropdown divisi hanya menampilkan divisi milik Ormawa Visit yang dipilih.", en: "Click 'Add' to add a link: name, URL, Ormawa Visit, and division. The division dropdown only lists divisions that belong to the selected Ormawa Visit." },
      { id: "Gunakan pencarian dan pemilih 'Jenis Ormawa Visit' untuk menyaring.", en: "Use the search box and the Ormawa Visit picker to filter." },
      { id: "Centang beberapa tautan untuk menghapus sekaligus.", en: "Tick several links to delete them at once." },
    ],
    tips: [
      { id: "Tautan bertanda bagian 'Hasil Tugas' berasal dari hasil tugas di WBS. Ubah atau hapus lewat tugasnya agar keduanya tetap sinkron.", en: "Links under the 'Task Results' section come from WBS task results. Edit or remove them from the task itself so both stay in sync." },
      { id: "URL wajib diisi dan harus diawali http:// atau https://.", en: "A URL is required and must start with http:// or https://." },
    ],
    access: {
      id: "Admin & Koordinator akses penuh. Staff & Intern akses terbatas: boleh menambah dan mengubah tautan, tapi tidak boleh menghapus. Tamu tidak bisa membuka menu ini.",
      en: "Admins & Coordinators have full access. Staff & Interns have limited access: they can add and edit links but not delete them. Guests cannot open this menu.",
    },
  },
  {
    key: "budget",
    title: { id: "Anggaran (RAB)", en: "Budget" },
    purpose: {
      id: "Menyusun rencana anggaran biaya, bisa lebih dari satu skenario (mis. RAB Minimal & Maksimal).",
      en: "Draft the budget, optionally as several scenarios (e.g. minimum and maximum plans).",
    },
    steps: [
      { id: "Buat rencana lewat 'Tambah Rencana', lalu isi itemnya dengan 'Tambah Item'. Cukup isi namanya - rencana otomatis masuk ke Ormawa Visit yang sedang dibuka (lihat lencana edisi di samping tombolnya).", en: "Create a plan via 'Add Plan', then fill it with 'Add Item'. You only give it a name - the plan automatically belongs to the Ormawa Visit you are currently viewing (shown on the badge next to the button)." },
      { id: "Di pop-up 'Tambah Item', klik bulatan warna di sebelah kolom Kategori untuk memilih warna kategori tersebut - pilihan warnanya sama dengan yang dipakai saat mengatur warna divisi.", en: "In the 'Add Item' dialog, click the coloured dot next to the Category field to choose that category's colour - the same palette used for division colours." },
      { id: "Warna juga bisa diubah langsung dari bulatan kecil di baris ringkasan kategori, tanpa membuka pop-up.", en: "You can also recolour straight from the small dot in the category summary row, without opening a dialog." },
      { id: "Ubah Qty dan Harga satuan langsung di tabel; Total dan Subtotal dihitung otomatis. Tekan Enter untuk langsung menyimpan, atau klik di luar kolom.", en: "Edit Qty and Unit price inline; Total and Subtotal are computed automatically. Press Enter to save immediately, or just click outside the field." },
      { id: "Tombol panah naik/turun pada kolom Qty ikut tersimpan sendiri sesaat setelah diklik.", en: "The up/down arrows on the Qty field save by themselves a moment after you click them." },
      { id: "Gunakan ikon salin untuk menduplikat item yang mirip.", en: "Use the copy icon to duplicate a similar item." },
      { id: "Centang beberapa item untuk menghapus sekaligus.", en: "Tick several items to delete them at once." },
      { id: "Seret ikon titik-titik di kiri baris untuk mengubah urutan item. Pengurutan berlaku di dalam kategorinya masing-masing, supaya satu kategori tidak terpecah menjadi dua bagian di tabel.", en: "Drag the grip icon on the left of a row to reorder items. Reordering happens within each category, so a category never gets split into two separate blocks in the table." },
    ],
    tips: [
      { id: "Nilai negatif tidak diterima, dan total dibulatkan ke rupiah utuh.", en: "Negative values are rejected, and totals are rounded to whole rupiah." },
      { id: "Warna berlaku untuk SATU kategori pada satu rencana anggaran - semua item di kategori itu ikut berubah warnanya.", en: "A colour belongs to ONE category within one budget plan - every item in that category changes with it." },
      { id: "Tekan Esc saat mengetik Qty atau Harga untuk membatalkan perubahan pada kolom itu.", en: "Press Esc while typing a Qty or Price to discard that field's change." },
    ],
    access: { id: "Semua peran kecuali Tamu bisa membuka dan melihat anggaran; hanya Admin yang bisa mengubah.", en: "Every role except Guest can open and read the budget; only Admins can edit it." },
  },
  {
    key: "events",
    title: { id: "Ormawa Visit (Edisi)", en: "Ormawa Visit (Editions)" },
    purpose: {
      id: "Mengelola daftar gelaran Ormawa Visit dan memilih edisi mana yang sedang dilihat.",
      en: "Manage the list of Ormawa Visit editions and choose which one you're viewing.",
    },
    steps: [
      { id: "Klik 'Lihat Ormawa Visit ini' pada kartu untuk menjadikannya edisi aktif di seluruh sistem.", en: "Click 'View this Ormawa Visit' on a card to make it the active edition across the whole system." },
      { id: "Saat membuat edisi baru, gunakan bagian 'Salin data dari Ormawa Visit lain' untuk menyalin Divisi, Anggota, Reach & Offer, Tugas, Rundown, Job Hari-H, atau Anggaran sebagai kerangka awal.", en: "When creating a new edition, use 'Copy data from another Ormawa Visit' to bring over Divisions, Members, Reach & Offer, Tasks, Rundown, Event-Day Jobs, or Budget as a starting point." },
      { id: "Tiap menu punya dropdown sumbernya sendiri, jadi satu edisi baru bisa mengambil Divisi dari Ormawa Visit A sekaligus Rundown dari Ormawa Visit B. Menu yang tidak dicentang tidak disalin sama sekali.", en: "Each menu has its own source dropdown, so one new edition can take Divisions from Ormawa Visit A and the Rundown from Ormawa Visit B. Unticked menus are not copied at all." },
      { id: "Salin data juga tersedia saat MENGEDIT Ormawa Visit yang sudah ada - klik 'Salin data dari Ormawa Visit lain…' di dalam pop-up edit. Perhatikan peringatannya: data menu yang dicentang akan dihapus lebih dulu, bukan digabung.", en: "Copying is also available when EDITING an existing Ormawa Visit - click 'Copy data from another Ormawa Visit…' inside the edit dialog. Heed the warning: the ticked menus' data is deleted first, not merged." },
      { id: "Gunakan 'Duplikat' pada menu titik tiga untuk menyalin identitas edisi tanpa datanya.", en: "Use 'Duplicate' in the three-dot menu to copy an edition's details without its data." },
      { id: "Kalau sebuah Ormawa Visit sudah selesai, admin bisa memilih 'Kunci sebagai arsip' di menu titik tiga. Edisi itu langsung ditandai lencana 'Arsip' dan jadi hanya-baca.", en: "Once an Ormawa Visit is finished, an admin can pick 'Lock as archive' from the three-dot menu. That edition is tagged 'Archive' and becomes read-only." },
      { id: "Untuk membukanya lagi, admin memilih 'Buka kunci arsip' dari menu yang sama.", en: "To reopen it, an admin picks 'Unlock archive' from the same menu." },
    ],
    tips: [
      { id: "Hampir semua menu mengikuti edisi aktif - kalau data terasa hilang, cek dulu edisi yang sedang dipilih.", en: "Almost every menu follows the active edition - if data seems missing, check which edition is selected." },
      { id: "Arsip adalah pengaman untuk edisi yang sudah lewat: setelah dikunci, Koordinator/Staff/Intern tidak bisa lagi mengubah tugas, rundown, Hari-H, atau tautan milik edisi itu - jadi data tahun lalu tidak bisa terinjak tanpa sengaja.", en: "The archive protects finished editions: once locked, Coordinators/Staff/Interns can no longer change that edition's tasks, rundown, event-day jobs, or links - so last year's data cannot be overwritten by accident." },
      { id: "Saat sebuah Ormawa Visit yang diarsipkan sedang dibuka, muncul spanduk abu-abu di atas layar sebagai pengingat bahwa isinya hanya bisa dilihat. Warnanya sengaja dibedakan dari spanduk kuning Mode Demo.", en: "While an archived Ormawa Visit is the active one, a grey strip appears at the top as a reminder that it is read-only. The colour is deliberately different from the amber Demo Mode strip." },
      { id: "Bagian 'Performance Measurement' pada formulir Ormawa Visit diisi SETELAH acara selesai: jumlah fungsionaris HMSI yang hadir, total feedback dan rata-rata rating dari kedua belah pihak, serta tautan LPJ. Hasilnya langsung tampil di Dashboard.", en: "The 'Performance Measurement' section of the Ormawa Visit form is filled in AFTER the event: how many HMSI functionaries attended, the feedback count and average rating from each side, and the accountability report link. It appears on the Dashboard straight away." },
      { id: "Kolom Performance Measurement boleh dikosongkan. Yang kosong tampil sebagai '-' di Dashboard, bukan angka 0 - jadi 'belum diisi' tidak tertukar dengan 'nilainya nol'.", en: "Performance Measurement fields may be left blank. Blank shows as '-' on the Dashboard rather than 0, so 'not recorded' is never mistaken for 'the value was zero'." },
      { id: "Admin tetap bisa mengubah isi edisi yang diarsipkan, supaya kesalahan lama masih bisa diperbaiki tanpa harus membuka kuncinya untuk semua orang.", en: "Admins can still edit an archived edition, so an old mistake can be corrected without reopening it for everyone." },
    ],
    access: { id: "Hanya Admin yang bisa membuat/mengubah edisi, serta mengunci dan membuka arsip.", en: "Only Admins can create/edit editions, and lock or unlock the archive." },
  },
  {
    key: "roles",
    title: { id: "Role Request (Permintaan Peran)", en: "Role Request" },
    purpose: {
      id: "Menyetujui atau mengabaikan permintaan peran dari akun yang baru mendaftar sendiri.",
      en: "Approve or ignore role requests filed by accounts that signed themselves up.",
    },
    steps: [
      { id: "Siapa pun bisa mendaftar sendiri lewat halaman Daftar (email & kata sandi, atau Google).", en: "Anyone can sign themselves up from the Sign Up page (email & password, or Google)." },
      { id: "Akun baru belum punya peran - setara Tamu, hanya bisa melihat.", en: "A new account has no role - it is equivalent to a Guest and can only look around." },
      { id: "Dari menu akun (pojok kanan atas) atau spanduk kuning di atas halaman, akun tersebut memilih 'Ajukan Peran', lalu memilih Koordinator, Staff, atau Intern.", en: "From the account menu (top right) or the amber banner at the top of the page, they pick 'Request Role' and choose Coordinator, Staff, or Intern." },
      { id: "Selama belum diputuskan, pengajuan masih bisa diperbaiki lewat 'Ubah pengajuan' - misalnya salah pilih peran atau ada salah ketik di catatan.", en: "While it is still undecided, the request can be corrected via 'Edit request' - for a wrong role choice or a typo in the note." },
      { id: "Admin membuka menu Role Request, lalu menekan 'Setujui' (peran langsung diberikan) atau 'Abaikan' (peran tidak berubah).", en: "An admin opens the Role Request menu and clicks 'Approve' (the role is granted immediately) or 'Ignore' (the role is left unchanged)." },
      { id: "Setelah punya peran, akun tetap bisa mengajukan perubahan peran lewat 'Ajukan Ubah Peran' - naik maupun turun.", en: "Once it has a role, the account can still ask to change it via 'Request a Role Change' - either up or down." },
    ],
    tips: [
      { id: "Peran berlaku untuk SEMUA Ormawa Visit, jadi pengajuan tidak perlu memilih edisi.", en: "A role applies across EVERY Ormawa Visit, so a request doesn't pick an edition." },
      { id: "Peran yang sedang dipakai tidak muncul sebagai pilihan, dan Admin tidak pernah bisa diminta lewat cara ini. Akun Admin juga tidak bisa diturunkan lewat pengajuan.", en: "The role you already hold isn't offered as an option, and Admin can never be requested this way. An admin account also can't be demoted through a request." },
      { id: "Satu akun hanya boleh punya satu pengajuan yang menunggu keputusan. Riwayat pengajuan yang sudah diputuskan tetap tersimpan di bawah daftar.", en: "An account may only have one request awaiting a decision. Decided requests stay in the history list below." },
      { id: "Masuk sebagai Tamu (tanpa akun) berbeda dengan mendaftar - Tamu tanpa akun tidak bisa mengajukan peran.", en: "Entering as a Guest (no account) is different from signing up - a guest without an account cannot request a role." },
      { id: "Untuk memulai cepat, tersedia akun default siap pakai untuk Koordinator, Staff, dan Intern (dibuat lewat skrip supabase/default-accounts.sql). Orang bisa langsung memakainya tanpa mendaftar & menunggu persetujuan. Ganti kata sandi awalnya setelah login pertama.", en: "For a quick start, ready-to-use default accounts exist for Coordinator, Staff, and Intern (created via the supabase/default-accounts.sql script). People can use them straight away without signing up and waiting for approval. Change the initial password after first login." },
      { id: "Ganti kata sandi lewat menu akun di pojok kanan atas → 'Ubah Kata Sandi'. Kata sandi lama wajib diisi, dan yang baru minimal 8 karakter. Kalau kata sandinya terlanjur lupa, admin bisa mengaturnya ulang dari dashboard Supabase (Authentication → pilih akunnya).", en: "Change a password from the account menu at the top right → 'Change Password'. The old password is required and the new one needs at least 8 characters. If a password is forgotten entirely, an admin can reset it from the Supabase dashboard (Authentication → pick the account)." },
      { id: "Di Mode Demo menu ini tetap bisa dibuka, tapi isinya selalu kosong: demo memakai database contoh yang terpisah dan tidak memakai login sama sekali (peran diganti lewat tombol peran di kanan atas), jadi tidak ada akun yang bisa mengajukan maupun diberi peran. Penjelasan ini juga ditampilkan di halamannya.", en: "In Demo Mode this menu still opens but is always empty: the demo runs on a separate sample database with no login at all (you switch role with the role button at the top right), so there is no account to file or receive a request. The page itself explains this too." },
    ],
    access: { id: "Hanya Admin yang bisa membuka dan memutuskan.", en: "Only Admins can open it and decide." },
  },
  {
    key: "violet",
    title: { id: "Violet (asisten chat)", en: "Violet (chat assistant)" },
    purpose: {
      id: "Tanya jawab cepat soal sistem ini: menu, cara pakai, hak akses, dan data Ormawa Visit yang sedang dibuka.",
      en: "Quick answers about this system: menus, how to use them, access rules, and the data of the Ormawa Visit you are viewing.",
    },
    steps: [
      { id: "Klik tombol ungu 'Violet' di pojok kanan bawah, lalu ketik pertanyaanmu. Enter mengirim, Shift+Enter membuat baris baru.", en: "Click the purple 'Violet' button at the bottom right and type your question. Enter sends, Shift+Enter makes a new line." },
      { id: "Tiap jawaban menyertakan sumbernya di bawah. Klik sumbernya untuk langsung membuka menu yang dimaksud.", en: "Every answer lists its sources underneath. Click one to jump straight to the menu it came from." },
      { id: "Ikon tong sampah di kepala panel membersihkan percakapan.", en: "The bin icon in the panel header clears the conversation." },
    ],
    tips: [
      { id: "Violet HANYA menjawab soal sistem ini. Pertanyaan di luar itu ditolak, dan kalau jawabannya memang tidak ada di sistem, Violet mengaku tidak tahu alih-alih mengarang nama menu atau angka.", en: "Violet ONLY answers about this system. Anything else is declined, and when the answer genuinely is not in the system it says so rather than inventing a menu name or a figure." },
      { id: "Violet membaca data lewat sesi kamu sendiri, jadi hak aksesmu tetap berlaku. Tamu tidak bisa memancing daftar nama anggota lewat chat.", en: "Violet reads data through your own session, so your access rules still apply. A guest cannot coax the member roster out of it." },
      { id: "Percakapannya tidak disimpan: hilang saat panel ditutup atau halaman dimuat ulang. Jawabannya mengutip data yang terus berubah, jadi transkrip lama akan cepat menyesatkan.", en: "The conversation is not stored: it goes when you close the panel or reload. Answers quote live data that keeps changing, so an old transcript would quickly mislead." },
      { id: "Tombolnya hanya muncul kalau admin sudah mengisi GEMINI_API_KEY di server.", en: "The button only appears once an admin has set GEMINI_API_KEY on the server." },
    ],
    access: {
      id: "Semua peran yang sudah masuk bisa memakai Violet. Yang bisa dijawab menyesuaikan hak akses masing-masing.",
      en: "Every signed-in role can use Violet. What it can answer follows each role's own access.",
    },
  },
  {
    key: "settings",
    title: { id: "Pengaturan", en: "Settings" },
    purpose: {
      id: "Informasi akun, status backend, matriks hak akses, backup, dan changelog.",
      en: "Account info, backend status, the access matrix, backups, and the changelog.",
    },
    steps: [
      { id: "Lihat 'Hak Akses per Peran' untuk memahami menu apa saja yang bisa dibuka tiap peran. Centang hijau = akses penuh, centang kuning = akses terbatas (bisa buat/ubah/isi hasil tapi tidak bisa hapus), centang biru = hanya lihat, strip = tidak ada akses.", en: "Check 'Access by Role' to see which menus each role can open. A green check = full access, an amber check = limited access (create/edit/fill in results, but no deleting), a blue check = view only, a dash = no access." },
      { id: "Gunakan tombol panel di kepala menu samping untuk menciutkannya menjadi ikon saja; arahkan kursor ke bilah ikon untuk membukanya sementara.", en: "Use the panel button in the sidebar header to collapse it to icons only; hover the icon rail to expand it temporarily." },
      { id: "Gunakan Backup & Rollback untuk mencadangkan atau memulihkan data (khusus Admin, mode produksi).", en: "Use Backup & Rollback to snapshot or restore data (Admin only, production mode)." },
      { id: "Tombol 'Impor dari File' memulihkan data dari file JSON backup yang pernah kamu unduh - berguna kalau backup-nya sudah terlanjur dihapus dari daftar. Filenya diperiksa dulu dan jumlah tabel & barisnya ditampilkan sebelum kamu mengetik konfirmasi.", en: "The 'Import from File' button restores from a backup JSON you downloaded earlier - useful when the backup has already been deleted from the list. The file is checked first and its table and row counts are shown before you type the confirmation." },
      { id: "Sama seperti rollback biasa, impor mengganti SELURUH data saat ini, dan sistem otomatis membuat backup pengaman sebelum menimpanya.", en: "Just like a normal rollback, importing replaces ALL current data, and the system automatically takes a safety backup before overwriting." },
      { id: "Di Mode Demo, tersedia 'Reset ke data awal' untuk mengembalikan sandbox ke contoh semula.", en: "In Demo Mode you get 'Reset to initial data' to restore the sandbox to its original sample data." },
      { id: "Bagian 'Kode Sumber Terbuka' memuat tautan ke repositori GitHub aplikasi ini - kodenya open source, jadi siapa pun boleh membacanya atau ikut mengembangkannya.", en: "The 'Open Source' section links to this app's GitHub repository - the code is open source, so anyone may read it or help develop it." },
    ],
    access: {
      id: "Semua peran kecuali Tamu bisa membuka untuk melihat matriks hak akses & changelog. Backup, rollback, dan reset data demo hanya untuk Admin.",
      en: "Every role except Guest can open it to read the access matrix and changelog. Backup, rollback, and demo data reset are Admin-only.",
    },
  },
];
