import type { Bi } from "./guide";

// ============================================================
// Privacy Policy & Terms of Service, in Indonesian AND English.
//
// Same data-driven pattern as `guide.ts`: both languages live in one entry so
// the pages follow the language toggle without going through `dict.ts`.
//
// MAINTENANCE
//  - These describe what the app ACTUALLY does. When you add a data field, a
//    cookie, or a third-party service, update the matching section here in the
//    same change - an inaccurate privacy policy is worse than none.
//  - Bump LEGAL_UPDATED whenever the wording changes materially.
//  - NOT LEGAL ADVICE: this was drafted from the codebase, not by a lawyer.
//    Have the department review it (and fill in LEGAL_CONTACT_EMAIL) before
//    treating it as binding.
// ============================================================

/** Shown as "last updated" on both documents (ISO date). */
export const LEGAL_UPDATED = "2026-08-13";

/** Public contact already published in-app (Settings + README). */
export const LEGAL_CONTACT_WA = "https://wa.me/6281311598126";
/** TODO(dept): replace with an official departmental address. */
export const LEGAL_CONTACT_EMAIL = "";

export interface LegalSection {
  heading: Bi;
  /** Paragraphs. */
  body?: Bi[];
  /** Bullet list rendered under the paragraphs. */
  bullets?: Bi[];
}

export interface LegalDoc {
  slug: "privacy" | "terms";
  title: Bi;
  summary: Bi;
  sections: LegalSection[];
}

// ------------------------------------------------------------
// Privacy Policy
// ------------------------------------------------------------
export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: { id: "Kebijakan Privasi", en: "Privacy Policy" },
  summary: {
    id: "Dokumen ini menjelaskan data apa yang dikumpulkan Ormawa Visit Management System, untuk apa data itu dipakai, siapa yang bisa melihatnya, dan hak kamu atas data tersebut.",
    en: "This document explains what data the Ormawa Visit Management System collects, what it is used for, who can see it, and what rights you have over it.",
  },
  sections: [
    {
      heading: { id: "1. Tentang sistem ini", en: "1. About this system" },
      body: [
        {
          id: "Ormawa Visit Management System adalah alat kerja internal Departemen External Affairs HMSI ITS untuk mengelola program Ormawa Visit: perencanaan tugas, rundown acara, anggaran, data himpunan mitra, dan dokumentasi. Sistem ini dipakai oleh fungsionaris dan intern departemen, serta dapat dilihat secara terbatas oleh tamu.",
          en: "The Ormawa Visit Management System is an internal working tool of the HMSI ITS External Affairs Department for running the Ormawa Visit programme: task planning, event rundowns, budgeting, partner organisation data, and documentation. It is used by departmental staff and interns, and can be viewed in a limited way by guests.",
        },
        {
          id: "Sistem ini bukan layanan komersial. Tidak ada iklan, tidak ada penjualan data, dan tidak ada pelacakan lintas situs.",
          en: "This is not a commercial service. There are no ads, no data sales, and no cross-site tracking.",
        },
      ],
    },
    {
      heading: { id: "2. Data yang kami kumpulkan", en: "2. Data we collect" },
      body: [
        {
          id: "Sebagian besar data di sistem ini kamu isi sendiri sebagai bagian dari pekerjaan kepanitiaan. Rinciannya:",
          en: "Most of the data here is entered by you as part of committee work. In detail:",
        },
      ],
      bullets: [
        {
          id: "Data akun - nama, alamat email, dan warna avatar. Jika kamu mendaftar lewat Google, kami menerima nama, alamat email, dan foto profil dari akun Google-mu. Kami tidak pernah menerima atau menyimpan kata sandi Google-mu.",
          en: "Account data - your name, email address, and avatar colour. If you sign up with Google, we receive your name, email address, and profile picture from your Google account. We never receive or store your Google password.",
        },
        {
          id: "Data keanggotaan - nama, nama panggilan, NRP, angkatan, divisi, dan status (fungsionaris atau intern) anggota kepanitiaan.",
          en: "Membership data - name, nickname, student ID (NRP), cohort year, division, and status (staff or intern) of committee members.",
        },
        {
          id: "Data pekerjaan - tugas beserta penanggung jawab (PIC), tenggat, catatan, dan hasil; rundown acara termasuk MC dan operator; pembagian tugas hari-H; rencana anggaran; serta tautan dokumen yang kamu tambahkan.",
          en: "Work data - tasks with their person in charge (PIC), deadlines, notes, and results; event rundowns including MC and operator; event-day job assignments; budget plans; and document links you add.",
        },
        {
          id: "Data himpunan mitra (menu Reach & Offer) - nama himpunan, kampus, lokasi, narahubung, dan status komunikasi. Data ini menyangkut orang di luar HMSI ITS; lihat bagian 6.",
          en: "Partner organisation data (the Reach & Offer menu) - organisation name, campus, location, contact person, and communication status. This concerns people outside HMSI ITS; see section 6.",
        },
        {
          id: "Pengajuan peran - peran yang kamu minta beserta catatan yang kamu tulis untuk admin.",
          en: "Role requests - the role you ask for and any note you write for the admin.",
        },
        {
          id: "Data teknis - cookie yang diperlukan agar sistem berfungsi (lihat bagian 3). Kami tidak memasang alat analitik, piksel iklan, atau pelacak pihak ketiga apa pun.",
          en: "Technical data - cookies required for the system to work (see section 3). We do not install any analytics tools, advertising pixels, or third-party trackers.",
        },
      ],
    },
    {
      heading: { id: "3. Cookie yang dipakai", en: "3. Cookies we use" },
      body: [
        {
          id: "Semua cookie di bawah ini bersifat fungsional - dipakai agar sistem berjalan dan mengingat pilihanmu. Tidak ada cookie iklan atau analitik.",
          en: "Every cookie below is functional - used to make the system work and to remember your preferences. There are no advertising or analytics cookies.",
        },
      ],
      bullets: [
        {
          id: "Cookie sesi Supabase (diawali sb-) - menjaga kamu tetap masuk setelah login.",
          en: "Supabase session cookies (prefixed sb-) - keep you signed in after login.",
        },
        { id: "ov_guest - menandai sesi tamu (hanya lihat, tanpa akun).", en: "ov_guest - marks a guest session (view-only, no account)." },
        { id: "ov_lang - bahasa tampilan pilihanmu (Indonesia atau Inggris).", en: "ov_lang - your chosen display language (Indonesian or English)." },
        { id: "ov_sidebar - apakah menu samping sedang diciutkan.", en: "ov_sidebar - whether the sidebar is collapsed." },
        { id: "ov_active_event dan ov_active_division - Ormawa Visit dan divisi yang sedang kamu lihat.", en: "ov_active_event and ov_active_division - the Ormawa Visit and division you are currently viewing." },
        { id: "ov_demo dan ov_demo_user - hanya aktif di Mode Demo, untuk menandai sesi demo dan identitas contoh yang dipilih.", en: "ov_demo and ov_demo_user - only active in Demo Mode, marking the demo session and the sample identity in use." },
      ],
    },
    {
      heading: { id: "4. Untuk apa data dipakai", en: "4. What the data is used for" },
      bullets: [
        { id: "Menjalankan program Ormawa Visit: membagi tugas, memantau progres, menyusun rundown dan anggaran.", en: "Running the Ormawa Visit programme: assigning tasks, tracking progress, preparing rundowns and budgets." },
        { id: "Menentukan hak akses - peran akunmu menentukan menu apa yang bisa kamu buka dan ubah.", en: "Determining access rights - your account role decides which menus you can open and edit." },
        { id: "Menjaga kesinambungan antar kepengurusan, sehingga kepanitiaan berikutnya bisa belajar dari data sebelumnya.", en: "Preserving continuity between cabinets, so the next committee can learn from previous data." },
        { id: "Mencadangkan data agar bisa dipulihkan bila terjadi kesalahan atau kehilangan data.", en: "Backing up data so it can be restored if something is lost or goes wrong." },
      ],
      body: [
        {
          id: "Data tidak dipakai untuk iklan, tidak dijual atau disewakan ke pihak mana pun, dan tidak dipakai untuk membuat profil otomatis di luar keperluan hak akses di atas.",
          en: "Data is not used for advertising, is never sold or rented to anyone, and is not used for automated profiling beyond the access-control purpose above.",
        },
      ],
    },
    {
      heading: { id: "5. Siapa yang bisa melihat data kamu", en: "5. Who can see your data" },
      body: [
        {
          id: "Akses diatur berjenjang per peran dan bisa dilihat lengkap di halaman Pengaturan. Ringkasnya: Admin melihat dan mengelola semuanya; Koordinator mengelola Work Breakdown, Rundown, Hari-H, dan Super Link; Staff dan Intern bisa membuat dan mengisi di menu yang sama tanpa bisa menghapus; Tamu dan akun yang belum punya peran hanya bisa melihat.",
          en: "Access is tiered by role and shown in full on the Settings page. In short: Admins see and manage everything; Coordinators manage the Work Breakdown, Rundown, Event-Day, and Super Link; Staff and Interns can create and fill in the same menus without deleting; Guests and role-less accounts can only look.",
        },
        {
          id: "Alamat email akun hanya terlihat oleh Admin. Nama dan penugasanmu terlihat oleh sesama pengguna sistem, karena itulah inti dari alat kerja bersama ini.",
          en: "Account email addresses are visible only to Admins. Your name and assignments are visible to other users of the system - that is the point of a shared working tool.",
        },
      ],
    },
    {
      heading: { id: "6. Data orang di luar HMSI ITS", en: "6. Data about people outside HMSI ITS" },
      body: [
        {
          id: "Menu Reach & Offer menyimpan narahubung himpunan mahasiswa lain. Data ini hanya boleh diperoleh dari kanal resmi atau informasi yang memang dibagikan untuk keperluan kerja sama, dan hanya boleh dipakai untuk keperluan Ormawa Visit.",
          en: "The Reach & Offer menu stores contact people at other student organisations. This data may only be obtained from official channels or information shared for partnership purposes, and may only be used for Ormawa Visit purposes.",
        },
        {
          id: "Dilarang menyebarkan kontak tersebut ke luar kepanitiaan atau memakainya untuk keperluan pribadi. Bila pihak yang bersangkutan meminta datanya dihapus, hubungi kami lewat kontak di bagian 11 dan data akan dihapus.",
          en: "Sharing those contacts outside the committee or using them for personal purposes is prohibited. If the person concerned asks for their data to be removed, contact us via section 11 and it will be deleted.",
        },
      ],
    },
    {
      heading: { id: "7. Tempat penyimpanan & pihak ketiga", en: "7. Storage and third parties" },
      body: [
        {
          id: "Sistem ini berjalan di atas layanan pihak ketiga berikut. Masing-masing punya kebijakan privasinya sendiri:",
          en: "The system runs on the following third-party services. Each has its own privacy policy:",
        },
      ],
      bullets: [
        { id: "Supabase - basis data dan sistem autentikasi (penyimpanan akun serta seluruh data kerja).", en: "Supabase - database and authentication (storing accounts and all working data)." },
        { id: "Vercel - hosting aplikasi dan penjadwal pencadangan otomatis.", en: "Vercel - application hosting and the automatic backup scheduler." },
        { id: "Google - hanya bila kamu memilih Masuk/Daftar dengan Google, untuk memverifikasi identitasmu.", en: "Google - only if you choose to sign in or sign up with Google, to verify your identity." },
        { id: "Google Gemini dan Groq - layanan AI di balik asisten chat Violet. Keduanya hanya menerima pertanyaan yang kamu ketik beserta kutipan data yang relevan dengan pertanyaan itu, dan hanya sebatas yang boleh kamu lihat sendiri. Violet dipakai layanan cadangan (Groq) hanya bila layanan utamanya (Gemini) sedang tidak bisa menjawab. Percakapannya tidak kami simpan.", en: "Google Gemini and Groq - the AI services behind the Violet chat assistant. They only receive the question you type plus the excerpts of data relevant to it, and only what you are allowed to see yourself. The backup service (Groq) is used only when the primary one (Gemini) cannot answer. We do not store the conversation." },
      ],
    },
    {
      heading: { id: "8. Pencadangan & retensi", en: "8. Backups and retention" },
      body: [
        {
          id: "Salinan cadangan seluruh data dibuat otomatis secara berkala (setiap tiga hari) dan dapat juga dibuat manual oleh Admin sebelum tindakan berisiko. Cadangan disimpan di basis data yang sama dan hanya dapat diakses Admin.",
          en: "Backups of all data are created automatically on a regular schedule (every three days) and can also be made manually by an Admin before risky operations. Backups live in the same database and are accessible only to Admins.",
        },
        {
          id: "Data program disimpan selama masih dibutuhkan sebagai arsip kepengurusan. Data akun disimpan selama akun masih aktif. Kamu dapat meminta penghapusan seperti dijelaskan di bagian 9.",
          en: "Programme data is retained for as long as it is needed as a cabinet archive. Account data is retained while the account is active. You can request deletion as described in section 9.",
        },
      ],
    },
    {
      heading: { id: "9. Hak kamu atas data", en: "9. Your rights over your data" },
      bullets: [
        { id: "Melihat data akun dan penugasanmu langsung di dalam sistem.", en: "View your account data and assignments directly inside the system." },
        { id: "Memperbaiki data yang keliru - melalui menu terkait, atau dengan meminta bantuan Admin.", en: "Correct inaccurate data - through the relevant menu, or by asking an Admin." },
        { id: "Meminta penghapusan akun beserta data pribadimu. Penghapusan dilakukan manual oleh Admin; data pekerjaan yang sudah menjadi arsip program dapat dipertahankan dalam bentuk tanpa identitas.", en: "Request deletion of your account and personal data. Deletion is performed manually by an Admin; work data that has become a programme archive may be retained in de-identified form." },
        { id: "Menarik diri - berhenti memakai sistem dan meminta peranmu dicabut kapan saja.", en: "Withdraw - stop using the system and ask for your role to be revoked at any time." },
      ],
    },
    {
      heading: { id: "10. Keamanan", en: "10. Security" },
      body: [
        {
          id: "Akses dibatasi di dua lapis: pengecekan peran di aplikasi dan Row Level Security di basis data. Seluruh lalu lintas berjalan lewat koneksi terenkripsi (HTTPS), dan kata sandi tidak pernah disimpan dalam bentuk terbaca.",
          en: "Access is restricted at two layers: role checks in the application and Row Level Security in the database. All traffic runs over encrypted connections (HTTPS), and passwords are never stored in readable form.",
        },
        {
          id: "Meski begitu, tidak ada sistem yang sepenuhnya kebal. Jaga kerahasiaan kata sandimu, jangan berbagi akun, dan segera laporkan bila kamu menduga ada penyalahgunaan.",
          en: "Even so, no system is completely immune. Keep your password confidential, do not share accounts, and report any suspected misuse immediately.",
        },
      ],
    },
    {
      heading: { id: "11. Perubahan & kontak", en: "11. Changes and contact" },
      body: [
        {
          id: "Kebijakan ini dapat diperbarui bila ada perubahan pada sistem. Tanggal pembaruan terakhir tercantum di atas halaman ini.",
          en: "This policy may be updated when the system changes. The date it was last updated appears at the top of this page.",
        },
        {
          id: "Pertanyaan, koreksi, atau permintaan penghapusan data dapat disampaikan ke PIC Ormawa Visit Departemen External Affairs HMSI ITS lewat kontak WhatsApp yang tertera di bawah.",
          en: "Questions, corrections, or deletion requests can be sent to the Ormawa Visit PIC of the HMSI ITS External Affairs Department via the WhatsApp contact below.",
        },
      ],
    },
  ],
};

// ------------------------------------------------------------
// Terms of Service
// ------------------------------------------------------------
export const TERMS: LegalDoc = {
  slug: "terms",
  title: { id: "Ketentuan Layanan", en: "Terms of Service" },
  summary: {
    id: "Dokumen ini mengatur bagaimana Ormawa Visit Management System boleh dipakai, apa tanggung jawab pengguna, dan batasan layanan ini.",
    en: "This document governs how the Ormawa Visit Management System may be used, what users are responsible for, and the limits of the service.",
  },
  sections: [
    {
      heading: { id: "1. Persetujuan", en: "1. Acceptance" },
      body: [
        {
          id: "Dengan mendaftar, masuk, atau memakai sistem ini - termasuk sebagai tamu tanpa akun - kamu dianggap membaca dan menyetujui Ketentuan Layanan serta Kebijakan Privasi ini. Bila kamu tidak setuju, mohon jangan memakai sistem ini.",
          en: "By registering, signing in, or using this system - including as a guest without an account - you are deemed to have read and agreed to these Terms of Service and the Privacy Policy. If you do not agree, please do not use the system.",
        },
      ],
    },
    {
      heading: { id: "2. Sifat layanan", en: "2. Nature of the service" },
      body: [
        {
          id: "Sistem ini adalah alat kerja internal Departemen External Affairs HMSI ITS, disediakan gratis untuk keperluan kepanitiaan Ormawa Visit. Sistem masih dalam pengembangan aktif, sehingga fitur dapat berubah, ditambah, atau dihentikan sewaktu-waktu.",
          en: "This system is an internal working tool of the HMSI ITS External Affairs Department, provided free of charge for Ormawa Visit committee work. It is under active development, so features may change, be added, or be discontinued at any time.",
        },
      ],
    },
    {
      heading: { id: "3. Akun & peran", en: "3. Accounts and roles" },
      bullets: [
        { id: "Kamu boleh mendaftar sendiri memakai email atau akun Google. Satu orang satu akun, dengan data diri yang benar.", en: "You may register yourself using an email address or a Google account. One account per person, with accurate personal details." },
        { id: "Akun baru belum punya peran dan hanya bisa melihat. Peran diberikan lewat pengajuan yang disetujui Admin.", en: "A new account has no role and can only view. Roles are granted through a request approved by an Admin." },
        { id: "Peran dapat diubah, diturunkan, atau dicabut oleh Admin - misalnya ketika kepengurusan berganti atau kamu tidak lagi aktif di kepanitiaan.", en: "Roles may be changed, downgraded, or revoked by an Admin - for example when the cabinet changes or you are no longer active on the committee." },
        { id: "Kamu bertanggung jawab menjaga kerahasiaan kata sandi dan seluruh aktivitas yang terjadi lewat akunmu. Dilarang meminjamkan akun.", en: "You are responsible for keeping your password confidential and for all activity under your account. Lending your account is prohibited." },
      ],
    },
    {
      heading: { id: "4. Penggunaan yang dilarang", en: "4. Prohibited use" },
      bullets: [
        { id: "Mengakses atau mencoba mengakses data di luar hak aksesmu, termasuk memanfaatkan celah teknis.", en: "Accessing or attempting to access data beyond your access rights, including by exploiting technical flaws." },
        { id: "Mengambil data secara massal (scraping) atau menyalin data keluar dari sistem tanpa izin PIC.", en: "Bulk-extracting (scraping) or copying data out of the system without the PIC's permission." },
        { id: "Memakai kontak himpunan mitra untuk kepentingan pribadi atau menyebarkannya ke luar kepanitiaan.", en: "Using partner organisation contacts for personal purposes or sharing them outside the committee." },
        { id: "Mengunggah atau menautkan konten yang melanggar hukum, menyinggung, atau bukan haknya untuk dibagikan.", en: "Uploading or linking content that is unlawful, offensive, or not yours to share." },
        { id: "Mengganggu jalannya sistem, misalnya membebani server secara sengaja atau menyisipkan kode berbahaya.", en: "Disrupting the system's operation, for example by deliberately overloading the server or injecting malicious code." },
      ],
    },
    {
      heading: { id: "5. Data & konten yang kamu masukkan", en: "5. Data and content you enter" },
      body: [
        {
          id: "Data yang kamu masukkan sebagai bagian dari kepanitiaan - tugas, rundown, anggaran, dokumen, dan sejenisnya - merupakan data kerja organisasi dan menjadi arsip Departemen External Affairs HMSI ITS. Kamu tetap wajib memastikan bahwa kamu berhak memasukkan data tersebut.",
          en: "Data you enter as part of committee work - tasks, rundowns, budgets, documents, and the like - is organisational working data and forms part of the HMSI ITS External Affairs Department archive. You remain responsible for ensuring you have the right to enter it.",
        },
        {
          id: "Simpan salinan sendiri untuk dokumen yang benar-benar penting. Sistem ini alat bantu koordinasi, bukan satu-satunya tempat penyimpanan yang kamu andalkan.",
          en: "Keep your own copy of genuinely important documents. This system is a coordination aid, not the only storage you should rely on.",
        },
      ],
    },
    {
      heading: { id: "6. Mode Demo", en: "6. Demo Mode" },
      body: [
        {
          id: "Mode Demo berjalan di basis data yang benar-benar terpisah dan berisi data contoh fiktif. Isinya dapat direset kapan saja tanpa pemberitahuan. Jangan pernah memasukkan data asli ke Mode Demo.",
          en: "Demo Mode runs on a completely separate database containing fictional sample data. Its contents may be reset at any time without notice. Never enter real data into Demo Mode.",
        },
      ],
    },
    {
      heading: { id: "7. Ketersediaan & tanggung jawab", en: "7. Availability and liability" },
      body: [
        {
          id: "Sistem disediakan apa adanya, sebaik yang kami mampu, tanpa jaminan bebas dari gangguan, kesalahan, atau kehilangan data. Layanan dapat berhenti sementara karena pemeliharaan atau gangguan pada penyedia pihak ketiga.",
          en: "The system is provided as is, on a best-effort basis, with no guarantee of being free from downtime, errors, or data loss. Service may pause for maintenance or because of third-party provider outages.",
        },
        {
          id: "Sejauh diizinkan hukum yang berlaku, HMSI ITS beserta pengelola sistem tidak bertanggung jawab atas kerugian yang timbul dari pemakaian atau ketidaktersediaan sistem ini.",
          en: "To the extent permitted by applicable law, HMSI ITS and the system's maintainers are not liable for losses arising from the use or unavailability of this system.",
        },
      ],
    },
    {
      heading: { id: "8. Penangguhan akses", en: "8. Suspension of access" },
      body: [
        {
          id: "Admin dapat menangguhkan atau menghapus akun yang melanggar ketentuan ini, menyalahgunakan data, atau sudah tidak berkepentingan dengan program Ormawa Visit.",
          en: "Admins may suspend or remove accounts that breach these terms, misuse data, or no longer have any involvement in the Ormawa Visit programme.",
        },
      ],
    },
    {
      heading: { id: "9. Perubahan ketentuan", en: "9. Changes to these terms" },
      body: [
        {
          id: "Ketentuan ini dapat diperbarui seiring berkembangnya sistem. Perubahan berlaku sejak tanggal pembaruan yang tercantum di atas halaman ini. Dengan terus memakai sistem setelah perubahan, kamu dianggap menyetujuinya.",
          en: "These terms may be updated as the system evolves. Changes take effect from the update date shown at the top of this page. By continuing to use the system after a change, you are deemed to accept it.",
        },
      ],
    },
    {
      heading: { id: "10. Hukum yang berlaku & kontak", en: "10. Governing law and contact" },
      body: [
        {
          id: "Ketentuan ini tunduk pada hukum Republik Indonesia dan peraturan yang berlaku di lingkungan Institut Teknologi Sepuluh Nopember.",
          en: "These terms are governed by the laws of the Republic of Indonesia and the regulations in force at Institut Teknologi Sepuluh Nopember.",
        },
        {
          id: "Pertanyaan mengenai ketentuan ini dapat disampaikan ke PIC Ormawa Visit Departemen External Affairs HMSI ITS lewat kontak WhatsApp di bawah.",
          en: "Questions about these terms can be sent to the Ormawa Visit PIC of the HMSI ITS External Affairs Department via the WhatsApp contact below.",
        },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDoc["slug"], LegalDoc> = {
  privacy: PRIVACY,
  terms: TERMS,
};
