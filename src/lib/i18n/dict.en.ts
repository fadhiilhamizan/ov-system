// The English map. 33KB - deliberately kept OUT of the client bundle: it is
// imported only by the server translator and by a server-side dynamic import
// in the root layout (see lib/i18n/dict.ts). Never import this from a
// "use client" module, or every visitor downloads it.
export const EN: Record<string, string> = {
  // Nav groups
  "Utama": "Main",
  "Cadangan": "Fallback",
  "Memuat…": "Loading…",
  "Asisten Violet": "Violet assistant",
  "Kunci terpasang": "Key configured",
  "Belum diatur": "Not configured",
  "Violet mencoba penyedia sesuai urutan di bawah dan memakai jawaban pertama yang berhasil. Kalau kuota harian penyedia utama habis, penyedia cadangan yang menjawab.": "Violet tries the providers in the order below and uses the first answer that works. When the main provider's daily quota runs out, the fallback answers instead.",
  "Belum ada penyedia yang diatur, jadi tombol Violet tidak muncul untuk siapa pun. Isi GEMINI_API_KEY atau GROQ_API_KEY di environment server.": "No provider is configured, so the Violet button does not appear for anyone. Set GEMINI_API_KEY or GROQ_API_KEY in the server environment.",
  "Operasional": "Operational",
  "Relasi & Aset": "Relations & Assets",
  "Organisasi": "Organization",
  "Bantuan": "Help",
  "Sistem": "System",
  // Nav labels
  "Work Breakdown": "Work Breakdown",
  "Divisi": "Divisions",
  "Kalender": "Calendar",
  "Rundown": "Rundown",
  "Hari-H": "D-Day",
  "Reach & Offer": "Reach & Offer",
  "Super Link": "Super Link",
  "Anggaran": "Budget",
  "Anggota & Tim": "Members & Team",
  "Ormawa Visit": "Ormawa Visit",
  "FAQ & Panduan": "FAQ & Guide",
  "Pengaturan": "Settings",
  // Nav descriptions
  "Ringkasan progres & metrik Ormawa Visit": "Progress overview & metrics",
  "Semua tugas: tabel, kanban & timeline": "All tasks: table, kanban & timeline",
  "Tugas per divisi, otomatis tersinkron": "Tasks per division, auto-synced",
  "Deadline & agenda dalam tampilan kalender": "Deadlines & agenda in a calendar",
  "Susunan acara hari pelaksanaan": "Run-of-show for the event day",
  "Pembagian tugas panitia saat hari pelaksanaan": "Committee duties on the event day",
  "Data & alur himpunan yang dihubungi": "Data & pipeline of reached associations",
  "Kumpulan dokumen & tautan penting": "Important documents & links",
  "Rencana anggaran biaya & skenario min/maks": "Budget plan & min/max scenarios",
  "Daftar anggota & struktur tim tiap divisi": "Member directory & team structure",
  "Kelola daftar Ormawa Visit": "Manage the Ormawa Visit list",
  "Pertanyaan umum seputar Ormawa Visit": "Common questions about Ormawa Visit",
  "Konfigurasi sistem & manajemen data": "System configuration & data management",
  // Topbar / shell
  "Management System · EA HMSI": "Management System · EA HMSI",
  "Ganti tema": "Toggle theme",
  "Ganti bahasa": "Change language",
  "Fokus divisi": "Division focus",
  "Fokus ke divisi": "Focus on a division",
  "Semua Divisi": "All Divisions",
  "Pilih Ormawa Visit": "Choose Ormawa Visit",
  "Ganti peran (mode demo)": "Switch role (demo)",
  "Keluar": "Sign out",
  "Menu": "Menu",
  "Peran": "Role",
  "Sedang dilihat": "Viewing",
  "Aktif": "Active",
  "Rencana": "Planned",
  "Selesai": "Done",
  // Roles
  "Admin / PIC": "Admin / PIC",
  "Koordinator": "Coordinator",
  "Staff": "Staff",
  "Intern": "Intern",
  "Tamu": "Guest",
  "Akses penuh ke semua fitur": "Full access to everything",
  "Kelola divisi, tugas, rundown & anggaran": "Manage divisions, tasks, rundown & budget",
  "Update status & isi hasil tugasnya": "Update status & submit results",
  "Hanya melihat": "View only",
  // Common actions
  "Tambah": "Add",
  "Edit": "Edit",
  "Hapus": "Delete",
  "Batal": "Cancel",
  "Simpan": "Save",
  "Reset": "Reset",
  "Masuk": "Sign in",
  "Tambah Tugas": "Add Task",
  "Tambah Ormawa Visit": "Add Ormawa Visit",
  "Tambah Divisi": "Add Division",
  "Tambah Tim": "Add Team",
  "Tambah Agenda": "Add Agenda",
  "Tambah Anggota": "Add Member",
  "Ubah status": "Change status",
  "terpilih": "selected",
  // View modes / filters
  "Tabel": "Table",
  "Kanban": "Kanban",
  "Timeline": "Timeline",
  "Pipeline": "Pipeline",
  "Semua Status": "All Status",
  "Semua Batch": "All Batches",
  "Semua Tahap": "All Stages",
  "Semua Seksi": "All Sections",
  "Cari tugas, PIC, catatan…": "Search tasks, PIC, notes…",
  "Cari himpunan, kampus, PIC…": "Search association, campus, PIC…",
  "Cari tautan…": "Search links…",
  "Cari nama / NRP…": "Search name / NRP…",
  // Table headers
  "Tugas": "Task",
  "PIC": "PIC",
  "Deadline": "Deadline",
  "Status": "Status",
  "Hasil": "Result",
  "Himpunan": "Association",
  "Kampus": "Campus",
  "Kontak": "Contact",
  "Tahap": "Stage",
  "Batch": "Batch",
  "Catatan": "Notes",
  "Job Description": "Job Description",
  "No": "No",
  // Counts / misc
  "tugas": "tasks",
  "prospek": "prospects",
  "Total Prospek": "Total Prospects",
  "Diterima": "Accepted",
  "Menunggu": "Waiting",
  "Ditolak": "Rejected",
  // Page headers
  "Work Breakdown Structure": "Work Breakdown Structure",
  "Seluruh tugas Ormawa Visit dalam satu sumber kebenaran. Ubah tampilan antara tabel, kanban, dan timeline.":
    "All Ormawa Visit tasks in one source of truth. Switch between table, kanban, and timeline.",
  "Tugas per divisi, otomatis tersinkron dengan Work Breakdown (tanpa duplikasi & tanpa delay).":
    "Tasks per division, auto-synced with the Work Breakdown (no duplication, no delay).",
  "Data & alur himpunan yang dihubungi, dari reach pertama sampai konfirmasi.":
    "Data & pipeline of associations, from first reach to confirmation.",
  "Rencana Anggaran Biaya": "Budget Plan",
  "Deadline tugas & hari pelaksanaan dalam satu tampilan. Klik tanggal untuk detail atau menambah tugas.":
    "Task deadlines & the event day in one view. Click a date for details or to add a task.",
  "Rundown Acara (Juklak-Juknis)": "Event Rundown",
  "Susunan acara hari-H beserta pengisi, MC, kebutuhan operator, dan job per divisi.":
    "Run-of-show with hosts, MC, operator needs, and per-division duties.",
  "Pembagian Tugas Hari-H": "D-Day Task Assignment",
  "Pembagian tugas panitia saat hari pelaksanaan Ormawa Visit.":
    "Committee task assignment for the Ormawa Visit event day.",
  "Anggota & Struktur Tim": "Members & Team Structure",
  "Daftar fungsionaris & intern External Affairs, serta pembagian tim per divisi.":
    "Directory of External Affairs staff & interns, and team structure per division.",
  "Daftar Ormawa Visit": "Ormawa Visit List",
  // Empty states
  "Tidak ada tugas": "No tasks",
  "Tidak ada prospek": "No prospects",
  "Tidak ada tautan": "No links",
  "Belum ada rundown": "No rundown yet",
  "Belum ada pembagian tugas": "No assignments yet",

  // Pipeline stages
  "Belum dihubungi": "Not contacted",
  "Dalam proses": "In progress",
  "Menunggu jawaban": "Awaiting reply",

  // Prospects view
  "Sesuaikan filter atau tambah prospek baru.": "Adjust the filters or add a new prospect.",

  // Members view / form
  "Anggota EA": "EA Members",
  "Struktur Tim": "Team Structure",
  "Semua": "All",
  "Fungsionaris": "Functionaries",
  "Nama": "Name",
  "Tipe": "Type",
  "Angkatan": "Cohort",
  "Fungsio": "Func",
  "Tidak ditemukan": "Not found",
  "Tidak ada anggota yang cocok.": "No matching members.",
  "Struktur tim untuk": "Team structure for",
  "Belum ada struktur tim": "No team structure yet",
  "Struktur tim untuk Ormawa Visit ini belum diisi.": "The team structure for this Ormawa Visit hasn't been filled in yet.",
  "ditambahkan - lanjut menambahkan anggota lain": "added - keep adding more members",
  "Anggota diperbarui": "Member updated",
  "Dialog tetap terbuka setelah menambah, cocok untuk mengisi banyak anggota sekaligus.": "The dialog stays open after adding - handy for entering many members at once.",
  "Anggota External Affairs (fungsionaris atau intern).": "External Affairs members (functionaries or interns).",
  "Nama lengkap": "Full name",
  "Nama panggilan": "Nickname",
  "Angkatan (tahun)": "Cohort (year)",
  "Otomatis dari NRP": "Auto from NRP",
  "Isi manual jika NRP kosong": "Enter manually if NRP is empty",
  "Anggota dihapus": "Member deleted",
  "Pilih anggota…": "Select members…",
  "Belum ada anggota untuk Ormawa Visit ini.": "No members for this Ormawa Visit yet.",
  "Tim ditambahkan": "Team added",
  "Tim diperbarui": "Team updated",
  "Tambah Tim Divisi": "Add Division Team",
  "Edit Tim Divisi": "Edit Division Team",
  "Susunan anggota per divisi untuk Ormawa Visit ini.": "Member roster per division for this Ormawa Visit.",
  "Pilih fungsionaris…": "Select functionaries…",
  "Pilih intern…": "Select interns…",
  "Tim dihapus": "Team deleted",

  // Task detail dialog
  "Tautan": "Link",
  "hasil": "result",
  "Nomor": "Number",
  "Mulai": "Start",
  "Important Notes": "Important Notes",
  "Result / Hasil": "Result",

  // Kanban
  "Kamu tidak punya akses mengubah status tugas ini.": "You don't have access to change this task's status.",
  "Geser": "Drag",

  // Calendar - months
  "Januari": "January", "Februari": "February", "Maret": "March", "April": "April",
  "Mei": "May", "Juni": "June", "Juli": "July", "Agustus": "August",
  "September": "September", "Oktober": "October", "November": "November", "Desember": "December",
  // Calendar - days
  "Min": "Sun", "Sen": "Mon", "Sel": "Tue", "Rab": "Wed", "Kam": "Thu", "Jum": "Fri", "Sab": "Sat",
  // Calendar - misc
  "Hari ini": "Today",
  "lagi": "more",
  "Hari pelaksanaan": "Event day",
  "Tidak ada deadline": "No deadline",
  "Belum ada tugas dengan deadline di hari ini.": "No tasks are due on this day.",
  "Tambah tugas di tanggal ini": "Add a task on this date",

  // Timeline - month abbreviations
  "Jan": "Jan", "Feb": "Feb", "Mar": "Mar", "Apr": "Apr", "Jun": "Jun",
  "Jul": "Jul", "Ags": "Aug", "Sep": "Sep", "Okt": "Oct", "Nov": "Nov", "Des": "Dec",
  "Belum ada tugas berjadwal": "No scheduled tasks yet",
  "Tambahkan tanggal mulai/deadline pada tugas untuk melihat timeline.": "Add start/deadline dates to tasks to see the timeline.",
  "Tanpa tanggal": "No dates",

  // Rundown
  "Versi": "Version",
  "Kebutuhan OPR": "OPR needs",
  "Rundown acara belum tersedia untuk Ormawa Visit ini.": "The event rundown isn't available for this Ormawa Visit yet.",
  "Konsumsi": "Consumption",
  "Agenda ditambahkan": "Agenda item added",
  "Agenda diperbarui": "Agenda item updated",
  "Tambah Agenda Rundown": "Add Rundown Item",
  "Edit Agenda Rundown": "Edit Rundown Item",
  "Satu baris susunan acara (Juklak-Juknis).": "A single run-of-show row (Juklak-Juknis).",
  "Jam mulai": "Start time",
  "Jam selesai": "End time",
  "Durasi": "Duration",
  "Kegiatan": "Activity",
  "Registrasi peserta": "Participant registration",
  "Pengisi acara": "Host / performer",
  "Keterangan": "Notes",
  "Link kebutuhan Operator": "Operator needs link",
  "Job LO": "Job LO",
  "Job Event": "Job Event",
  "Job Konsumsi": "Job Consumption",
  "Job Creative": "Job Creative",
  "Job Operational": "Job Operational",
  "Agenda dihapus": "Agenda item deleted",

  // FAQ
  "Pertanyaan yang sering diajukan seputar Ormawa Visit - External Affairs HMSI ITS.": "Frequently asked questions about Ormawa Visit - External Affairs HMSI ITS.",
  "Masih ada pertanyaan?": "Still have questions?",
  "Tanyakan ke PIC Ormawa Visit atau fungsionaris yang menemani tugasmu, jangan malu bertanya ya :)": "Ask the Ormawa Visit PIC or the functionary supervising your task - don't be shy to ask :)",

  // Settings
  "Konfigurasi sistem, hak akses peran, backup, dan informasi Ormawa Visit Management System.": "System configuration, role permissions, backups, and Ormawa Visit Management System info.",
  "Website ini masih dalam pengembangan": "This website is still under development",
  "Kalau menemukan bug, error, atau punya keluhan/masukan, langsung hubungi lewat WhatsApp.": "If you find a bug or error, or have complaints/feedback, reach out directly via WhatsApp.",
  "Hubungi via WhatsApp": "Contact via WhatsApp",
  "Akun Saya": "My Account",
  "Mode tamu": "Guest mode",
  "Status Backend": "Backend Status",
  "Sumber data": "Data source",
  "Supabase (cloud) - akun & real-time aktif": "Supabase (cloud) - accounts & real-time active",
  "Mode demo lokal - data tersimpan di .data/db.json": "Local demo mode - data stored in .data/db.json",
  "Demo Lokal": "Local Demo",
  "Backup & Rollback": "Backup & Rollback",
  "Backup hanya tersedia saat sistem terhubung ke Supabase (mode cloud).": "Backups are only available when the system is connected to Supabase (cloud mode).",
  "Gagal memuat backup.": "Failed to load backups.",
  "Hak Akses per Peran": "Access by Role",
  "Akses penuh (kelola)": "Full access (manage)",
  "Hanya lihat": "View only",
  "Tidak ada akses": "No access",
  "Modul": "Module",

  // Demo mode (separate database)
  "Coba Mode Demo (database terpisah)": "Try Demo Mode (separate database)",
  "Mode Demo - database terpisah, aman untuk coba-coba. Perubahan tidak memengaruhi data asli.": "Demo Mode - separate database, safe to experiment. Changes don't affect real data.",

  // Divisions
  "maks. 4 huruf": "max 4 letters",
  "Divisi tidak diikutsertakan pada rundown": "Exclude this division from the rundown",
  "tanpa rundown": "no rundown",
  "Belum ada divisi.": "No divisions yet.",

  // Rundown table
  "Waktu": "Time",
  "Kebutuhan Operator": "Operator needs",
  "Catatan…": "Note…",
  "Catatan cepat": "Quick note",
  "Catatan cepat evaluasi": "Quick evaluation note",
  "Menit": "Minutes",
  "menit": "min",
  "Terlalu cepat": "Too fast",
  "Terlalu lama": "Too slow",
  "Tambah baris": "Add row",
  "Otomatis dari waktu": "Auto from time",
  "Menyimpan…": "Saving…",
  "Belum ada baris rundown untuk versi ini.": "No rundown rows for this version yet.",
  "Susunan acara hari-H: tiap divisi menjadi kolom, isi kegiatannya langsung di tabel.": "Event-day schedule: each division is a column - fill its activity in the table.",

  // FAQ CRUD
  "FAQ ditambahkan": "FAQ added",
  "FAQ diperbarui": "FAQ updated",
  "FAQ dihapus": "FAQ deleted",
  "Tambah FAQ": "Add FAQ",
  "Edit FAQ": "Edit FAQ",
  "Pertanyaan yang sering diajukan seputar Ormawa Visit.": "Frequently asked questions about Ormawa Visit.",
  "Apa itu Ormawa Visit?": "What is Ormawa Visit?",
  "Pertanyaan": "Question",
  "Jawaban": "Answer",
  "Belum ada FAQ": "No FAQ yet",
  "Pertanyaan yang sering diajukan akan tampil di sini.": "Frequently asked questions will appear here.",

  // Panduan (guide)
  "Panduan": "Guide",
  "Panduan Penggunaan": "User Guide",
  "Alur penggunaan Ormawa Visit Management System dari awal sampai akhir.": "How to use Ormawa Visit Management System from start to finish.",
  "Alur Singkat": "Quick Flow",
  "Panduan Lengkap per Fitur": "Full Guide by Feature",
  "Penjelasan rinci tiap menu: untuk apa, cara memakainya, hal yang perlu diperhatikan, dan siapa yang bisa mengaksesnya.":
    "A detailed walkthrough of every menu: what it's for, how to use it, what to watch out for, and who can access it.",
  // Divisi & Anggota (merged menu)
  "Divisi & Anggota": "Divisions & Members",
  "Divisi, anggota, & struktur tim tiap Ormawa Visit": "Divisions, members & team structure per Ormawa Visit",
  "Divisi, daftar fungsionaris & intern, serta pembagian tim tiap divisi Ormawa Visit ini.":
    "Divisions, the staff & intern roster, and each division's team for this Ormawa Visit.",
  "Isi tim": "Fill team",
  "Belum diisi.": "Not filled in yet.",
  "atasan divisi": "division lead",
  // Task result links
  "Hasil - deskripsi": "Result - description",
  "Ringkas apa yang sudah dikerjakan / hasilnya": "Summarise what was done / the outcome",
  "Tautan hasil": "Result links",
  "Tambah tautan": "Add link",
  "Hapus tautan": "Remove link",
  "Tampilkan juga di Super Link": "Also show in Super Link",
  "Nama tautan di Super Link (mis. Proposal OV)": "Link name in Super Link (e.g. OV Proposal)",
  "Kosongkan untuk memakai judul tugas. Mengubah/menghapus tautan ini juga memperbarui Super Link.":
    "Leave blank to use the task title. Editing/removing this link also updates Super Link.",
  "Belum ada tautan. Klik “Tambah tautan” untuk melampirkan Drive/Docs/Foto.":
    "No links yet. Click “Add link” to attach a Drive/Docs/photo link.",
  "Ada tautan yang sama lebih dari sekali.": "The same link appears more than once.",
  "Ada tautan hasil yang sama lebih dari sekali.": "The same result link appears more than once.",
  "Ada tautan hasil yang tidak valid (harus diawali http:// atau https://).":
    "One of the result links is invalid (it must start with http:// or https://).",
  "Simpan & Selesai": "Save & Done",
  "Tugas disimpan & ditandai selesai": "Task saved & marked done",
  // Duplicate
  "Duplikat": "Duplicate",
  "Tugas diduplikat": "Task duplicated",
  "Item diduplikat": "Item duplicated",
  "Agenda diduplikat": "Agenda row duplicated",
  "Ormawa Visit diduplikat": "Ormawa Visit duplicated",
  // Misc new
  "Seret ikon untuk mengurutkan; nomor tersusun otomatis.": "Drag the handle to reorder; numbering updates automatically.",
  "Lihat Ormawa Visit ini": "View this Ormawa Visit",
  "Ormawa Visit aktif diganti": "Active Ormawa Visit changed",
  "Reset ke data awal": "Reset to initial data",
  "Data Mode Demo": "Demo Mode Data",
  // Reach & Offer primary
  "Jadikan data utama": "Set as primary",
  "Lepas data utama": "Remove as primary",
  "Data utama Ormawa Visit": "Ormawa Visit primary data",
  "Dijadikan data utama Ormawa Visit": "Set as the Ormawa Visit's primary data",
  "Data utama dilepas": "Primary data cleared",
  "Pilih anggota EA": "Choose an EA member",
  // Rundown
  "Buka tautan": "Open link",
  "Belum ada baris rundown.": "No rundown rows yet.",

  // Member picker (PIC)
  "dipilih": "selected",
  "Pilih dari anggota (opsional)": "Pick from members (optional)",
  "Pilih dari anggota": "Pick from members",

  // Event template (clone)
  "Salin data dari Ormawa Visit lain (template)": "Copy data from another Ormawa Visit (template)",
  "Hemat waktu - data disalin sebagai kerangka awal (status, PIC, dan tanggal dikosongkan). Bisa diedit setelahnya.": "Save time - data is copied as a starting skeleton (status, PIC, and dates are cleared). Editable afterwards.",
  "Tidak menyalin (kosong)": "Don't copy (empty)",
  "Tugas (WBS)": "Tasks (WBS)",
  "Job Hari-H": "D-Day jobs",
  "Anggaran (RAB)": "Budget (RAB)",

  // Member bulk actions
  "Pilih": "Select",
  "Ubah Divisi": "Change division",
  "Ubah Tipe": "Change type",
  "Divisi anggota diperbarui": "Members' division updated",
  "Tipe anggota diperbarui": "Members' type updated",
  "Hapus anggota terpilih?": "Delete selected members?",
  "anggota akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.": "members will be permanently deleted. This action cannot be undone.",
  "Tentang": "About",
  "Sistem manajemen program kerja Ormawa Visit - Departemen External Affairs HMSI ITS.": "Ormawa Visit work-program management system - External Affairs Department, HMSI ITS.",
  "Ada pertanyaan atau masukan? Hubungi": "Questions or feedback? Contact",

  // Task form dialog
  "Tugas ditambahkan": "Task added",
  "Tugas diperbarui": "Task updated",
  "Edit Tugas": "Edit Task",
  "Kamu dapat memperbarui Status & Hasil tugas ini.": "You can update this task's Status & Result.",
  "Lengkapi detail tugas pada Work Breakdown Structure.": "Fill in the task details on the Work Breakdown Structure.",
  "Judul tugas / Job Description": "Task title / Job Description",
  "Contoh: Pembuatan Rundown Ormawa Visit": "e.g. Creating the Ormawa Visit rundown",
  "PIC / Penanggung Jawab": "PIC / Person in charge",
  "Nama, bisa lebih dari satu (opsional)": "Name, can be more than one (optional)",
  "Catatan penting, konteks, atau evaluasi dari OV sebelumnya": "Important notes, context, or evaluation from a previous OV",
  "Result / Hasil (tempel link, sangat disarankan)": "Result (paste a link, strongly recommended)",
  "Tempel link Google Drive/Docs/Foto, bisa lebih dari satu": "Paste a Google Drive/Docs/photo link, can be more than one",
  "Simpan Perubahan": "Save Changes",

  // Budget
  "Rencana anggaran ditambahkan": "Budget plan added",
  "Tambah Rencana": "Add Plan",
  "Tambah Rencana Anggaran": "Add Budget Plan",
  "Buat skenario RAB baru (mis. \"RAB Maksimal\", \"RAB Fix\").": "Create a new budget scenario (e.g. \"Max Budget\", \"Fixed Budget\").",
  "Nama rencana": "Plan name",
  "Item ditambahkan": "Item added",
  "Tambah Item": "Add Item",
  "Tambah Item Anggaran": "Add Budget Item",
  "Kategori": "Category",
  "Nama item": "Item name",
  "Qty": "Qty",
  "Satuan": "Unit",
  "Harga satuan": "Unit price",
  "Hapus rencana anggaran?": "Delete budget plan?",
  "beserta seluruh itemnya akan dihapus permanen.": "and all its items will be permanently deleted.",
  "Rencana anggaran dihapus": "Budget plan deleted",
  "Hapus item?": "Delete item?",
  "akan dihapus dari rencana anggaran ini.": "will be removed from this budget plan.",
  "Item dihapus": "Item deleted",
  "Maksimal": "Maximum",
  "Minimal": "Minimum",
  "item": "items",
  "kategori": "categories",
  "Total": "Total",
  "Item": "Item",
  "Harga": "Price",
  "Subtotal": "Subtotal",
  "Total Pengeluaran": "Total Expenses",

  // Links
  "URL wajib diisi dan berupa tautan yang valid (diawali https://).": "URL is required and must be a valid link (starting with https://).",
  "Tautan ditambahkan": "Link added",
  "Tautan diperbarui": "Link updated",
  "Tambah Tautan": "Add Link",
  "Edit Tautan": "Edit Link",
  "Dokumen, form, atau drive penting Ormawa Visit.": "Important Ormawa Visit documents, forms, or drives.",
  "URL / Tautan": "URL / Link",
  "Harus berupa tautan (diawali http:// atau https://).": "Must be a link (starting with http:// or https://).",
  "Umum (tanpa divisi)": "General (no division)",
  "Catatan (opsional)": "Notes (optional)",
  "Hapus tautan?": "Delete link?",
  "akan dihapus.": "will be deleted.",
  "Tautan dihapus": "Link deleted",
  "Semua Ormawa Visit": "All Ormawa Visit",
  "Tanpa Ormawa Visit": "No Ormawa Visit",
  "Umum": "General",
  "tautan": "links",
  "Buka": "Open",

  // Prospect form dialog
  "Prospek ditambahkan": "Prospect added",
  "Prospek diperbarui": "Prospect updated",
  "Tambah Prospek": "Add Prospect",
  "Edit Prospek": "Edit Prospect",
  "Data himpunan target kunjungan Ormawa Visit.": "Data of associations targeted for an Ormawa Visit.",
  "Nama Ormawa / Himpunan": "Organization / Association name",
  "Asal Kampus": "Campus",
  "No. WA / IG / email": "WA no. / IG / email",
  "PIC (dari kita)": "PIC (from us)",
  "Nama PIC": "PIC name",
  "Batch / Kampanye": "Batch / Campaign",
  "Lokasi / Mode": "Location / Mode",
  "Offline / Online": "Offline / Online",
  "Status Hubungi": "Contact status",
  "Respons Mereka": "Their response",
  "Respons Kita": "Our response",
  "Tandai selesai / terkonfirmasi": "Mark as done / confirmed",

  // Event form dialog
  "Ormawa Visit ditambahkan": "Ormawa Visit added",
  "Ormawa Visit diperbarui": "Ormawa Visit updated",
  "Buat gelaran Ormawa Visit baru beserta rencana tanggalnya.": "Create a new Ormawa Visit along with its planned dates.",
  "Nama Ormawa Visit": "Ormawa Visit name",
  "Kode (opsional)": "Code (optional)",
  "Himpunan / Partner": "Association / Partner",
  "Kabinet": "Cabinet",
  "Lokasi": "Location",
  "Mode": "Mode",
  "Internal ITS": "Internal ITS",
  "Eksternal": "External",
  "Rentang tanggal perencanaan": "Planning date range",
  "Mulai rencana": "Plan start",
  "Akhir rencana": "Plan end",
  "Rencana tanggal pelaksanaan": "Planned event date",

  // Jobs (D-Day)
  "Tambah Tugas Hari-H": "Add D-Day Task",
  "Edit Tugas Hari-H": "Edit D-Day Task",
  "Pembagian tugas panitia saat hari pelaksanaan.": "Committee task assignment for the event day.",
  "Deskripsi tugas": "Task description",
  "PIC (pisahkan koma)": "PIC (comma-separated)",
  "Tambahkan pembagian tugas hari-H untuk Ormawa Visit ini.": "Add D-Day task assignments for this Ormawa Visit.",
  "Tugas dihapus": "Task deleted",

  // Division manage
  "Divisi ditambahkan": "Division added",
  "Divisi diperbarui": "Division updated",
  "Divisi bisa berbeda tiap Ormawa Visit.": "Divisions can differ per Ormawa Visit.",
  "Nama divisi": "Division name",
  "Singkatan": "Abbreviation",
  "Kode unik (opsional)": "Unique code (optional)",
  "Warna": "Color",
  "Versi lebih muda": "Lighter version",
  "Divisi dihapus": "Division deleted",

  // Task actions
  "Hapus tugas?": "Delete task?",
  "akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.": "will be permanently deleted. This action cannot be undone.",

  // Prospect / event actions
  "Hapus prospek?": "Delete prospect?",
  "akan dihapus permanen.": "will be permanently deleted.",
  "Hapus Ormawa Visit?": "Delete Ormawa Visit?",
  "beserta seluruh tugas, rundown, dan datanya akan dihapus permanen.": "along with all its tasks, rundown, and data will be permanently deleted.",
  "Ormawa Visit dihapus": "Ormawa Visit deleted",

  // Task table extras
  "tugas dihapus": "tasks deleted",
  "Lihat hasil": "View result",
  "+ link hasil (Drive/Docs)": "+ result link (Drive/Docs)",
  "Pilih semua": "Select all",
  "Pilih tugas": "Select task",

  // Backup panel
  "Backup berhasil dibuat": "Backup created successfully",
  "Backup otomatis berjalan tiap 3 hari (perlu": "Automatic backups run every 3 days (requires",
  "dikonfigurasi di Vercel).": "configured in Vercel).",
  "Backup Sekarang": "Backup Now",
  "Klik “Backup Sekarang” untuk membuat backup pertama.": "Click “Backup Now” to create the first backup.",
  "Backup diunduh": "Backup downloaded",
  "Manual": "Manual",
  "Otomatis": "Automatic",
  "Pra-Pemulihan": "Pre-Restore",
  "Unduh JSON": "Download JSON",
  "Pulihkan (rollback)": "Restore (rollback)",
  "Hapus backup": "Delete backup",
  "Pulihkan data ke titik ini?": "Restore data to this point?",
  "Seluruh data saat ini (tugas, anggaran, anggota, dll) akan diganti total dengan isi backup": "All current data (tasks, budget, members, etc.) will be fully replaced with the contents of the backup",
  "Backup pengaman otomatis dibuat lebih dulu, dan pemulihan berjalan sekaligus: kalau ada yang gagal di tengah, tidak ada satu pun data yang berubah.": "A safety backup is taken first, and the restore runs as one step: if anything fails partway, nothing changes at all.",
  "Ketik PULIHKAN untuk konfirmasi": "Type PULIHKAN to confirm",
  "Data dipulihkan": "Data restored",
  "Pulihkan Sekarang": "Restore Now",
  "Hapus backup ini?": "Delete this backup?",
  "Backup": "Backup",
  "Backup dihapus": "Backup deleted",

  // Dashboard
  "Halo,": "Hi,",
  "Ringkasan progres untuk": "Progress overview for",
  "Buka Work Breakdown": "Open Work Breakdown",
  "Total Tugas": "Total Tasks",
  "divisi aktif": "active divisions",
  "Progress": "Progress",
  "dari": "of",
  "Perlu Perhatian": "Needs Attention",
  "Anggaran Edisi": "Edition Budget",
  "Total rencana pengeluaran": "Total planned expenses",
  "Progres Keseluruhan": "Overall Progress",
  "Belum ada tugas.": "No tasks yet.",
  "Reach & Offer Himpunan": "Association Reach & Offer",
  "Lihat semua": "View all",
  "himpunan direach": "associations reached",
  "diterima": "accepted",
  "Progres per Divisi": "Progress per Division",
  "Belum ada data divisi.": "No division data yet.",
  "Deadline Terdekat": "Upcoming Deadlines",
  "Tidak ada deadline aktif": "No active deadlines",
  "Semua tugas ber-deadline sudah selesai untuk Ormawa Visit ini.": "All tasks with deadlines are done for this Ormawa Visit.",
  "Ringkasan Ormawa Visit": "Ormawa Visit Summary",
  "Belum ditentukan": "Not set yet",
  "orang": "people",
  "Akses Cepat": "Quick Access",
  "Kelola tugas": "Manage tasks",
  "Per divisi": "Per division",
  "Pipeline himpunan": "Association pipeline",
  "Susunan acara": "Run-of-show",

  // Events page
  "Riwayat & rencana semua Ormawa Visit lintas kabinet. Ganti yang aktif dari pemilih di kanan atas.": "History & plans of all Ormawa Visit across cabinets. Switch the active one from the picker at the top right.",
  "Tanggal": "Date",
  "Partner": "Partner",
  "selesai": "done",

  // Budget page
  "Itemisasi anggaran per skenario (maksimal/minimal), lengkap dengan kategori & subtotal. Angka bisa diedit langsung.": "Budget itemization per scenario (maximum/minimum), complete with categories & subtotals. Figures are editable inline.",
  "Total Rencana Anggaran": "Total Budget Plan",
  "Skenario / Plan": "Scenarios / Plans",
  "Total Item": "Total Items",
  "Belum ada anggaran": "No budget yet",
  "Belum ada rencana anggaran untuk": "No budget plan yet for",

  // Links page
  "Kumpulan dokumen, form, dan drive penting Ormawa Visit, dikelompokkan per Ormawa Visit & divisi.": "A collection of important Ormawa Visit documents, forms, and drives, grouped per Ormawa Visit & division.",

  // Login page
  "Kata sandi": "Password",
  "atau": "or",
  "Masuk sebagai Tamu (hanya lihat)": "Sign in as Guest (view only)",
  "Belum punya akun? Hubungi PIC Ormawa Visit untuk dibuatkan.": "Don't have an account? Contact the Ormawa Visit PIC to have one created.",

  // Divisions page
  "Semua divisi": "All divisions",
  "Tugas divisi ini, tersinkron dengan Work Breakdown Structure.": "This division's tasks, synced with the Work Breakdown Structure.",
  "Setiap Divisi yang ada di Ormawa Visit": "Every division in Ormawa Visit",
  "Belum ada tugas untuk Ormawa Visit ini.": "No tasks for this Ormawa Visit yet.",
  "Buka papan": "Open board",

  // Legal pages
  "Kebijakan Privasi": "Privacy Policy",
  "Ketentuan Layanan": "Terms of Service",
  "Dengan mendaftar, kamu menyetujui": "By signing up, you agree to the",
  "dan": "and",

  // Layout a11y
  "Tutup menu": "Close menu",
  "Buka menu samping": "Expand sidebar",
  "Tutup menu samping": "Collapse sidebar",

  // Access levels (settings matrix)
  "Akses terbatas": "Limited access",
  "Akses terbatas: bisa membuat, mengubah, dan mengisi hasil - tapi tidak bisa menghapus.":
    "Limited access: can create, edit, and fill in results - but cannot delete.",
  "Kelola Work Breakdown, Rundown, Hari-H & Super Link; menu lain hanya lihat":
    "Manages Work Breakdown, Rundown, D-Day & Super Link; view-only elsewhere",
  "Buat, ubah & isi hasil di Work Breakdown, Rundown, Hari-H, Super Link (tanpa hapus)":
    "Create, edit & fill in results on Work Breakdown, Rundown, D-Day, Super Link (no deleting)",

  // Sign up / Google auth
  "Daftar": "Sign up",
  "Ulangi kata sandi": "Repeat password",
  "Minimal 8 karakter.": "At least 8 characters.",
  "Kata sandi minimal 8 karakter.": "Password must be at least 8 characters.",
  "Konfirmasi kata sandi tidak cocok.": "Password confirmation doesn't match.",
  "Sudah punya akun?": "Already have an account?",
  "Belum punya akun?": "No account yet?",
  "Cek email kamu": "Check your email",
  "Kami mengirim tautan konfirmasi ke": "We sent a confirmation link to",
  "Buka tautan itu untuk mengaktifkan akun.": "Open that link to activate your account.",
  "Kembali ke halaman masuk": "Back to sign in",
  "Lanjut dengan Google": "Continue with Google",
  "Masuk dengan Google": "Sign in with Google",
  "Daftar dengan Google": "Sign up with Google",
  "Kode otorisasi tidak ditemukan.": "Authorization code not found.",
  "Akun baru belum punya peran - kamu bisa melihat data, lalu ajukan peran (Koordinator / Staff / Intern) lewat menu akun untuk disetujui admin.":
    "A new account has no role - you can view data, then request a role (Coordinator / Staff / Intern) from the account menu for an admin to approve.",

  // Role requests
  "Role Request": "Role Request",
  "Permintaan peran dari akun yang baru mendaftar": "Role requests from newly registered accounts",
  "Akun yang baru mendaftar belum punya peran. Setujui atau abaikan permintaan peran di sini.":
    "Newly registered accounts have no role. Approve or ignore their role requests here.",
  "Belum ada permintaan peran": "No role requests yet",
  "Permintaan dari akun yang baru mendaftar akan muncul di sini.":
    "Requests from newly registered accounts will appear here.",
  "Ajukan Peran": "Request Role",
  "Ajukan Ubah Peran": "Request a Role Change",
  "Ubah Pengajuan Peran": "Edit Role Request",
  "Ubah pengajuan": "Edit request",
  "Peran yang diminta": "Requested role",
  "Catatan untuk admin": "Note for the admin",
  "Contoh: staff divisi Event": "e.g. staff of the Event division",
  "Kirim permintaan": "Send request",
  "Pilih peran yang kamu inginkan - admin akan menyetujui atau mengabaikannya. Peran berlaku untuk semua Ormawa Visit.":
    "Pick the role you want - an admin will approve or ignore it. A role applies across every Ormawa Visit.",
  "Pengajuanmu belum diputuskan admin, jadi masih bisa diperbaiki.":
    "An admin hasn't decided on your request yet, so you can still correct it.",
  "Pengajuan peran diperbarui.": "Role request updated.",
  "Permintaan peran terkirim. Tunggu persetujuan admin.":
    "Role request sent. Wait for an admin to approve it.",
  "Menunggu keputusan": "Awaiting a decision",
  "Tidak ada permintaan yang menunggu.": "No requests are waiting.",
  "Riwayat": "History",
  "Disetujui": "Approved",
  "Diabaikan": "Ignored",
  "Setujui": "Approve",
  "Abaikan": "Ignore",
  "Diajukan": "Submitted",
  "sekarang berperan sebagai": "is now a",
  "Permintaan diabaikan": "Request ignored",
  "Akunmu belum punya peran, jadi masih hanya bisa melihat.":
    "Your account has no role yet, so you can only view.",
  "Permintaan peran": "Role request",
  "sedang menunggu persetujuan admin.": "is awaiting an admin's approval.",

  // Divisions & members (multi-division roster, derived team structure)
  "anggota": "members",
  "boleh lebih dari satu": "more than one is allowed",
  "divisi dipilih": "divisions selected",
  "Pilih divisi…": "Pick divisions…",
  "Belum ada divisi untuk Ormawa Visit ini.": "This Ormawa Visit has no divisions yet.",
  "Divisi pertama dipakai sebagai divisi utama pada tabel & tugas.":
    "The first division is used as the primary one in tables & tasks.",
  "Tunjuk koordinator": "Assign coordinator",
  "Ubah koordinator": "Change coordinator",
  "Hapus koordinator": "Remove coordinator",
  "Koordinator disimpan": "Coordinator saved",
  "Koordinator dihapus": "Coordinator removed",
  "Koordinator Divisi": "Division Coordinator",
  "Anggota divisi terisi otomatis dari data Anggota EA. Di sini kamu hanya menunjuk koordinatornya.":
    "A division's members come automatically from the EA Members list. All you set here is who coordinates it.",
  "hanya fungsionaris, boleh dikosongkan": "staff only; may be left empty",
  "Belum ada fungsionaris di divisi ini - tambahkan lewat tab Anggota EA dulu.":
    "This division has no staff yet - add them in the EA Members tab first.",
  "Anggota divisi ini": "Members of this division",
  "Belum ada. Tetapkan divisi anggota di tab Anggota EA.":
    "None yet. Assign members to this division in the EA Members tab.",
  "Belum ada anggota. Tetapkan divisi anggota di tab Anggota EA.":
    "No members yet. Assign members to this division in the EA Members tab.",

  // Budget category colour
  "Warna kategori": "Category colour",
  "Ubah warna kategori": "Change category colour",
  "Warna kategori diperbarui": "Category colour updated",
  "Warna berlaku untuk seluruh item pada kategori ini.":
    "The colour applies to every item in this category.",

  // Role Request in demo mode
  "Kenapa Role Request tidak berfungsi di Mode Demo?":
    "Why doesn't Role Request work in Demo Mode?",
  "Mode Demo memakai database terpisah berisi data contoh, bukan data asli - jadi tidak ada akun sungguhan di dalamnya.":
    "Demo Mode runs on a separate database of sample data, not the real one - so there are no real accounts in it.",
  "Di Mode Demo kamu tidak login: identitas diambil dari tombol peran di kanan atas, bukan dari akun. Karena itu tidak ada akun yang bisa mengajukan peran, dan tidak ada peran yang bisa disimpan.":
    "In Demo Mode you are not logged in: your identity comes from the role button at the top right, not from an account. So there is no account to file a request, and no role to save.",
  "Menyetujui pengajuan berarti mengubah peran sebuah akun. Tanpa akun, tidak ada yang bisa diubah.":
    "Approving a request means changing an account's role. With no accounts, there is nothing to change.",
  "Untuk mencoba fiturnya secara utuh, keluar dari Mode Demo lalu daftar akun di sistem yang sebenarnya. Di sini kamu tetap bisa melihat tampilan halamannya.":
    "To try the feature for real, leave Demo Mode and sign up on the actual system. You can still see how the page looks from here.",
  "Mode Demo tidak punya akun, jadi daftar ini selalu kosong.":
    "Demo Mode has no accounts, so this list is always empty.",

  // Error boundary
  "Terjadi kesalahan": "Something went wrong",
  "Halaman ini gagal dimuat. Coba muat ulang, atau kembali ke dashboard.":
    "This page failed to load. Try reloading, or go back to the dashboard.",
  "Kode": "Code",
  "Coba lagi": "Try again",
  "Ke Dashboard": "Back to Dashboard",
  // Archive lock (v1.20.0)
  "Arsip": "Archive",
  "Kunci arsip": "Lock archive",
  "Kunci sebagai arsip": "Lock as archive",
  "Buka kunci arsip": "Unlock archive",
  "Ormawa Visit diarsipkan": "Ormawa Visit archived",
  "Kunci Ormawa Visit ini sebagai arsip?": "Lock this Ormawa Visit as an archive?",
  "Diarsipkan - hanya admin yang bisa mengubah isinya.":
    "Archived - only an admin can change its contents.",
  "Arsip dibuka - semua peran bisa mengubah lagi.":
    "Archive unlocked - every role can make changes again.",
  "akan jadi hanya-baca. Koordinator, Staff, dan Intern tidak bisa lagi mengubah tugas, rundown, Hari-H, atau tautannya. Hanya admin yang bisa mengubah isinya dan membuka kuncinya kembali.":
    "will become read-only. Coordinators, Staff, and Interns can no longer change its tasks, rundown, event-day jobs, or links. Only an admin can edit it and unlock it again.",
  "Ormawa Visit ini sudah diarsipkan. Minta admin membuka kuncinya dulu.":
    "This Ormawa Visit is archived. Ask an admin to unlock it first.",
  "Hanya admin yang bisa mengunci atau membuka arsip.":
    "Only an admin can lock or unlock the archive.",
  // Global search (v1.20.0)
  "Cari": "Search",
  "Cari apa saja…": "Search anything…",
  "Pencarian global": "Global search",
  "Cari tugas, anggota, divisi, anggaran, tautan…":
    "Search tasks, members, divisions, budget, links…",
  "Ketik minimal 2 huruf untuk mencari.": "Type at least 2 characters to search.",
  "Tidak ada hasil untuk": "No results for",
  "pilih": "select",
  "buka": "open",
  "Hasil mengikuti Ormawa Visit yang aktif": "Results follow the active Ormawa Visit",
  // Timeline (v1.20.0) - "Hari ini" is already defined above.
  "hari": "days",
  // Backup (v1.20.0)
  "Backup dibuat manual - klik tombol di kanan sebelum melakukan perubahan besar. Setiap backup bisa diunduh sebagai JSON atau dipulihkan kembali.":
    "Backups are manual - use the button on the right before any big change. Each backup can be downloaded as JSON or restored.",
  "Otomatis (lama)": "Automatic (legacy)",
  // Search palette + archive banner (v1.21.0)
  "Tutup pencarian": "Close search",
  "Pencarian terakhir": "Recent searches",
  "Bersihkan": "Clear",
  "Ormawa Visit ini diarsipkan - hanya kamu (admin) yang masih bisa mengubah isinya. Buka kunci dari menu Daftar Ormawa Visit.":
    "This Ormawa Visit is archived - only you (admin) can still change its contents. Unlock it from the Ormawa Visit list.",
  "Ormawa Visit ini diarsipkan - isinya hanya bisa dilihat. Minta admin membuka kuncinya untuk mengubah data.":
    "This Ormawa Visit is archived - its contents are read-only. Ask an admin to unlock it to make changes.",
  // Performance Measurement (v1.22.0)
  "Performance Measurement": "Performance Measurement",
  "Diisi setelah acara selesai. Angkanya tampil di Dashboard. Boleh dikosongkan dulu.":
    "Filled in after the event. The figures appear on the Dashboard. You may leave them blank for now.",
  "Jumlah fungsionaris HMSI yang hadir": "HMSI functionaries who attended",
  "Total feedback HMSI": "Total feedback from HMSI",
  "Rata-rata rating HMSI": "Average rating from HMSI",
  "Total feedback": "Total feedback from",
  "Rata-rata rating": "Average rating from",
  "Link Pertanggung Jawaban (LPJ)": "Accountability report link (LPJ)",
  "Fungsionaris HMSI hadir": "HMSI functionaries present",
  "Feedback dari HMSI": "Feedback from HMSI",
  "Feedback dari": "Feedback from",
  "Pertanggung Jawaban": "Accountability report",
  "Buka LPJ": "Open the report",
  "himpunan partner": "the partner association",
  // "orang" is already defined above.
  "tanggapan": "responses",
  "Belum diisi. Buka menu Ormawa Visit → Edit untuk mengisi hasil pengukuran setelah acara.":
    "Not filled in yet. Open Ormawa Visit → Edit to record the post-event measurements.",
  // Rundown merge (v1.22.0)
  "Gabung dengan baris di bawah": "Merge with the row below",
  "Pisahkan sel": "Split cell",
  // Settings archive (v1.22.0)
  "Arsip Spreadsheet": "Spreadsheet Archive",
  "Main Sheet asli sebelum sistem ini dibuat. Disimpan sebagai rujukan - semua riwayat Ormawa Visit sebelum aplikasi ini ada tercatat di sana.":
    "The original Main Sheets from before this system existed. Kept for reference - every Ormawa Visit that predates this app is recorded there.",
  "Daftar nama & NRP anggota hanya tampil untuk akun yang sudah punya peran. Ajukan peran lewat menu akun untuk melihatnya.":
    "Member names & student IDs are only shown to accounts that already have a role. Request a role from the account menu to see them.",
  // Autosave indicator (v1.25.0)
  "Tersimpan": "Saved",
  "Gagal menyimpan": "Save failed",
  // Signup throttle (v1.25.0)
  "Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.":
    "Too many attempts. Please wait a moment before trying again.",
  "Tunggu": "Wait",
  // Settings: open source (v1.27.0)
  "Kode Sumber Terbuka": "Open Source",
  "Seluruh kode yang membangun website ini bersifat open source - siapa pun boleh melihat, mempelajari, atau ikut mengembangkannya lewat repositori GitHub di bawah.":
    "All the code behind this website is open source - anyone may read it, learn from it, or help develop it through the GitHub repository below.",
  "Lihat di GitHub": "View on GitHub",
  "Kode sumber:": "Source code:",
  // Work Breakdown bulk edit (v1.28.0)
  "Ubah massal": "Bulk edit",
  "tugas terpilih. Centang kolom yang ingin diubah - kolom yang tidak dicentang dibiarkan apa adanya.":
    "tasks selected. Tick the fields you want to change - unticked fields are left as they are.",
  "Dibiarkan kosong = PIC dikosongkan.": "Left blank = the PIC is cleared.",
  "Dibiarkan kosong = deadline dihapus.": "Left blank = the deadline is removed.",
  "Terapkan ke": "Apply to",
  "tugas diperbarui": "tasks updated",
  // Drag-and-drop ordering (v1.28.0)
  "Geser untuk mengurutkan": "Drag to reorder",
  "Seret ikon untuk mengurutkan item di dalam kategorinya.":
    "Drag the handle to reorder items within their category.",
  "Seret ikon untuk mengurutkan pertanyaan; nomor tersusun otomatis.":
    "Drag the handle to reorder the questions; numbering updates automatically.",
  // Ormawa Visit copy template (v1.28.0)
  "Tidak disalin": "Not copied",
  "Salin data dari Ormawa Visit lain…": "Copy data from another Ormawa Visit…",
  "Bisa juga menyalin data menu tertentu dari Ormawa Visit lain ke Ormawa Visit ini.":
    "You can also copy specific menus from another Ormawa Visit into this one.",
  "Hemat waktu - data disalin sebagai kerangka awal (status, PIC, dan tanggal dikosongkan). Tiap menu bisa diambil dari Ormawa Visit yang berbeda.":
    "Save time - data is copied as a starting skeleton (status, PIC, and dates cleared). Each menu can come from a different Ormawa Visit.",
  "PERINGATAN: data menu yang dicentang di Ormawa Visit ini akan DIHAPUS dan diganti dengan salinan dari Ormawa Visit yang dipilih. Menu yang tidak dicentang tidak tersentuh.":
    "WARNING: the ticked menus' data in THIS Ormawa Visit will be DELETED and replaced with a copy from the selected Ormawa Visit. Unticked menus are left untouched.",
  "Ormawa Visit diperbarui & data disalin": "Ormawa Visit updated & data copied",
  // Backup import from file (v1.28.0)
  "Impor dari File": "Import from File",
  "File bukan JSON yang valid.": "That file is not valid JSON.",
  "Pulihkan dari file ini?": "Restore from this file?",
  "Seluruh data saat ini akan diganti total dengan isi file":
    "All current data will be completely replaced by the contents of",
  "tabel": "tables",
  "baris": "rows",
  "Data dipulihkan dari file": "Data restored from file",
  // Change password (v1.29.0)
  "Ubah Kata Sandi": "Change Password",
  "Masukkan kata sandi saat ini, lalu kata sandi barunya.":
    "Enter your current password, then the new one.",
  "Kata sandi saat ini": "Current password",
  "Kata sandi baru": "New password",
  "Ulangi kata sandi baru": "Repeat new password",
  "Kata sandi saat ini salah.": "Your current password is incorrect.",
  "Kata sandi berhasil diubah": "Password changed",
  "Akun ini masuk lewat Google, jadi kata sandinya diatur di akun Google-mu - bukan di sini.":
    "This account signs in with Google, so its password is managed in your Google account - not here.",
  "Tutup": "Close",
  // Work Breakdown & Rundown focus filters (v1.30.0)
  "Fokus PIC": "PIC focus",
  "Fokus ke PIC": "Focus on PIC",
  "Semua PIC": "All PICs",
  "Tanpa PIC": "No PIC",
  "Belum ada PIC": "No PIC yet",
  "Tanpa divisi": "No division",
  "Kolom divisi": "Division columns",
  "Tampilkan semua": "Show all",
  "kolom divisi": "division columns",
  "Tidak ada divisi yang diikutsertakan pada rundown.":
    "No division is included in the rundown.",
  "Tambah anggota": "Add member",
  // Violet chatbot (v1.32.0)
  "Buka Violet": "Open Violet",
  "Asisten Ormawa Visit Management System": "Ormawa Visit Management System assistant",
  "Halo! Aku Violet. Aku hanya menjawab seputar sistem ini: menu, cara pakai, hak akses, dan datanya.":
    "Hi! I'm Violet. I only answer questions about this system: its menus, how to use them, access rules, and its data.",
  "Tanya tentang sistem ini…": "Ask about this system…",
  "Violet sedang mengetik…": "Violet is typing…",
  "Bersihkan percakapan": "Clear conversation",
  "Kirim": "Send",
  // Violet chat polish (v1.33.0)
  "Coba tanyakan": "Try asking",
  "Sumber": "Sources",
  "Salin": "Copy",
  "Salin jawaban": "Copy answer",
  "Tersalin": "Copied",
  // NOTE: "Coba lagi" already has an entry further up in this file.
  // Task references (v1.32.0)
  "Referensi": "References",
  "Referensi (opsional)": "References (optional)",
  "Tambah referensi": "Add reference",
  "Hapus referensi": "Remove reference",
  "Nama referensi (opsional)": "Reference name (optional)",
  "Ambil dari Super Link": "Pick from Super Link",
  "Bahan rujukan untuk mengerjakan tugas ini. Boleh diketik manual atau diambil dari Super Link, dan satu tautan Super Link boleh dipakai banyak tugas.":
    "Material to work from. Type a URL or pick one from Super Link; the same Super Link entry may be used by any number of tasks.",
  "Tidak ada tautan yang cocok.": "No matching link.",
  "Ada tautan yang belum diawali http:// atau https://.":
    "A link is missing its http:// or https:// prefix.",
  "Ada referensi yang tidak valid (harus diawali http:// atau https://).":
    "A reference is not a valid link (it must start with http:// or https://).",
  "Ada referensi yang sama lebih dari sekali.": "The same reference appears more than once.",
  // Changelog categories (v1.31.0). Reached through t(CHANGE_KIND[k].label),
  // which the coverage scanner cannot see, so they are listed by hand.
  "Baru": "New",
  "Perbaikan": "Fix",
  "Keamanan": "Security",
  "Tampilan": "UI",
  "Data": "Data",
  "Tidak ada perubahan pada kategori itu.": "No changes in that category.",
  // Reach & Offer link + notes (v1.31.0)
  "Tautan (opsional)": "Link (optional)",
  "Misalnya handbook, profil organisasi, atau proposal dari himpunan tersebut.":
    "For example their handbook, org profile, or a proposal they sent back.",
  "Nama tautan": "Link name",
  "Handbook himpunan": "Their handbook",
  "Catatan bebas tentang prospek ini.": "Free-text notes about this prospect.",
  // Add existing members to a division (v1.31.0)
  "Tambah anggota ke": "Add members to",
  "Pilih anggota yang sudah terdaftar. Divisi lain yang mereka ikuti tidak akan hilang.":
    "Pick people already on the roster. The other divisions they belong to are kept.",
  "Semua anggota sudah masuk divisi ini": "Everyone is already in this division",
  "Tambahkan orang baru lewat tab Anggota EA kalau memang belum terdaftar.":
    "Add a brand-new person from the EA Members tab if they are not on the roster yet.",
  "Pilih semua yang tampil": "Select all shown",
  "Tambahkan": "Add",
  "anggota ditambahkan ke": "members added to",

  // ==========================================================
  // v1.23.0 - gap closed by src/lib/i18n/coverage.test.ts, which now fails the
  // build when a t() string has no entry here. Everything below was showing in
  // Indonesian even with the language set to English.
  // ==========================================================

  // --- Panduan flowchart ---
  "Mulai - buka aplikasi": "Start - open the app",
  "Login, Mode Demo, atau Mode Tamu.": "Sign in, Demo Mode, or Guest Mode.",
  "Masuk ke sistem": "Sign in",
  "Login dengan email & kata sandi.": "Sign in with your email and password.",
  "Hubungi PIC Ormawa Visit untuk dibuatkan akun.": "Ask the Ormawa Visit PIC to create an account for you.",
  "Klik 'Coba Mode Demo' (database terpisah) atau 'Masuk sebagai Tamu' (hanya lihat).":
    "Click 'Try Demo Mode' (a separate database) or 'Sign in as Guest' (view only).",
  "Apa peranmu?": "What is your role?",
  "Hanya melihat data, tanpa mengubah.": "View the data only, without changing anything.",
  "Kelola divisi, tugas, rundown, job hari-H, dan anggaran.":
    "Manage divisions, tasks, the rundown, event-day jobs, and the budget.",
  "Perbarui status & isi hasil pada tugas yang menjadi tanggung jawabmu.":
    "Update the status and fill in results for the tasks you are responsible for.",
  "Membuat Ormawa Visit baru?": "Creating a new Ormawa Visit?",
  "Buka menu Ormawa Visit → Tambah. Bisa salin data (template) dari edisi sebelumnya.":
    "Open Ormawa Visit → Add. You can copy data (a template) from an earlier edition.",
  "Lanjut memakai edisi yang sudah dipilih.": "Carry on with the edition already selected.",
  "Gunakan pemilih edisi di kanan atas. Semua modul mengikuti edisi ini.":
    "Use the edition picker at the top right. Every module follows this edition.",
  "Lihat Dashboard": "Check the Dashboard",
  "Ringkasan progres, KPI, dan deadline terdekat.": "Progress summary, KPIs, and the nearest deadlines.",
  "Kerjakan tugas (Work Breakdown / Papan Divisi)": "Work the tasks (Work Breakdown / Division board)",
  "Tambah/kelola tugas, tentukan PIC dari daftar anggota, dan deadline.":
    "Add and manage tasks, pick a PIC from the member list, and set deadlines.",
  "Perbarui status tugas": "Update task status",
  "To Do → On Going → Done. Isi kolom Hasil dengan tautan bukti.":
    "To Do → On Going → Done. Put a link to the evidence in the Result column.",
  "Kelola aset & relasi": "Manage assets & relations",
  "Reach & Offer (prospek), Super Link (dokumen), dan Anggaran (RAB).":
    "Reach & Offer (prospects), Super Link (documents), and Budget (RAB).",
  "Siapkan hari pelaksanaan": "Prepare the event day",
  "Susun Rundown per divisi dan pembagian Job Hari-H.":
    "Build the Rundown per division and split up the event-day jobs.",
  "Acara sudah selesai?": "Has the event finished?",
  "Kembali memantau progres di Dashboard sampai semua tugas Done.":
    "Go back to watching progress on the Dashboard until every task is Done.",
  "Selesai - evaluasi & arsip": "Done - evaluate & archive",
  "Isi catatan/evaluasi (mis. 'terlalu cepat/lama') pada rundown, lalu buat laporan akhir.":
    "Add notes/evaluations (e.g. 'ran too fast/slow') on the rundown, then write the final report.",
  "Langkah": "Step",
  "Keputusan (jika…)": "Decision (if…)",
  "Template": "Template",
  "Demo": "Demo",

  // --- Dialog & tombol ---
  "Edit Ormawa Visit": "Edit Ormawa Visit",
  "Edit Divisi": "Edit Division",
  "Edit Anggota": "Edit Member",
  "Ini masih rencana - cukup isi nama & tanggal. Detail seperti partner, kampus, lokasi, tipe, dan mode bisa dikosongkan dulu; nanti terisi otomatis dari prospek utama di Reach & Offer.":
    "This is still a plan - just fill in the name and dates. Details like partner, campus, location, type, and mode can be left empty for now; they fill in automatically from the primary prospect in Reach & Offer.",
  "Pilih dari anggota divisi ini": "Choose from this division's members",
  "Pilih koordinator…": "Choose a coordinator…",

  // --- Empty states & toast ---
  "Belum ada backup": "No backups yet",
  "Belum ada tugas yang cocok dengan filter saat ini.": "No tasks match the current filters.",
  "Sesuaikan pencarian atau tambah tautan baru.": "Adjust your search, or add a new link.",
  "item dipilih": "items selected",
  "item dihapus": "items deleted",
  "tautan dihapus": "links deleted",
  "prospek dihapus": "prospects deleted",
  "Prospek dihapus": "Prospect deleted",
  "tugas dilewati (tanpa akses)": "tasks skipped (no access)",

  // --- Carousel & kolom ---
  "Sebelumnya": "Previous",
  "Berikutnya": "Next",
  "Jenis Ormawa Visit": "Ormawa Visit type",
  "Ikut rundown": "In the rundown",
  "Tanpa rundown": "Not in the rundown",

  // --- Changelog ---
  "Lihat semua versi": "Show every version",
  "Tampilkan lebih sedikit": "Show fewer",
  "versi lama": "older versions",

  // --- Reset Mode Demo ---
  "Reset data demo?": "Reset the demo data?",
  "Reset sekarang": "Reset now",
  "Data demo dikembalikan ke awal.": "The demo data has been restored to its initial state.",
  "Kembalikan seluruh data sandbox (tugas, anggaran, anggota, dll.) ke contoh awal. Perubahanmu di Mode Demo akan hilang.":
    "Restore all sandbox data (tasks, budget, members, and so on) to the original sample. Your Demo Mode changes will be lost.",
  "Semua data Mode Demo akan dihapus dan diganti dengan contoh awal. Data asli (produksi) tidak terpengaruh.":
    "Every Demo Mode record will be deleted and replaced with the original sample. Real (production) data is not affected.",

  // --- Checkbox filters + expandable notes (v1.35.0) ---
  // Lower-cased on purpose: these are the plural nouns in a trigger label such
  // as "3 status" / "2 divisi", not headings.
  "status": "statuses",
  "tahap": "stages",
  "tipe": "types",
  "divisi": "divisions",
  "Belum ada pilihan": "Nothing to filter by yet",
  "Belum ada divisi": "No divisions yet",
  "Selengkapnya": "Show more",
  "Tautan prospek": "Prospect links",
  "Belum ada tautan. Klik “Tambah tautan” untuk melampirkan handbook, profil organisasi, atau proposal.":
    "No links yet. Use “Add link” to attach a handbook, an org profile, or a proposal.",
  "Kosongkan untuk memakai nama himpunan. Mengubah atau menghapus tautan ini juga memperbarui Super Link.":
    "Leave blank to use the organisation's name. Editing or removing this link updates Super Link too.",
  "Tautan himpunan yang dihubungi: handbook, profil organisasi, atau proposal balasan. Boleh lebih dari satu.":
    "Links belonging to the organisation you contacted: handbook, org profile, or the proposal they sent back. More than one is fine.",

  // --- Menu Himpunan: FGD + Compare (v1.37.0) ---
  "Plotting FGD antar departemen dan perbandingan himpunan yang menerima ajakan.":
    "Department-to-department FGD plotting, and a comparison of the associations that accepted.",
  "Focus Group Discussion": "Focus Group Discussion",
  "Pasangkan tiap departemen HMSI ITS dengan departemen padanannya di himpunan mitra. Satu Ormawa Visit boleh punya beberapa tabel.":
    "Pair each HMSI ITS department with its counterpart at the partner association. One Ormawa Visit may have several tables.",
  "Tabel baru": "New table",
  "Tabel FGD baru": "New FGD table",
  "Tabel FGD dibuat": "FGD table created",
  "Tabel FGD dihapus": "FGD table deleted",
  "Hapus tabel FGD?": "Delete this FGD table?",
  "Hapus tabel": "Delete table",
  "Seluruh barisnya ikut terhapus dan tidak bisa dikembalikan.":
    "Every row in it goes too, and this cannot be undone.",
  "Belum ada tabel FGD": "No FGD table yet",
  "Buat tabel baru untuk mulai memplot pasangan departemen. Sepuluh departemen HMSI ITS terisi otomatis.":
    "Create a table to start pairing departments. The ten HMSI ITS departments are filled in for you.",
  "Belum ada plotting FGD untuk Ormawa Visit ini.": "No FGD plotting for this Ormawa Visit yet.",
  "Kolom kiri otomatis terisi 10 departemen HMSI ITS dan tetap bisa diubah.":
    "The left column is pre-filled with the ten HMSI ITS departments and stays editable.",
  "Nama himpunan mitra": "Partner association name",
  "Judul tabel (opsional)": "Table title (optional)",
  "mis. Sesi pagi": "e.g. Morning session",
  "Plotting FGD": "FGD plotting",
  "Departemen HMSI": "HMSI department",
  "Departemen mitra": "Partner department",
  "Tabel ini kosong.": "This table is empty.",
  "Buat": "Create",
  "(belum diisi)": "(not filled in)",
  "(tanpa nama)": "(unnamed)",
  "(kosong)": "(empty)",
  "Belum ada yang bisa dibandingkan": "Nothing to compare yet",
  "Compare terbuka setelah ada lebih dari satu himpunan dengan Respons Mereka = DITERIMA di Reach & Offer.":
    "Compare opens once more than one association has Their Response = DITERIMA in Reach & Offer.",
  "Baru satu himpunan yang menerima ajakan, jadi belum ada pilihan untuk ditimbang. Compare terbuka setelah ada dua atau lebih.":
    "Only one association has accepted, so there is no choice to weigh up yet. Compare opens at two or more.",
  "himpunan menerima ajakan pada Ormawa Visit ini.":
    "associations accepted for this Ormawa Visit.",
  "Catat aspek penilaian, indikator, kelebihan, dan kekurangan tiap himpunan untuk membandingkannya.":
    "Record the assessment aspect, indicator, strengths, and weaknesses of each to compare them.",
  "Semua himpunan": "All associations",
  "himpunan": "associations",
  "aspek": "aspects",
  "Tambah aspek": "Add aspect",
  "Hapus aspek": "Delete aspect",
  "Belum ada penilaian.": "No assessment yet.",
  "Belum ada penilaian. Tambah aspek untuk mulai.": "No assessment yet. Add an aspect to start.",
  "Aspek Penilaian": "Assessment aspect",
  "Indikator yang Dinilai": "Indicator assessed",
  "Kelebihan": "Strengths",
  "Kekurangan": "Weaknesses",
  "Plus / Kelebihan": "Plus / strengths",
  "Minus / Kekurangan": "Minus / weaknesses",
  "Penilaian tanpa himpunan aktif": "Assessments with no active association",
  "Himpunannya sudah tidak berstatus DITERIMA di Reach & Offer, atau prospeknya dihapus. Isinya disimpan di sini supaya tidak hilang begitu saja.":
    "The association is no longer marked DITERIMA in Reach & Offer, or its prospect was deleted. What was written is kept here so it is not lost silently.",

  // --- Himpunan Compare v2 + clone options (v1.38.0) ---
  "(tanpa aspek)": "(no aspect)",
  "Aspek": "Aspect",
  "Belum ada himpunan berstatus DITERIMA di Reach & Offer untuk dibandingkan.": "No association is marked DITERIMA in Reach & Offer yet, so there is nothing to compare.",
  "Belum ada perbandingan yang dibuat. Klik tombol untuk memilih himpunan yang menerima ajakan.": "No comparison has been created yet. Use the button to pick an association that accepted.",
  "Belum ada perbandingan": "No comparison yet",
  "Buat perbandingan": "Create comparison",
  "Catat aspek penilaian, indikator, kelebihan, dan kekurangan tiap himpunan.": "Record each association's assessment aspect, indicator, strengths, and weaknesses.",
  "Compare terisi setelah ada himpunan dengan Respons Mereka = DITERIMA di Reach & Offer, lalu kamu buat perbandingannya.": "Compare fills in once an association has Their Response = DITERIMA in Reach & Offer and you create its comparison.",
  "Data lama tetap; salinan ditambahkan di atasnya.": "Existing data stays; the copy is added on top.",
  "Data menu yang dicentang DIHAPUS dulu, lalu diganti dengan salinan.": "The ticked menus' data is DELETED first, then replaced with the copy.",
  "Gagal memuat pilihan divisi/rencana.": "Could not load the division/plan options.",
  "Ganti total": "Replace entirely",
  "Hapus perbandingan": "Delete comparison",
  "Hapus perbandingan?": "Delete this comparison?",
  "Himpunan A": "Association A",
  "Himpunan B": "Association B",
  "Kartu": "Cards",
  "Kedua himpunan belum punya penilaian untuk disandingkan.": "Neither association has any assessment to line up yet.",
  "Klik “Buat perbandingan” lalu pilih himpunan yang ingin dinilai.": "Click “Create comparison” then pick the association to assess.",
  "Memuat pilihan…": "Loading options…",
  "Perbandingan dibuat": "Comparison created",
  "Perbandingan dihapus": "Comparison deleted",
  "Perbandingan": "Comparison",
  "Perlakuan data yang sudah ada di Ormawa Visit ini:": "How the data already in this Ormawa Visit is treated:",
  "Pilih dua himpunan yang berbeda untuk membandingkannya berdampingan.": "Pick two different associations to compare them side by side.",
  "Pilih himpunan yang menerima ajakan (Respons Mereka = DITERIMA) untuk dibuatkan penilaiannya.": "Pick an association that accepted (Their Response = DITERIMA) to assess.",
  "Sanding": "Side by side",
  "Saya paham data yang disalin berasal dari": "I understand the copied data comes from",
  "Semua himpunan yang menerima ajakan sudah dibuatkan perbandingannya.": "Every association that accepted already has a comparison.",
  "Semua rencana": "All plans",
  "Sumber ini belum punya divisi.": "This source has no divisions yet.",
  "Sumber ini belum punya rencana RAB.": "This source has no budget plan yet.",
  "Sumber ini punya satu rencana; semuanya disalin.": "This source has one plan; all of it is copied.",
  "Tidak ada himpunan yang tersisa untuk dibuatkan perbandingan.": "No associations are left to make a comparison for.",
  "beserta seluruh penilaiannya akan dihapus dan tidak bisa dikembalikan.": "and all its assessments will be deleted and cannot be restored.",
  "dan akan DITAMBAHKAN ke data": "and will be ADDED to the data of",
  "dan akan MENGHAPUS lalu mengganti data": "and will DELETE and replace the data of",
  "himpunan dibandingkan.": "associations compared.",
  "rencana dipilih": "plans selected",
  "yang sedang dibuka.": "currently open.",

  // v1.41.2 - teks yang selama ini luput karena tidak dibungkus t() sama sekali
  // (aria-label, title, placeholder yang berisi instruksi), plus dua label
  // pembaca layar baru untuk palet pencarian dan laci menu.
  "Hapus baris": "Delete row",
  "Warna khusus": "Custom colour",
  "Nama kamu": "Your name",
  "Gedung / kota…": "Building / city…",
  "Hasil pencarian": "Search results",
  "Menu navigasi": "Navigation menu",
};
