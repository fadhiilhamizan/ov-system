import { normText, type ColumnSpec, type ImportContext, type ImportModule, type ModuleSpec } from "./core";

// ============================================================
// One spec per table menu. A spec is DATA: the template builder, the parser,
// the dialog and the "Petunjuk" sheet all read it, so adding a column here
// adds it everywhere at once. The commit (what a parsed row becomes in the
// database) lives server-side in actions/import.ts, keyed by the same module.
//
// Headers are the Indonesian labels the menus already use. `aliases` are what
// people are likely to type instead (English, the older wording), so a sheet
// built by hand rather than from the template still imports.
// ============================================================

/** Rules that apply to every template; printed first on the Petunjuk sheet. */
export const COMMON_RULES = [
  "Isi data hanya di sheet \"Data\". Sheet \"Contoh\" adalah contoh pengisian dan tidak ikut diimpor.",
  "Jangan mengubah atau menghapus baris judul kolom (baris 1). Urutan kolom boleh diubah, kolom opsional boleh dihapus.",
  "Kolom bertanda * wajib diisi. Baris yang benar-benar kosong dilewati.",
  "Kolom dengan daftar pilihan (dropdown) sebaiknya diisi dari daftarnya. Daftar lengkapnya ada di sheet \"Referensi\".",
  "Tanggal boleh ditulis 2026-10-01, 01/10/2026, atau 1 Oktober 2026. Jam ditulis 08.00.",
  "Sel yang di-merge (gabung) ke bawah dianggap berisi nilai yang sama untuk setiap baris yang digabung, kecuali disebutkan lain di aturan menu ini.",
  "File bisa disiapkan di Excel atau Google Sheets (File > Download > Microsoft Excel .xlsx). Ukuran maksimal 3 MB.",
  "Impor selalu MENAMBAH data. Data yang sudah ada tidak diubah atau dihapus. Pratinjau ditampilkan dulu sebelum data disimpan.",
  "Kalau masih ada kesalahan, tidak ada satu baris pun yang disimpan. Unduh laporan pemeriksaan dari jendela impor: sel yang salah diberi warna merah beserta penjelasannya.",
  "Baris yang sama dengan data yang sudah ada di aplikasi ditandai \"sudah ada\", dan (kecuali Rundown) bisa dilewati saat impor.",
];

/** Identity pieces joined; null when every piece is empty. */
const id = (...parts: unknown[]) => {
  const t = parts.map((x) => normText(x as never));
  return t.some(Boolean) ? t.join("|") : null;
};

/** URLs compare without scheme case, "www." or a trailing slash. */
const urlId = (u: unknown) =>
  typeof u === "string" && u ? u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "") : null;

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do", aliases: ["Belum", "Belum Mulai", "Todo"] },
  { value: "ongoing", label: "On Going", aliases: ["Berjalan", "Sedang Berjalan", "Proses", "In Progress"] },
  { value: "done", label: "Done", aliases: ["Selesai", "Beres", "Complete", "Completed"] },
  { value: "overtime", label: "Overtime", aliases: ["Terlambat", "Lewat"] },
];

/** The first N divisions that appear as rundown columns (examples only). */
const rundownDivisions = (ctx: ImportContext) =>
  ctx.divisions.filter((d) => !d.exclude_from_rundown);

const divisionLabel = (ctx: ImportContext, i: number, fallback: string) =>
  ctx.divisions[i]?.name ?? fallback;

const member = (ctx: ImportContext, i: number, fallback: string) => ctx.members[i] ?? fallback;

export const MODULE_SPECS: Record<ImportModule, ModuleSpec> = {
  // ---------------- Work Breakdown ----------------
  tasks: {
    module: "tasks",
    title: "Work Breakdown",
    fileName: "template-work-breakdown",
    maxRows: 1000,
    autoColumns: ["No", "Nomor", "Hasil", "Referensi", "Durasi"],
    identity: (v) => (v.title ? id(v.division, v.title) : null),
    columns: () => [
      { key: "division", header: "Divisi", required: true, kind: "division", width: 20, aliases: ["Division"],
        help: "Divisi pemilik tugas: nama, singkatan, atau kode dari sheet Referensi." },
      { key: "title", header: "Judul Tugas", required: true, kind: "text", max: 300, width: 40, aliases: ["Tugas", "Task", "Judul"],
        help: "Nama pekerjaan yang harus dilakukan." },
      { key: "pic", header: "PIC", kind: "text", max: 255, width: 24, aliases: ["Penanggung Jawab", "PJ"], people: true,
        help: "Penanggung jawab. Beberapa orang dipisah koma, mis. Dewi, Raka. Nama yang tidak ada di daftar anggota ditandai sebagai peringatan." },
      { key: "start_date", header: "Tanggal Mulai", kind: "date", width: 16, aliases: ["Mulai", "Start", "Start Date"],
        help: "Kapan tugas mulai dikerjakan." },
      { key: "end_date", header: "Deadline", kind: "date", width: 16, aliases: ["Tenggat", "Tanggal Selesai", "Batas Waktu", "Due Date", "End Date"],
        help: "Batas waktu. Tugas yang lewat deadline dan belum Done otomatis jadi Overtime." },
      { key: "status", header: "Status", kind: "enum", options: STATUS_OPTIONS, width: 14,
        help: "To Do / On Going / Done / Overtime. Kosong = To Do." },
      { key: "notes", header: "Catatan", kind: "longtext", max: 2000, width: 36, aliases: ["Notes", "Keterangan"],
        help: "Catatan bebas untuk tugas ini." },
      { key: "evaluation", header: "Evaluasi", kind: "longtext", max: 2000, width: 36, aliases: ["Evaluation"],
        help: "Pelajaran dari edisi sebelumnya atau edisi ini." },
    ],
    examples: (ctx) => [
      { division: divisionLabel(ctx, 0, "Event"), title: "Susun rundown acara", pic: member(ctx, 0, "Dewi"),
        start_date: "2026-10-01", end_date: "2026-10-07", status: "On Going", notes: "Koordinasi dengan MC", evaluation: "" },
      { division: divisionLabel(ctx, 0, "Event"), title: "Booking ruangan", pic: member(ctx, 1, "Raka"),
        start_date: "2026-10-02", end_date: "2026-10-05", status: "To Do", notes: "", evaluation: "Tahun lalu telat booking" },
      { division: divisionLabel(ctx, 1, "Creative"), title: "Desain poster publikasi", pic: `${member(ctx, 2, "Salsa")}, ${member(ctx, 3, "Bima")}`,
        start_date: "01/10/2026", end_date: "10/10/2026", status: "", notes: "", evaluation: "" },
    ],
    exampleMerges: () => [{ key: "division", row: 0, span: 2 }],
    rules: [
      "Nomor tugas dibuat otomatis per divisi, jadi tidak perlu diisi.",
      "Tautan hasil kerja ditambahkan dari aplikasi setelah impor (setiap tautan hasil otomatis masuk Super Link).",
      "Sel Divisi yang di-merge ke bawah berlaku untuk semua tugas di baris yang digabung.",
    ],
  },

  // ---------------- Reach & Offer ----------------
  prospects: {
    module: "prospects",
    title: "Reach & Offer",
    fileName: "template-reach-and-offer",
    maxRows: 500,
    identity: (v) => (v.org_name ? id("org", v.org_name) : v.contact ? id("contact", v.contact) : null),
    columns: () => [
      { key: "no", header: "No", kind: "text", max: 32, width: 6, help: "Nomor urut bebas (opsional)." },
      { key: "org_name", header: "Nama Ormawa", kind: "text", max: 200, width: 28, aliases: ["Ormawa", "Himpunan", "Organisasi"],
        help: "Nama himpunan / organisasi tujuan. Isi ini atau Kontak." },
      { key: "campus", header: "Kampus", kind: "text", max: 200, width: 22, aliases: ["Universitas", "Campus"],
        help: "Kampus asal ormawa." },
      { key: "location", header: "Lokasi", kind: "text", max: 200, width: 18, aliases: ["Kota", "Location"],
        help: "Kota atau alamat singkat." },
      { key: "contact", header: "Kontak", kind: "text", max: 200, width: 24, aliases: ["Contact", "CP", "Narahubung", "No HP", "Nomor HP", "WA"], phone: true,
        help: "Nama dan/atau nomor narahubung. Isi ini atau Nama Ormawa." },
      { key: "date_text", header: "Tanggal", kind: "text", max: 60, width: 14, aliases: ["Tanggal Kontak", "Date"],
        help: "Tanggal kontak, ditulis bebas (mis. 12 Sep)." },
      { key: "month", header: "Bulan", kind: "text", max: 40, width: 12, aliases: ["Month"],
        help: "Bulan rencana kunjungan (opsional)." },
      { key: "mode", header: "Mode", kind: "enum", width: 12,
        options: [
          { value: "offline", label: "Offline", aliases: ["Luring", "Tatap Muka"] },
          { value: "online", label: "Online", aliases: ["Daring", "Virtual"] },
        ],
        help: "Offline atau Online." },
      { key: "pic", header: "PIC", kind: "text", max: 200, width: 18, aliases: ["Penanggung Jawab"], people: true,
        help: "Anggota yang memegang prospek ini." },
      { key: "contact_status", header: "Status Kontak", kind: "enum", width: 16,
        options: [
          { value: "MENGHUBUNGI", label: "MENGHUBUNGI", aliases: ["Kita menghubungi"] },
          { value: "DIHUBUNGI", label: "DIHUBUNGI", aliases: ["Dihubungi mereka"] },
        ],
        help: "MENGHUBUNGI (kita yang menghubungi) atau DIHUBUNGI (mereka yang menghubungi)." },
      { key: "their_response", header: "Respon Mereka", kind: "enum", width: 16,
        options: [
          { value: "DITUNGGU", label: "DITUNGGU", aliases: ["Menunggu"] },
          { value: "DITERIMA", label: "DITERIMA", aliases: ["Diterima"] },
          { value: "DITOLAK", label: "DITOLAK", aliases: ["Ditolak"] },
        ],
        help: "Jawaban mereka atas ajakan kita." },
      { key: "our_response", header: "Respon Kita", kind: "enum", width: 14,
        options: [
          { value: "TUNGGU", label: "TUNGGU" },
          { value: "TERIMA", label: "TERIMA" },
          { value: "TOLAK", label: "TOLAK" },
        ],
        help: "Jawaban kita atas ajakan mereka." },
      { key: "done", header: "Selesai", kind: "bool", width: 10, aliases: ["Done"],
        help: "Ya jika prospek sudah tuntas. Kosong = Tidak." },
      { key: "notes", header: "Catatan", kind: "longtext", max: 2000, width: 32, aliases: ["Notes", "Keterangan"],
        help: "Catatan bebas." },
    ],
    examples: () => [
      { no: "1", org_name: "HMTI Universitas Contoh", campus: "Universitas Contoh", location: "Surabaya", contact: "Andi (0812xxxx)",
        date_text: "12 Sep", month: "Oktober", mode: "Offline", pic: "Dewi", contact_status: "MENGHUBUNGI",
        their_response: "DITERIMA", our_response: "", done: "Ya", notes: "Siap kunjungan minggu kedua" },
      { no: "2", org_name: "KBMSI Kampus Lain", campus: "Kampus Lain", location: "Malang", contact: "",
        date_text: "15 Sep", month: "", mode: "Online", pic: "Raka", contact_status: "DIHUBUNGI",
        their_response: "", our_response: "TUNGGU", done: "", notes: "" },
    ],
    rules: [
      "Setiap baris wajib punya Nama Ormawa atau Kontak (minimal salah satu).",
      "Tautan (proposal, profil ormawa) ditambahkan dari aplikasi setelah impor.",
      "Status Kontak, Respon Mereka, dan Respon Kita memakai kata yang sama dengan di aplikasi (huruf besar).",
      "Nomor HP yang kehilangan angka 0 di depan (karena Excel menganggapnya angka) otomatis diperbaiki.",
    ],
  },

  // ---------------- Super Link ----------------
  links: {
    module: "links",
    title: "Super Link",
    fileName: "template-super-link",
    maxRows: 1000,
    autoColumns: ["No", "Sumber"],
    identity: (v) => urlId(v.url),
    columns: () => [
      { key: "section", header: "Bagian", kind: "text", max: 200, width: 22, aliases: ["Kelompok", "Section", "Kategori"],
        help: "Kelompok tautan (mis. Proposal, Dokumentasi). Boleh di-merge ke bawah." },
      { key: "division", header: "Divisi", kind: "division", width: 18, aliases: ["Division"],
        help: "Divisi pemilik tautan (opsional)." },
      { key: "name", header: "Nama Tautan", required: true, kind: "text", max: 200, width: 32, aliases: ["Nama", "Judul", "Name"],
        help: "Nama dokumen / tautan." },
      { key: "url", header: "URL", required: true, kind: "url", max: 2000, width: 44, aliases: ["Link", "Tautan", "Alamat"],
        help: "Alamat lengkap, diawali https://." },
      { key: "note", header: "Catatan", kind: "longtext", max: 1000, width: 30, aliases: ["Keterangan", "Note"],
        help: "Catatan bebas (opsional)." },
    ],
    examples: (ctx) => [
      { section: "Proposal", division: divisionLabel(ctx, 0, "Event"), name: "Proposal Ormawa Visit", url: "https://drive.google.com/contoh-proposal", note: "Versi final" },
      { section: "Proposal", division: divisionLabel(ctx, 0, "Event"), name: "Surat Undangan", url: "https://docs.google.com/contoh-surat", note: "" },
      { section: "Dokumentasi", division: divisionLabel(ctx, 1, "Creative"), name: "Folder Foto", url: "https://drive.google.com/contoh-foto", note: "" },
    ],
    exampleMerges: () => [{ key: "section", row: 0, span: 2 }],
    rules: [
      "URL wajib berupa tautan yang valid. Tautan tanpa https:// akan dilengkapi otomatis.",
      "Tautan hasil kerja dari Work Breakdown tidak perlu diimpor di sini: tautan itu masuk Super Link sendiri.",
    ],
  },

  // ---------------- Budget (RAB) ----------------
  budget: {
    module: "budget",
    title: "Budget (RAB)",
    fileName: "template-budget-rab",
    maxRows: 1000,
    autoColumns: ["No", "Subtotal"],
    identity: (v) => (v.name ? id(v.category, v.name) : null),
    target: { label: "Rencana anggaran tujuan", help: "Item akan ditambahkan ke rencana anggaran ini." },
    columns: () => [
      { key: "category", header: "Kategori", required: true, kind: "text", max: 120, width: 20, aliases: ["Category"],
        help: "Kelompok item (mis. KONSUMSI). Boleh di-merge ke bawah untuk beberapa item." },
      { key: "name", header: "Nama Item", required: true, kind: "text", max: 200, width: 32, aliases: ["Item", "Nama"],
        help: "Nama barang / jasa." },
      { key: "qty", header: "Qty", kind: "number", width: 8, aliases: ["Jumlah", "Kuantitas", "Quantity"],
        help: "Jumlah (angka)." },
      { key: "unit", header: "Satuan", kind: "text", max: 60, width: 10, aliases: ["Unit"],
        help: "Satuan (pcs, box, orang, ...)." },
      { key: "unit_price", header: "Harga Satuan", kind: "number", width: 16, aliases: ["Harga", "Unit Price"],
        help: "Harga per satuan dalam Rupiah. Boleh ditulis 15000 atau Rp 15.000." },
      { key: "total", header: "Total", kind: "number", width: 16,
        help: "Dihitung otomatis (Qty x Harga Satuan). Tidak ikut diimpor, aplikasi menghitung ulang.",
        formula: (cell) => `IF(AND(ISNUMBER(${cell("qty")}),ISNUMBER(${cell("unit_price")})),${cell("qty")}*${cell("unit_price")},"")` },
      { key: "category_color", header: "Warna Kategori", kind: "color", width: 14, aliases: ["Warna", "Color"],
        help: "Kode warna hex untuk titik kategori (opsional), mis. #f97316." },
    ],
    examples: () => [
      { category: "KONSUMSI", name: "Snack peserta", qty: 60, unit: "box", unit_price: 15000, category_color: "#f97316" },
      { category: "KONSUMSI", name: "Air mineral", qty: 5, unit: "dus", unit_price: 45000, category_color: "" },
      { category: "PERLENGKAPAN", name: "Banner acara", qty: 1, unit: "pcs", unit_price: "Rp 150.000", category_color: "" },
    ],
    exampleMerges: () => [{ key: "category", row: 0, span: 2 }],
    rules: [
      "Pilih rencana anggaran tujuan di jendela impor sebelum mengunggah file.",
      "Kolom Total hanya bantuan hitung di Excel; aplikasi selalu menghitung Qty x Harga Satuan sendiri.",
      "Warna kategori berlaku untuk seluruh item di kategori yang sama pada rencana itu.",
    ],
  },

  // ---------------- Rundown ----------------
  rundown: {
    module: "rundown",
    title: "Rundown Acara",
    fileName: "template-rundown",
    maxRows: 300,
    autoColumns: ["No", "Durasi"],
    canSkipExisting: false,
    identity: (v) => (v.activity ? id(v.time_start ?? String(v.time_range ?? "").split("-")[0], v.activity) : null),
    columns: (ctx) => [
      { key: "time_start", header: "Waktu Mulai", kind: "time", width: 12, aliases: ["Mulai", "Start", "Jam Mulai"],
        help: "Jam mulai, mis. 08.00." },
      { key: "time_end", header: "Waktu Selesai", kind: "time", width: 12, aliases: ["Selesai", "End", "Jam Selesai"],
        help: "Jam selesai, mis. 08.30. Durasi dihitung otomatis." },
      { key: "time_range", header: "Waktu", kind: "timerange", uploadOnly: true, aliases: ["Jam", "Pukul"],
        help: "Rentang jam dalam satu sel, mis. 08.00 - 08.30 (dari sheet rundown lama). Dipakai bila Waktu Mulai/Selesai kosong." },
      { key: "activity", header: "Kegiatan", required: true, kind: "longtext", max: 500, width: 32, aliases: ["Acara", "Activity", "Agenda"],
        help: "Nama sesi / kegiatan." },
      { key: "mc", header: "MC", kind: "longtext", max: 300, width: 20, merge: "span",
        help: "Petugas / naskah MC. Merge ke bawah = satu sel yang membentang beberapa sesi." },
      { key: "operator", header: "Kebutuhan Operator", kind: "longtext", max: 500, width: 26, merge: "span", aliases: ["Operator"],
        help: "Kebutuhan operator (slide, musik, tautan). Merge ke bawah = membentang beberapa sesi." },
      ...rundownDivisions(ctx).map<ColumnSpec>((d) => ({
        key: `job:${d.key}`,
        header: d.short || d.name,
        aliases: [d.name, d.key],
        kind: "longtext",
        max: 1000,
        width: 22,
        merge: "span",
        help: `Tugas divisi ${d.name} pada sesi ini. Merge ke bawah = satu tugas yang membentang beberapa sesi.`,
      })),
      { key: "keterangan", header: "Catatan", kind: "longtext", max: 1000, width: 28, aliases: ["Keterangan", "Notes"],
        help: "Catatan per sesi (tidak bisa di-merge)." },
    ],
    examples: (ctx) => {
      const [a, b] = rundownDivisions(ctx);
      const job = (d: typeof a | undefined, v: string) => (d ? { [`job:${d.key}`]: v } : {});
      return [
        { time_start: "07.30", time_end: "08.00", activity: "Registrasi peserta", mc: "", operator: "Musik latar",
          ...job(a, "Jaga meja registrasi"), ...job(b, "Dokumentasi"), keterangan: "" },
        { time_start: "08.00", time_end: "08.15", activity: "Pembukaan", mc: "Dewi & Raka", operator: "Slide pembuka",
          ...job(a, "Siapkan panggung"), ...job(b, "Dokumentasi"), keterangan: "" },
        { time_start: "08.15", time_end: "08.30", activity: "Sambutan Ketua", mc: "", operator: "Mic podium",
          ...job(a, ""), ...job(b, ""), keterangan: "Maks. 10 menit" },
        { time_start: "08.30", time_end: "10.00", activity: "Sesi FGD", mc: "Dewi", operator: "https://contoh.link/slide-fgd",
          ...job(a, "Fasilitator ruangan"), ...job(b, "Live report"), keterangan: "" },
      ];
    },
    exampleMerges: (ctx) => {
      const [a, b] = rundownDivisions(ctx);
      return [
        { key: "mc", row: 1, span: 2 },
        ...(a ? [{ key: `job:${a.key}`, row: 1, span: 2 }] : []),
        ...(b ? [{ key: `job:${b.key}`, row: 0, span: 3 }] : []),
      ];
    },
    rules: [
      "Kolom divisi di template mengikuti divisi Ormawa Visit yang sedang aktif (divisi yang dikecualikan dari rundown tidak punya kolom).",
      "Merge (gabung) sel ke bawah pada kolom MC, Kebutuhan Operator, dan kolom divisi TETAP menjadi sel gabungan di aplikasi, sama seperti tombol \"Gabung dengan baris di bawah\".",
      "Kolom Catatan tidak bisa di-merge: isinya berlaku per baris.",
      "Durasi dihitung otomatis dari Waktu Mulai dan Waktu Selesai. Tulis jam sebagai 08.00 (template sudah memformat kolomnya sebagai teks).",
      "Sheet rundown lama yang memakai satu kolom \"Waktu\" berisi 08.00 - 08.30 juga bisa diimpor langsung.",
      "Baris yang sudah ada di rundown tidak bisa dilewati saat impor (supaya sel gabungan tidak bergeser); hapus dulu barisnya dari file bila perlu.",
      "Baris hasil impor ditambahkan di bawah rundown yang sudah ada, sesuai urutan di file.",
    ],
  },

  // ---------------- Job Desc Hari-H ----------------
  jobs: {
    module: "jobs",
    title: "Job Desc Hari-H",
    fileName: "template-jobdesc-hari-h",
    maxRows: 500,
    autoColumns: ["No"],
    identity: (v) => (v.job ? id(v.pic, v.job) : null),
    columns: () => [
      { key: "pic", header: "PIC", kind: "text", max: 300, width: 24, aliases: ["Penanggung Jawab", "Nama"], people: true,
        help: "Siapa yang bertugas. Beberapa orang dipisah koma. Boleh di-merge ke bawah." },
      { key: "job", header: "Tugas", required: true, kind: "longtext", max: 500, width: 40, aliases: ["Job", "Deskripsi Tugas", "Jobdesc"],
        help: "Apa yang dikerjakan pada hari-H." },
      { key: "notes", header: "Catatan", kind: "longtext", max: 2000, width: 32, aliases: ["Keterangan", "Notes"],
        help: "Catatan bebas." },
    ],
    examples: (ctx) => [
      { pic: member(ctx, 0, "Dewi"), job: "Menyambut tamu di lobi", notes: "Datang 06.30" },
      { pic: member(ctx, 0, "Dewi"), job: "Mengarahkan tamu ke ruang FGD", notes: "" },
      { pic: member(ctx, 1, "Raka"), job: "Operator slide dan sound", notes: "Cek mic sebelum acara" },
    ],
    exampleMerges: () => [{ key: "pic", row: 0, span: 2 }],
    rules: [
      "Nomor urut dibuat otomatis dan bisa diatur ulang dengan drag di aplikasi.",
      "PIC yang di-merge ke bawah berlaku untuk setiap tugas di baris yang digabung.",
    ],
  },

  // ---------------- Anggota EA ----------------
  members: {
    module: "members",
    title: "Anggota EA",
    fileName: "template-anggota",
    maxRows: 500,
    autoColumns: ["No"],
    identity: (v) => (v.name ? id(v.name) : null),
    columns: () => [
      { key: "name", header: "Nama Lengkap", required: true, kind: "text", max: 200, width: 28, aliases: ["Nama", "Name"],
        help: "Nama lengkap. Tidak boleh mengandung koma." },
      { key: "nickname", header: "Nama Panggilan", kind: "text", max: 120, width: 16, aliases: ["Panggilan", "Nickname"],
        help: "Nama panggilan (opsional, tanpa koma)." },
      { key: "nrp", header: "NRP", kind: "text", max: 40, width: 14, aliases: ["NIM"],
        help: "Nomor induk mahasiswa. Angkatan diisi otomatis dari NRP bila kolom Angkatan kosong." },
      { key: "divisions", header: "Divisi", required: true, kind: "divisions", width: 22, aliases: ["Division"],
        help: "Satu divisi atau lebih, dipisah koma (mis. Event, Creative)." },
      { key: "type", header: "Tipe", kind: "enum", width: 14, aliases: ["Jenis", "Type"],
        options: [
          { value: "fungsionaris", label: "Fungsionaris", aliases: ["Staff", "Staf"] },
          { value: "intern", label: "Intern", aliases: ["Magang"] },
        ],
        help: "Fungsionaris atau Intern. Kosong = Fungsionaris." },
      { key: "year", header: "Angkatan", kind: "year", width: 10, aliases: ["Tahun", "Year"],
        help: "Tahun angkatan, mis. 2023." },
    ],
    examples: (ctx) => [
      { name: "Dewi Anggraini", nickname: "Dewi", nrp: "5026231001", divisions: divisionLabel(ctx, 0, "Event"), type: "Fungsionaris", year: 2023 },
      { name: "Raka Pratama", nickname: "Raka", nrp: "5026241002", divisions: `${divisionLabel(ctx, 0, "Event")}, ${divisionLabel(ctx, 1, "Creative")}`, type: "Intern", year: "" },
    ],
    rules: [
      "Anggota diimpor ke Ormawa Visit yang sedang aktif.",
      "Nama tidak boleh mengandung koma, karena daftar PIC di menu lain dipisah dengan koma.",
      "Anggota dengan nama yang sama dengan anggota yang sudah ada ditandai \"sudah ada\" dan bisa dilewati.",
      "Satu anggota boleh masuk beberapa divisi; divisi pertama menjadi divisi utama.",
    ],
  },

  // ---------------- Himpunan: FGD ----------------
  fgd: {
    module: "fgd",
    title: "Himpunan - Plotting FGD",
    fileName: "template-plotting-fgd",
    maxRows: 100,
    autoColumns: ["No"],
    identity: (v) => (v.ours ? id(v.ours, v.theirs) : null),
    target: { label: "Tabel FGD tujuan", help: "Baris akan ditambahkan ke tabel plotting ini." },
    columns: () => [
      { key: "ours", header: "Departemen HMSI", required: true, kind: "text", max: 160, width: 30, aliases: ["HMSI", "Departemen Kita"],
        help: "Departemen HMSI ITS." },
      { key: "theirs", header: "Departemen Partner", kind: "text", max: 160, width: 30, aliases: ["Partner", "Departemen Mereka"],
        help: "Departemen pasangannya di himpunan partner." },
    ],
    examples: () => [
      { ours: "Eksternal", theirs: "Hubungan Luar" },
      { ours: "Internal", theirs: "Kaderisasi" },
      { ours: "Minat Bakat", theirs: "PSDM" },
    ],
    rules: [
      "Pilih tabel FGD tujuan di jendela impor. Baris baru ditambahkan di bawah baris yang sudah ada.",
    ],
  },

  // ---------------- Himpunan: Compare ----------------
  compare: {
    module: "compare",
    title: "Himpunan - Compare",
    fileName: "template-compare",
    maxRows: 300,
    identity: (v) => (v.aspect ? id(v.section, v.aspect) : null),
    target: { label: "Himpunan yang dinilai", help: "Aspek penilaian akan ditambahkan ke himpunan ini." },
    columns: () => [
      { key: "section", header: "Bagian", kind: "text", max: 200, width: 28, aliases: ["Kelompok", "Section"],
        help: "Judul kelompok aspek (mis. A. ASPEK PELAKSANAAN). Boleh di-merge ke bawah." },
      { key: "no", header: "No", kind: "text", max: 16, width: 6, help: "Nomor aspek seperti di sumbernya (opsional)." },
      { key: "aspect", header: "Aspek Penilaian", required: true, kind: "text", max: 200, width: 30, aliases: ["Aspek", "Aspect"],
        help: "Aspek yang dinilai." },
      { key: "indicator", header: "Indikator yang Dinilai", kind: "longtext", max: 500, width: 36, aliases: ["Indikator", "Indicator"],
        help: "Apa yang diperhatikan pada aspek ini." },
      { key: "plus", header: "Plus / Kelebihan", kind: "longtext", max: 2000, width: 36, aliases: ["Plus", "Kelebihan"],
        help: "Kelebihan himpunan ini pada aspek tersebut." },
      { key: "minus", header: "Minus / Kekurangan", kind: "longtext", max: 2000, width: 36, aliases: ["Minus", "Kekurangan"],
        help: "Kekurangan himpunan ini pada aspek tersebut." },
    ],
    examples: () => [
      { section: "A. ASPEK PELAKSANAAN", no: "1", aspect: "Kesiapan panitia", indicator: "Pembagian tugas jelas", plus: "Semua PIC hadir tepat waktu", minus: "" },
      { section: "A. ASPEK PELAKSANAAN", no: "2", aspect: "Ketepatan waktu", indicator: "Rundown berjalan sesuai jadwal", plus: "", minus: "Mundur 20 menit" },
      { section: "B. ASPEK KEORGANISASIAN", no: "3", aspect: "Struktur organisasi", indicator: "Kejelasan alur koordinasi", plus: "Rapi dan terdokumentasi", minus: "" },
    ],
    exampleMerges: () => [{ key: "section", row: 0, span: 2 }],
    rules: [
      "Pilih himpunan yang dinilai di jendela impor.",
      "Sel Bagian yang di-merge ke bawah berlaku untuk setiap aspek di baris yang digabung.",
    ],
  },
};

export function specFor(module: ImportModule): ModuleSpec {
  return MODULE_SPECS[module];
}
