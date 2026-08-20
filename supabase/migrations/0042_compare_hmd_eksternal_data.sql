-- ============================================================
-- Data Compare untuk Ormawa Visit "HMSI ITS x HMD Eksternal" (ov2-2026).
--
-- DIBUAT OLEH SKRIP: scripts/gen-compare-seed.mjs, dari dua spreadsheet
-- benchmarking milik External Affairs. Jangan disunting dengan tangan - jalankan
-- ulang skripnya kalau sumbernya berubah.
--
-- Idempoten: subjek dipasang dengan on conflict do nothing, dan penilaiannya
-- dihapus lebih dulu per subjek supaya menjalankan ulang tidak menggandakan.
-- Penilaian buatan tangan pada subjek LAIN tidak tersentuh.
-- ============================================================

do $do$
declare
  v_subject uuid;
begin
  if to_regclass('public.compare_subjects') is null then
    raise notice 'compare_subjects belum ada, jalankan 0041 dulu. Dilewati.';
    return;
  end if;
  if not exists (select 1 from events where id = 'ov2-2026') then
    raise notice 'Ormawa Visit ov2-2026 tidak ada di database ini. Dilewati.';
    return;
  end if;

  -- ---------------- HMTI UNS (14 penilaian) ----------------
  insert into compare_subjects (event_id, org_name, "order")
  values ('ov2-2026', 'HMTI UNS', 0)
  on conflict do nothing;

  select id into v_subject from compare_subjects
   where event_id = 'ov2-2026' and lower(btrim(org_name)) = lower('HMTI UNS');

  delete from compare_entries where subject_id = v_subject;
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '1', 'A. ASPEK PELAKSANAAN KEGIATAN BENCHMARKING', 'Pemetaan Partner FGD', 'Kesesuaian pasangan bidang HMSI–HMTI', 'Pembagian pasangan antarb idang cukup relevan, seperti EB ↔ Presidium, EA ↔ Eksternal, dan HRD ↔ HRD, sehingga diskusi dapat lebih fokus dan aplikatif.', 'Penggabungan IA (22 orang), MnB (13 orang), dan HI (8 orang) menghasilkan total 43 peserta dalam satu FGD, sehingga jumlah peserta cukup besar dan berpotensi membuat diskusi kurang efektif serta tidak semua peserta dapat berpartisipasi secara optimal.', 0);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '2', 'A. ASPEK PELAKSANAAN KEGIATAN BENCHMARKING', 'Logistik & Tempat', 'Kesiapan ruang FGD dari HMTI', 'Ruang FGD telah dialokasikan berdasarkan bidang, baik secara komunal per prodi maupun di Warjaw, sehingga HMSI dapat menyesuaikan dengan pembagian yang telah tersedia.', 'Belum terdapat informasi detail mengenai kapasitas masing-masing ruang FGD', 1);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '3', 'A. ASPEK PELAKSANAAN KEGIATAN BENCHMARKING', 'Rundown & Susunan Acara', 'Kelengkapan agenda dari sambutan hingga penutupan', 'Rundown telah tersusun secara lengkap, mulai dari mars himpunan, sambutan resmi, pemaparan materi, ice breaking, hingga pemberian sertifikat dan plakat. Apabila kekurangan waktu peminjaman ruangan dilakukan hingga jam 4', '', 2);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '4', 'A. ASPEK PELAKSANAAN KEGIATAN BENCHMARKING', 'Kuota & Kapasitas Peserta', 'Kesesuaian kuota dengan jumlah fungsionaris HMSI', 'Kapasitas total yang tersedia (180 kursi)', 'Kapasitas total yang tersedia 180 kursi, dimana 95 digunakan oleh HMTI, sehingga kuota yang tersedia hanya sekitar 85 orang.', 3);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '5', 'A. ASPEK PELAKSANAAN KEGIATAN BENCHMARKING', 'Koordinasi Teknis (PIC)', 'Kejelasan penanggung jawab setiap sie', 'Terdapat PIC yang jelas dari kedua pihak untuk setiap sie, khususnya acara dan logistik, sehingga koordinasi teknis di lapangan lebih mudah dilakukan.', '', 4);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '6', 'A. ASPEK PELAKSANAAN KEGIATAN BENCHMARKING', 'Perjalanan & Waktu Pelaksanaan', 'Estimasi waktu perjalanan dan kepadatan jadwal', '', 'Rangkaian kegiatan cukup padat, dengan keberangkatan sekitar pukul 06.00–07.00, waktu tempuh 3–4 jam, pelaksanaan kegiatan hingga sekitar 14.45 (bisa lebih), dan perjalanan pulang selama 3–4 jam.', 5);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '7', 'A. ASPEK PELAKSANAAN KEGIATAN BENCHMARKING', 'Interaksi Antar Peserta', 'Cakupan partisipasi dalam sesi games/ice breaking', '', 'Sesi games/ice breaking dari pihak HMTI hanya melibatkan perwakilan peserta, sehingga kesempatan untuk membangun interaksi antarfungsionaris dari kedua himpunan menjadi kurang merata (akan didiskusikan kembali)', 6);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '8', 'A. ASPEK PELAKSANAAN KEGIATAN BENCHMARKING', 'Pengaturan Tempat Duduk', 'Kesesuaian skema tempat duduk dengan pembagian FGD', '', 'Pada HMTI biasanya engaturan tempat duduk masih dipisahkan berdasarkan masing-masing himpunan dan belum disesuaikan dengan partner FGD, sehingga interaksi antarpeserta dapat kurang membaur pada sesi awal.', 7);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '9', 'A. ASPEK PELAKSANAAN KEGIATAN BENCHMARKING', 'Konsumsi', 'Koordinasi pengadaan makanan dan minuman', 'Pengadaan konsumsi dilakukan secara terpisah oleh masing-masing pihak, meliputi makanan berat, snack FGD, dan galon', '', 8);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '10', 'B. ASPEK PROKER / DEPARTEMEN', 'Wacana & Diskusi Isu Sosial', 'Proker SOCDEV HMSI', 'HMSI belum memiliki wadah khusus untuk diskusi dan edukasi isu sosial seperti Sosma Scope. Program SOCDEV lebih berfokus pada aksi langsung dibandingkan diskusi atau pengkajian isu sosial.', 'HMSI lebih unggul dalam program aksi sosial berbasis kurikulum, seperti SIMETRI yang memberikan edukasi IT kepada siswa SMA dengan RPP resmi serta ASIK yang memberikan pelatihan kepada mentor sebelum pelaksanaan.', 9);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '11', 'B. ASPEK PROKER / DEPARTEMEN', 'Internasionalisasi & Bahasa Asing', 'Proker EA', '', 'Belum ditemukan program HMTI yang secara khusus berfokus pada internasionalisasi, seperti abroad, exchange, atau global exposure, berdasarkan penelusuran Handbook HMTI 2026.', 10);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '13', 'B. ASPEK PROKER / DEPARTEMEN', 'Seremoni Kelulusan & Suporter Atlet', 'Proker IA', '', 'HMTI belum memiliki kegiatan kelulusan formal yang setara. Congraduation lebih berfokus pada publikasi melalui media sosial, sementara MnB HMTI juga belum memiliki komunitas suporter khusus.', 11);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '14', 'B. ASPEK PROKER / DEPARTEMEN', 'Dukungan Akademik Berkelanjutan', 'RnD Library + Class 101 + Sharing TA HMTI vs. proker RTA HMSI', 'HMSI belum memiliki dukungan akademik yang berjenjang dari semester awal hingga akhir studi, seperti arsip meteri RnD Library, workshop tugas besar melalui Class 101, atau pendampingan tugas akhir melalui Sharing TA.', '', 12);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UNS', '15', 'B. ASPEK PROKER / DEPARTEMEN', 'Persiapan Karier Mahasiswa', 'Career Preparation HMSI vs. proker HRD–Internal HMTI', '', 'HMTI belum memiliki program yang secara khusus berfokus pada persiapan karier mahasiswa. Program HRD Internal lebih berfokus pada evaluasi dan pengembangan internal pengurus.', 13);

  -- ---------------- HMTI UB (17 penilaian) ----------------
  insert into compare_subjects (event_id, org_name, "order")
  values ('ov2-2026', 'HMTI UB', 1)
  on conflict do nothing;

  select id into v_subject from compare_subjects
   where event_id = 'ov2-2026' and lower(btrim(org_name)) = lower('HMTI UB');

  delete from compare_entries where subject_id = v_subject;
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '1', '', 'Jarak & Aksesibilitas', 'Jarak HMSI ITS HMTI UB, kondisi akses jalan, kemudahan bus/transportasi', 'Surabaya–Malang masih relatif mudah dijangkau dan menggunakan tol', 'Jarak ±93 km sekali jalan (±186 km PP), sehingga membutuhkan waktu perjalanan yang cukup besar', 0);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '2', '', 'Estimasi Waktu Perjalanan', 'Durasi perjalanan berangkat dan pulang', 'Estimasi perjalanan darat ±2,5–3jam sekali jalan sehingga masih feasible untuk studi banding', 'Total waktu perjalanan pulang-pergi dapat mencapai ±5–7 jam dan mengurangi waktu efektif kegiatan', 1);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '3', '', 'Biaya Transportasi', 'Sewa bus, BBM, tol, parkir, konsumsi perjalanan', 'Bisa menggunakan 1-2 bus bersama sehingga lebih mudah mengatur peserta.', 'Harus menyesuaikan dengan jumlah peserta', 2);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '4', '', 'Akomodasi', 'Kebutuhan menginap, hotel/guest house, konsumsi', 'Untuk OV tidak membutuhkan menginap apabila hanya dilakuakan studi banding, mengurangi biaya penginapan, namun bila di tambah dengan internalisasi akan membutuhkan akomodasi penginapan', 'Jika hanya satu hari, perjalanan cukup melelahkan; jika menginap, budget meningkat', 3);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '5', '', 'Kesesuaian Struktur Organisasi', 'Kemiripan departemen/divisi HMSI ITS dan HMTI UB', 'Mayoritas departemen HMSI yang punya counterpart yang cukup sesuai di HMTI UB.', 'Struktur organisasi tidak sepenuhnya sama, jadi tidak semua departemen bisa langsung dipasangkan 1:1.', 4);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '6', '', 'Kebutuhan Splitting Plotting', 'Jumlah departemen HMTI yang harus dibagi ke beberapa departemen HMSI', 'Beberapa departemen bisa langsung dipasangkan, seperti EA–External Relation dan ES–Business & Entrepreneurship', 'Menambah kompleksitas teknis plotting dan berpotensi membuat peserta bingung', 5);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '7', '', 'Relevansi Program Kerja', 'Kesamaan jenis proker, output, target peserta, dan metode pelaksanaan', 'banyak hal yg bs diambil sebagai benchmark program kerja yang dapat diadaptasi HMSI ITS', 'Ada beberapa departemen yang harus dipecah atau digabung agar bisa match dengan struktur HMTI UB', 6);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '8', '', 'Kesesuaian Kebutuhan HMSI ITS', 'Apakah topik yang dibahas menjawab kebutuhan/problem HMSI ITS', 'Studi banding lebih terarah dan tidak sekadar sharing biasa aja', 'Jika plotting terlalu luas, pembahasan dapat menjadi dangkal (seperti 2 departemen hmti di gabung dengan 1 departemen hmsi), perlu dipastikan jumlah per deaprtemen yang akan ikut baik itu hmsi dan hmti', 7);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '9', '', 'Kualitas Knowledge Sharing', 'Kedalaman materi, pengalaman pengurus, best practice', 'Potensi memperoleh benchmark nyata dari HMTI UB', 'Kalau terlalu banyak departemen dalam satu sesi, waktu sharing bisa menjadi terlalu singkat.', 8);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '10', '', 'Interaksi & Networking', 'Kesempatan membangun relasi antaranggota/departemen', 'Bisa memperluas relasi HMSI ITS dengan HMTI UB dan membuka peluang kolaborasi ke depannya.', 'Kalau rundown terlalu padat, waktu fgd maupun ngobrol santai bisa sedikit', 9);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '11', '', 'Agenda & Manajemen Waktu', 'Durasi perjalanan, pembukaan, sharing, diskusi, campus tour, networking', 'Kegiatan bisa dibuat lebih terarah', 'membuat rundown harus lebih detail dan waktu tiap sesi harus benar-benar diatur karena harus memikirkan waktu perjalnan pulang', 10);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '12', '', 'Venue', 'Kapasitas ruangan, pembagian ruang, fasilitas presentasi', 'HMTI UB dapat memberikan fasilitas ruangan (namun untuk daya tampung nya belum didiskusikan)', '', 11);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '13', '', 'Konsumsi', 'Jumlah peserta, jadwal makan, snack, konsumsi perjalanan', 'Mudah direncanakan jika jumlah peserta sudah ditentukan', 'Perjalanan panjang membutuhkan persiapan konsumsi dari surabaya', 12);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '14', '', 'Administrasi & Koordinasi', 'Surat-menyurat, PIC, konfirmasi peserta, rundown', 'Dapat dibagi antara panitia HMSI dan counterpart HMTI', 'Koordinasi menjadi lebih kompleks karena banyak pasangan departemen', 13);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '15', '', 'Kapasitas Peserta', 'Jumlah delegasi dibandingkan kapasitas counterpart', 'Peserta bisa dibagi berdasarkan departemen masing-masing sehingga tidak ketimpangan jumlah dengan departemen hmti', 'Jika jumlah peserta HMSI terlalu sedikit, diskusi kurang intensif', 14);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '16', '', 'Follow-up', 'Implementasi insight setelah studi banding', 'Hasil studi banding dapat menjadi rekomendasi/perbaikan proker HMSI', 'Kalau tidak ada tindak lanjut, hasil studi banding bisa hanya berhenti sebagai sharing tanpa diterapkan.', 15);
  insert into compare_entries (event_id, subject_id, org_name, "no", section, aspect, indicator, plus, minus, "order")
  values ('ov2-2026', v_subject, 'HMTI UB', '17', '', 'Risiko & Contingency', 'Keterlambatan bus, kemacetan, perubahan jadwal, ketidakhadiran counterpart', 'Risiko dapat diminimalkan dengan buffer time dan PIC', 'Perjalanan Surabaya–Malang memiliki risiko keterlambatan', 16);
end $do$;

-- Verifikasi.
select s.org_name, count(e.id) as penilaian
  from compare_subjects s
  left join compare_entries e on e.subject_id = s.id
 where s.event_id = 'ov2-2026'
 group by s.org_name
 order by s.org_name;
