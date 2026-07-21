import type { Lang } from "./i18n/config";

// ============================================================
// Per-feature usage guide, in Indonesian AND English side by side.
//
// Kept as data (not JSX/dict strings) so both languages live together and a
// feature change only means editing one entry here.
//
// MAINTENANCE: when you add or change a feature, update its section below —
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
    ],
    tips: [
      { id: "Semua angka di Dashboard mengikuti Ormawa Visit yang sedang aktif — kalau angkanya terasa aneh, cek dulu edisi yang dipilih.", en: "Every number here follows the active Ormawa Visit — if the figures look odd, check which edition is selected." },
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
      { id: "Klik 'Tambah Tugas', isi judul, divisi, PIC (dipilih dari daftar anggota), dan tanggal mulai/selesai.", en: "Click 'Add Task', then fill in the title, division, PIC (picked from the member list), and start/end dates." },
      { id: "Saring dengan kolom pencarian, 'Fokus divisi', dan filter Status di toolbar.", en: "Narrow things down with the search box, the division focus picker, and the Status filter in the toolbar." },
      { id: "Urutkan dengan mengklik judul kolom. Klik kolom kedua untuk menambah urutan bertingkat — angka kecil menunjukkan prioritas urutan. Klik ketiga menghapus kolom itu dari urutan.", en: "Sort by clicking a column header. Click a second column to add a tiebreaker — the small number shows sort priority. A third click removes that column from the sort." },
      { id: "Untuk mengisi hasil, buka tugasnya (menu titik tiga → Edit). Kolom Hasil di tabel hanya bisa dilihat, tidak bisa diketik langsung.", en: "To submit a result, open the task (three-dot menu → Edit). The Result column in the table is read-only." },
      { id: "Di dalam pop-up, isi 'Hasil — deskripsi' lalu tambahkan tautan lewat 'Tambah tautan'. Bisa lebih dari satu tautan.", en: "Inside the dialog, fill in 'Result — description', then attach links via 'Add link'. You can add more than one." },
      { id: "Centang 'Tampilkan juga di Super Link' bila tautan itu perlu muncul di direktori Super Link, lalu beri nama tautannya.", en: "Tick 'Also show in Super Link' if the link belongs in the Super Link directory, then give it a name." },
      { id: "Simpan dengan 'Simpan Perubahan', atau 'Simpan & Selesai' untuk sekaligus menandai tugas selesai.", en: "Save with 'Save Changes', or use 'Save & Done' to save and mark the task complete in one step." },
      { id: "Pilih beberapa tugas lewat kotak centang untuk ubah status atau hapus massal.", en: "Select several tasks with the checkboxes to change status or delete them in bulk." },
    ],
    tips: [
      { id: "Tautan hasil tidak akan terduplikat di Super Link walau tugas disimpan berkali-kali; mengubah atau menghapus tautan di tugas juga otomatis memperbarui Super Link.", en: "Result links never duplicate in Super Link no matter how many times you save; editing or removing a link on the task updates Super Link automatically." },
      { id: "Nomor tugas terisi otomatis per divisi — tidak perlu diketik manual.", en: "Task numbers are assigned automatically per division — no need to type them." },
      { id: "Tampilan bisa diganti antara Tabel, Kanban, dan Timeline.", en: "You can switch between Table, Kanban, and Timeline views." },
    ],
    access: {
      id: "Admin & Koordinator bisa membuat/mengubah tugas. Staff & Intern bisa memperbarui status dan mengisi hasil pada tugas mereka.",
      en: "Admins & Coordinators can create/edit tasks. Staff & Interns can update status and fill in results on their own tasks.",
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
      { id: "Pada tiap kartu divisi, bagian 'Struktur Tim' menampilkan Koordinator, Fungsionaris, dan Intern. Klik 'Isi tim' atau menu titik tiga untuk mengubahnya.", en: "On each division card, the 'Team Structure' block shows Coordinator, Staff, and Interns. Use 'Fill team' or the three-dot menu to edit." },
      { id: "Centang beberapa divisi untuk menghapus massal atau mengatur ikut/tanpa rundown sekaligus.", en: "Tick several divisions to bulk-delete them or toggle rundown participation together." },
      { id: "Tab 'Anggota EA' berisi daftar orang: nama, NRP, divisi, tipe, dan angkatan. Angkatan terisi otomatis dari NRP.", en: "The 'EA Members' tab lists people: name, student ID, division, type, and cohort. The cohort is derived from the student ID automatically." },
      { id: "Klik kartu divisi untuk membuka papan tugas divisi tersebut.", en: "Click a division card to open that division's task board." },
    ],
    tips: [
      { id: "Koordinator adalah PERAN di dalam divisi, bukan divisi tersendiri — setiap divisi punya satu koordinator.", en: "Coordinator is a ROLE inside a division, not a division of its own — each division has exactly one." },
      { id: "Divisi dan anggota berbeda untuk tiap Ormawa Visit, jadi mengubahnya di satu edisi tidak memengaruhi edisi lain.", en: "Divisions and members are per Ormawa Visit, so changes in one edition don't affect the others." },
      { id: "Nama anggota tidak boleh mengandung koma karena koma dipakai sebagai pemisah daftar.", en: "Member names can't contain commas — commas are used as the list separator." },
    ],
    access: { id: "Hanya Admin yang bisa mengubah divisi & anggota; peran lain hanya melihat.", en: "Only Admins can edit divisions & members; other roles have view access." },
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
      { id: "Klik 'Tambah baris' untuk menambah sesi; waktu mulai otomatis melanjutkan waktu selesai baris sebelumnya.", en: "Click 'Add row' to add a segment; the start time automatically continues from the previous row's end time." },
      { id: "Isi sel langsung di tabel — perubahan tersimpan otomatis saat kursor berpindah.", en: "Edit cells straight in the table — changes save automatically when the field loses focus." },
      { id: "Durasi dihitung otomatis dari waktu mulai & selesai, jadi tidak perlu diisi manual.", en: "Duration is computed automatically from the start and end times, so you don't fill it in." },
      { id: "Tiap divisi punya kolom sendiri; isi kegiatan divisi tersebut pada sesi itu.", en: "Each division has its own column; fill in what that division does during the segment." },
      { id: "Gunakan ikon catatan untuk menulis evaluasi cepat seperti 'Terlalu cepat 5 menit'.", en: "Use the note icon to jot a quick evaluation such as 'Ran 5 minutes early'." },
      { id: "Gunakan ikon salin untuk menduplikat baris yang mirip.", en: "Use the copy icon to duplicate a similar row." },
    ],
    tips: [
      { id: "Divisi yang dicentang 'tidak diikutsertakan pada rundown' (mis. Sekretaris/Bendahara) tidak akan muncul sebagai kolom.", en: "Divisions marked 'excluded from rundown' (e.g. Secretary/Treasurer) won't appear as columns." },
    ],
    access: { id: "Admin & Koordinator bisa mengubah; peran lain hanya melihat.", en: "Admins & Coordinators can edit; other roles view only." },
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
      { id: "Gunakan menu titik tiga untuk mengubah, menduplikat, atau menghapus tugas.", en: "Use the three-dot menu to edit, duplicate, or delete a job." },
    ],
    access: { id: "Admin & Koordinator bisa mengubah.", en: "Admins & Coordinators can edit." },
  },
  {
    key: "prospects",
    title: { id: "Reach & Offer", en: "Reach & Offer" },
    purpose: {
      id: "Melacak himpunan/ormawa yang dihubungi, sampai mana prosesnya, dan hasilnya.",
      en: "Track which student associations you've contacted, how far the process got, and the outcome.",
    },
    steps: [
      { id: "Tambah prospek dengan minimal nama ormawa atau kontak.", en: "Add a prospect with at least an organisation name or a contact." },
      { id: "Perbarui status kontak dan respons untuk menggerakkan prospek di pipeline.", en: "Update the contact status and response to move the prospect along the pipeline." },
      { id: "Ganti tampilan antara Tabel dan Pipeline lewat tombol di kanan atas.", en: "Switch between Table and Pipeline views with the toggle at the top right." },
      { id: "Di tampilan Tabel, centang beberapa baris untuk menghapus massal, dan urutkan kolom secara bertingkat.", en: "In Table view, tick rows to delete in bulk, and stack column sorts." },
    ],
    access: { id: "Admin, Koordinator, dan Staff bisa mengubah; Intern & Tamu hanya melihat.", en: "Admins, Coordinators, and Staff can edit; Interns & Guests view only." },
  },
  {
    key: "links",
    title: { id: "Super Link", en: "Super Link" },
    purpose: {
      id: "Direktori semua dokumen & tautan penting, dikelompokkan per Ormawa Visit dan divisi.",
      en: "A directory of every important document and link, grouped by Ormawa Visit and division.",
    },
    steps: [
      { id: "Klik 'Tambah' untuk menambah tautan: nama, URL, Ormawa Visit, dan divisi.", en: "Click 'Add' to add a link: name, URL, Ormawa Visit, and division." },
      { id: "Gunakan pencarian dan pemilih 'Jenis Ormawa Visit' untuk menyaring.", en: "Use the search box and the Ormawa Visit picker to filter." },
      { id: "Centang beberapa tautan untuk menghapus sekaligus.", en: "Tick several links to delete them at once." },
    ],
    tips: [
      { id: "Tautan bertanda bagian 'Hasil Tugas' berasal dari hasil tugas di WBS. Ubah atau hapus lewat tugasnya agar keduanya tetap sinkron.", en: "Links under the 'Task Results' section come from WBS task results. Edit or remove them from the task itself so both stay in sync." },
      { id: "URL wajib diisi dan harus diawali http:// atau https://.", en: "A URL is required and must start with http:// or https://." },
    ],
    access: { id: "Semua peran kecuali Tamu bisa menambah; hanya Admin & Koordinator bisa mengubah/menghapus.", en: "Every role except Guest can add; only Admins & Coordinators can edit/delete." },
  },
  {
    key: "budget",
    title: { id: "Anggaran (RAB)", en: "Budget" },
    purpose: {
      id: "Menyusun rencana anggaran biaya, bisa lebih dari satu skenario (mis. RAB Minimal & Maksimal).",
      en: "Draft the budget, optionally as several scenarios (e.g. minimum and maximum plans).",
    },
    steps: [
      { id: "Buat rencana lewat 'Tambah Rencana', lalu isi itemnya dengan 'Tambah Item'.", en: "Create a plan via 'Add Plan', then fill it with 'Add Item'." },
      { id: "Ubah Qty dan Harga satuan langsung di tabel; Total dan Subtotal dihitung otomatis.", en: "Edit Qty and Unit price inline; Total and Subtotal are computed automatically." },
      { id: "Gunakan ikon salin untuk menduplikat item yang mirip.", en: "Use the copy icon to duplicate a similar item." },
      { id: "Centang beberapa item untuk menghapus sekaligus.", en: "Tick several items to delete them at once." },
    ],
    tips: [{ id: "Nilai negatif tidak diterima, dan total dibulatkan ke rupiah utuh.", en: "Negative values are rejected, and totals are rounded to whole rupiah." }],
    access: { id: "Hanya Admin & Koordinator yang bisa membuka menu ini.", en: "Only Admins & Coordinators can open this menu." },
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
      { id: "Saat membuat edisi baru, gunakan bagian 'Salin data dari Ormawa Visit lain' untuk menyalin Divisi, Anggota, Tugas, Rundown, Job Hari-H, atau Anggaran sebagai kerangka awal.", en: "When creating a new edition, use 'Copy data from another Ormawa Visit' to bring over Divisions, Members, Tasks, Rundown, Event-Day Jobs, or Budget as a starting point." },
      { id: "Gunakan 'Duplikat' pada menu titik tiga untuk menyalin identitas edisi tanpa datanya.", en: "Use 'Duplicate' in the three-dot menu to copy an edition's details without its data." },
    ],
    tips: [
      { id: "Hampir semua menu mengikuti edisi aktif — kalau data terasa hilang, cek dulu edisi yang sedang dipilih.", en: "Almost every menu follows the active edition — if data seems missing, check which edition is selected." },
    ],
    access: { id: "Hanya Admin yang bisa membuat/mengubah edisi.", en: "Only Admins can create/edit editions." },
  },
  {
    key: "settings",
    title: { id: "Pengaturan", en: "Settings" },
    purpose: {
      id: "Informasi akun, status backend, matriks hak akses, backup, dan changelog.",
      en: "Account info, backend status, the access matrix, backups, and the changelog.",
    },
    steps: [
      { id: "Lihat 'Hak Akses per Peran' untuk memahami menu apa saja yang bisa dibuka tiap peran.", en: "Check 'Access by Role' to see which menus each role can open." },
      { id: "Gunakan Backup & Rollback untuk mencadangkan atau memulihkan data (khusus Admin, mode produksi).", en: "Use Backup & Rollback to snapshot or restore data (Admin only, production mode)." },
      { id: "Di Mode Demo, tersedia 'Reset ke data awal' untuk mengembalikan sandbox ke contoh semula.", en: "In Demo Mode you get 'Reset to initial data' to restore the sandbox to its original sample data." },
    ],
    access: { id: "Hanya Admin.", en: "Admins only." },
  },
];
