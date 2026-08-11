-- ============================================================
-- 0032 - Super Link diperbarui dari Main Sheet (Excel), 2026-07-29.
--
-- Sumber: "MAIN SHEET ORMAWA VISIT.xlsx" + "ORMAWA VISIT 2026.xlsx".
-- Hanya baris yang PUNYA URL http(s) sungguhan yang diambil (87 dari
-- 141 baris di sheet). Baris tanpa tautan dilewati -
-- di spreadsheet aslinya memang masih kosong.
--
-- Cara kerja: UPSERT berdasarkan (event_id, section, name).
--   * Nama yang sudah ada -> url & note-nya DIPERBARUI.
--   * Nama baru           -> ditambahkan.
--   * Baris buatan tangan di aplikasi (source = 'manual') TIDAK disentuh.
-- Aman dijalankan berulang: menjalankan dua kali menghasilkan keadaan yang sama.
--
-- Daftar tautannya ditulis ulang sebagai CTE di kedua statement, BUKAN ditaruh
-- di tabel sementara: tabel sementara hanya hidup di satu sesi, sedangkan SQL
-- editor Supabase lewat connection pooler - statement kedua bisa mendarat di
-- koneksi lain dan gagal dengan "relation does not exist".
--
-- Jalankan SETELAH 0031.
-- ============================================================

begin;

-- 1) Perbarui tautan yang namanya sudah ada di edisi yang sama.
with sheet_links (event_id, section, division, name, url, note) as (
  values
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'PROPOSAL ORMAWA VISIT', 'https://docs.google.com/document/d/1b75NR8Zz9kYUS9yqX_AQG4_9LamQsFxTogMmOlrjW5k/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'GFORM MINAT DIVISI INTERN', 'https://forms.gle/J9YC8jnSXFcdj7iz5', 'Hasilnya disini: https://docs.google.com/spreadsheets/d/1wnX0_EY_fxKE9B0fcwIO0OaJrlhnYfi3v6mtm83pudI/edit?usp=sharing'),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'PPT PROGRESS', 'https://docs.google.com/presentation/d/1AE4xw1yNSYSZPs1OVeE-1oQ37ssA3Mx4pZZwF_J3BBQ/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'TEMPLATE REQUEST DIVISI', 'https://docs.google.com/spreadsheets/d/1SLPJuXNd2OXLpPE3kvo9zxwqUMGjo-0RzX3h9s_aWcw/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'SPREADSHEET DAFTAR PESERTA HMSI', 'https://docs.google.com/spreadsheets/d/1Q9v7Hi-ZToBeiQ8KSPFTFHWB_TIzv1rrSZC63Bbmnfw/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'SERTIFIKAT STAFF DAN INTERN ORMAWA VISIT', 'http://its.id/m/SertifikatPanitiaOVHMSIxHMTG2025', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'NOTULENSI RAPAT HMTG', 'https://docs.google.com/document/d/1964aLFPbMo6kbeHEDA6yogBcLqGknMr9z75wQjLL22Y/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'PPT HMSI', 'https://docs.google.com/presentation/d/1wEvCW8OjAVi7QyvH1OFxzaAPQG4KHDUZGOeO_kvg-0w/edit?usp=drive_link', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'RUNDOWN PANITIA', 'https://docs.google.com/document/d/1wYDHKqoqrONdRMDaVsk9oG7ub2LczHAAMIy2-OXQZcA/edit?tab=t.0', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'RUNDOWN PESERTA', 'https://docs.google.com/document/d/1gTDQ1Lq2uIk4god0QM7SN_jNSdMHLfhLqrp3o5e_020/edit?tab=t.0', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'ORMAWA VISIT GUIDEBOOK', 'https://docs.google.com/document/d/1yYGR5X39DIzqTwISOv5zq03c8wwGKz_4LqOXOuhvEb8/edit?tab=t.ls09td51ccyk', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'SCRIPT MC', 'https://docs.google.com/document/d/1Szs43wqbZlGvKsizwq4xQKuIlYcd7k7yEwPf3FdRq-E/edit?tab=t.g33rflxshscz', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'GOOGLE FORM FEEDBACK ACARA', 'https://docs.google.com/presentation/d/1pbypEDPSJyPhjDBPvx1WfoeNmGgmhLJy2T08nwhPLZA/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'OPERATIONAL', '2025 PEMINJAMAN RUANG DAN GEDUNG BIRO MANAJEMEN ASET', 'https://docs.google.com/spreadsheets/d/1aoM96SJ8f5RFzUDpJEbdHE2n-NohbLnhoukVVTjQoSE/edit?gid=341712902#gid=341712902', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'OPERATIONAL', 'SPREADSHEET REQUEST OPERATIONAL', 'https://docs.google.com/spreadsheets/d/19_c-UgqH4hZwdeBXsWdpssHOGQbxW3fvIY4eX86sclk/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'CREATIVE', 'SPREADSHEET REQUEST IM', 'https://docs.google.com/spreadsheets/d/19_c-UgqH4hZwdeBXsWdpssHOGQbxW3fvIY4eX86sclk/edit?usp=sharing', 'Ada tracking dan SOP nya IM juga'),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'KESIBUKAN ALL MEMBER EA', 'https://docs.google.com/spreadsheets/d/1DwkIIJBACVlQeh9AKyR6rayLu_3V3jGpV6_okzEQaK0/edit?gid=1363968637#gid=1363968637', 'Kesibukan Fungsio'),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PROPOSAL ORMAWA VISIT', 'https://docs.google.com/document/d/1dkaW-lVB-fPELi7o4q9EeG87K1i2uoqAZsDuGAYYjgs/edit?usp=sharing', 'Proposal'),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'RUNDOWN OV (PANITIA)', 'https://docs.google.com/document/d/1Nq3W7Ax6k-uZBp3Xs8dxWU9T-ek6IN-r0T4rxbNoBfk/edit?hl=id&tab=t.0', 'Rundown Acara Panitia'),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'RUNDOWN OV (PESERTA)', 'https://docs.google.com/document/d/1gTDQ1Lq2uIk4god0QM7SN_jNSdMHLfhLqrp3o5e_020/edit?tab=t.0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'SCRIPT MC & CUE CARD MC', 'https://docs.google.com/document/d/1wsuC2DRtufi0c6Ff5wsyEWFVZ8-C_OQG/edit', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PPT HMSI', 'https://docs.google.com/presentation/d/1wEvCW8OjAVi7QyvH1OFxzaAPQG4KHDUZGOeO_kvg-0w/edit?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'LIST PESERTA HMSI', 'https://docs.google.com/spreadsheets/d/1mt5Zt1Ms6kAjUncD8mA1ezsbgnNYzAKK1RhKf64i8LM/edit?gid=0#gid=0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PRESENSI KONSUMSI', 'https://docs.google.com/document/d/1SDQpRJ77C4U_hYk4MV0PTViqBigKLgMMoQKV1WXejik/edit?tab=t.0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PRESENSI KONSUMSI HMSI', 'https://docs.google.com/document/d/131Qg5Ecz20kBa_g0yT91xl002zsSqn9FSOVO8ywZjSo/edit?tab=t.0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PRESENSI KEHADIRAN', 'https://docs.google.com/document/d/1xD7vFrHGRijc5uqhVP7IykiiNxUKcGTCFsdeNRLZgn4/edit?tab=t.0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PEMBAGIAN TEAM FGD', 'https://docs.google.com/document/d/1R_wd88ft_uFwZTPCXUVGv68HM_bw4ErnB4UYEC44Rpo/edit?tab=t.ls09td51ccyk', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'GUIDEBOOK FGD', 'https://docs.google.com/document/d/1R_wd88ft_uFwZTPCXUVGv68HM_bw4ErnB4UYEC44Rpo/edit?tab=t.ls09td51ccyk', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'TEKS BROADCAST', 'https://docs.google.com/document/d/1vbnRr_S-l3rch4QVqcjpKiE9BIuHxhzPtHLCNp3StsQ/edit?usp=sharing', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'GFORM FEEDBACK', 'https://forms.gle/2eyuoAbhdPEydhpt9', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'POSTER FEEDS OV', 'https://drive.google.com/drive/folders/1jT1f_4sFi29lE25_YPhrjlKtqmxeMV_O?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'BUMPER OV', 'https://drive.google.com/file/d/1EJJnstP6P_5b0nRyC7Bb6Kc9TdbBnv_w/view?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'BANNER OV', 'https://drive.google.com/file/d/1CywKjw3lawYaaZAzNfZ3qSpgmmoX2sB-/view?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'GDRIVE DOKUMENTASI', 'https://drive.google.com/drive/folders/1zI02iMCYg1Zkvi7ShBodBCrHrFdraUyM?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'GDRIVE KEBUTUHAN ASET', 'https://drive.google.com/open?id=12ojPjlcPz90MjT_-XQ99ZZtckrF2-an9', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'GDRIVE SURVEY', 'https://drive.google.com/drive/folders/1n9eQcr4fyuANIhh3La8w1mDdjRJ01cS1?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PPT QR FEEDBACK', 'https://docs.google.com/presentation/d/1s6B2n6EQyMIAjSNBMNEafdonPBdIXETrj1kgN73WCy4/edit?slide=id.g35d261a62ea_0_13#slide=id.g35d261a62ea_0_13', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'DOCS QR PRESENSI', 'https://docs.google.com/document/d/1xD7vFrHGRijc5uqhVP7IykiiNxUKcGTCFsdeNRLZgn4/edit?tab=t.0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'KEBUTUHAN OPERATOR', 'https://docs.google.com/document/d/10kuq6IDsaNo5uhshGUGo9jFF85RBteSMze94nBHxPU4/edit?usp=sharing', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'NOTULESI RAPAT EVALUASI OV HIMASTA UNAIR', 'https://docs.google.com/document/d/129HmMjG6ExWKsSPbuwGY17vGfo6EqOydiqQDoydFMCA/edit?tab=t.0', 'Ada banyak yang bisa diperbaiki next ov lewat ini'),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'Request IM Niskalarasi', 'https://docs.google.com/forms/d/e/1FAIpQLSdon5FjMfBZLPe3___KzatJgeHiAoPU6XnNLNB4BzWyHCc5ig/viewform', 'Ada SOP dan Tracking juga disini'),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] MAIN SHEET ORMAWA VISIT [2024]', 'https://docs.google.com/spreadsheets/d/1o0nwDyj3KpblOTSYE9Z8t6QC7TSxN2pQ7tUIDoNtwew/edit?hl=id&gid=1381895739#gid=1381895739', 'Contekan Main Sheet'),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] RUNDOWN', 'https://docs.google.com/document/d/1XfPTXyFvDpt5X1kwxR-e3ilSCu11ZGvx4IAKsmzbQLk/edit?tab=t.0', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] SCRIPT MC & CUE CARD MC', 'https://docs.google.com/document/d/1lAtKAKA9dWYb_SpP5FjS169V9uyVI1o_thfqi0KNg8s/edit?hl=id&tab=t.0', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] PPT HMSI', 'https://docs.google.com/presentation/d/17GZ_3UiXuCPS7pZpA0EInRCyI1aDVxtq_2_qPBzSfJk/edit?slide=id.g270b8447094_0_94#slide=id.g270b8447094_0_94', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] PRESENSI KEHADIRAN DAN LIST PESERTA HMSI', 'https://its.id/m/PresensiKonsumsiHMSIxHMIT', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] PEMBAGIAN TEAM FGD', 'https://docs.google.com/spreadsheets/d/1YO7FHp86NUb5bvnvl54ffLRiP9l3CEvd-omzMwMOY_I/edit?gid=0#gid=0', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] GUIDEBOOK FGD', 'https://docs.google.com/document/d/1s9BqVFFwVsY_WnhNM2Z6zfgkD3-Sv2XP4pGS3TXVygE/edit?tab=t.0', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] GFORM FEEDBACK', 'https://docs.google.com/forms/d/e/1FAIpQLSeHyfdkWieE4COhGJZhp69iWBsuYLwz2oSHV6qt5h5eWU5RfA/viewform', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'PIC', 'PROPOSAL ORMAWA VISIT', 'https://docs.google.com/document/d/1qh1oKuL0GBZR8wOVMc1SBhZEzczi8bv0kyhTcPvRMQg/edit?tab=t.0', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'PIC', 'PPT PROGRESS', 'https://docs.google.com/presentation/d/1AE4xw1yNSYSZPs1OVeE-1oQ37ssA3Mx4pZZwF_J3BBQ/edit?usp=sharing', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'PIC', 'SOP', 'https://docs.google.com/document/d/1zqmTOF3NIvliOUrzY366Px_84Xzlcea52xrSLhImdSg/edit?usp=sharing', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'PIC', 'SPREADSHEET DAFTAR PESERTA HMSI', 'https://docs.google.com/spreadsheets/d/1Q9v7Hi-ZToBeiQ8KSPFTFHWB_TIzv1rrSZC63Bbmnfw/edit?usp=sharing', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'LO', 'LINK FEEDBACK', 'https://docs.google.com/forms/d/1ZcT6Mb56y0JZw6_tb-4oL5nrMUE59udIcmRKThL-vKE/edit?usp=forms_home&ouid=110931691000664434263&ths=true', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'PPT HMSI 2026', 'https://docs.google.com/presentation/d/1wEvCW8OjAVi7QyvH1OFxzaAPQG4KHDUZGOeO_kvg-0w/edit?usp=drive_link', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'RUNDOWN PANITIA', 'https://docs.google.com/document/d/1wYDHKqoqrONdRMDaVsk9oG7ub2LczHAAMIy2-OXQZcA/edit?tab=t.0', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'RUNDOWN PESERTA', 'https://docs.google.com/document/d/1gTDQ1Lq2uIk4god0QM7SN_jNSdMHLfhLqrp3o5e_020/edit?tab=t.0', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'ORMAWA VISIT GUIDEBOOK', 'https://docs.google.com/document/d/1AiXAeSEcdXSBsDLw2X-0-Cw_9S0M9s6G5zg2x4CeQGo/edit?tab=t.0', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'SCRIPT MC', 'https://docs.google.com/document/d/1Szs43wqbZlGvKsizwq4xQKuIlYcd7k7yEwPf3FdRq-E/edit?tab=t.g33rflxshscz', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'GOOGLE FORM FEEDBACK ACARA', 'https://docs.google.com/presentation/d/1pbypEDPSJyPhjDBPvx1WfoeNmGgmhLJy2T08nwhPLZA/edit?usp=sharing', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'OPERATIONAL', '2025 PEMINJAMAN RUANG DAN GEDUNG BIRO MANAJEMEN ASET', 'https://docs.google.com/spreadsheets/d/1aoM96SJ8f5RFzUDpJEbdHE2n-NohbLnhoukVVTjQoSE/edit?gid=341712902#gid=341712902', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'OPERATIONAL', 'SPREADSHEET REQUEST OPERATIONAL', 'https://docs.google.com/spreadsheets/d/19_c-UgqH4hZwdeBXsWdpssHOGQbxW3fvIY4eX86sclk/edit?usp=sharing', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'CREATIVE', 'SPREADSHEET REQUEST IM', 'https://docs.google.com/spreadsheets/d/1Rac543eTheXzoVVsm9ubzB2ZO8JJbYy98sPbszW_3-A/edit?gid=1491319627#gid=1491319627', 'SOP dan link request IM 2026 (terbaru)'),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'KESIBUKAN ALL MEMBER EA', 'https://docs.google.com/spreadsheets/d/1DwkIIJBACVlQeh9AKyR6rayLu_3V3jGpV6_okzEQaK0/edit?gid=1363968637#gid=1363968637', 'Kesibukan Fungsio'),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PROPOSAL ORMAWA VISIT', 'https://docs.google.com/document/d/1dkaW-lVB-fPELi7o4q9EeG87K1i2uoqAZsDuGAYYjgs/edit?usp=sharing', 'Proposal'),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'RUNDOWN OV (PANITIA)', 'https://docs.google.com/document/d/1Nq3W7Ax6k-uZBp3Xs8dxWU9T-ek6IN-r0T4rxbNoBfk/edit?hl=id&tab=t.0', 'Rundown Acara Panitia'),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'RUNDOWN OV (PESERTA)', 'https://docs.google.com/document/d/1gTDQ1Lq2uIk4god0QM7SN_jNSdMHLfhLqrp3o5e_020/edit?tab=t.0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'SCRIPT MC & CUE CARD MC', 'https://docs.google.com/document/d/1wsuC2DRtufi0c6Ff5wsyEWFVZ8-C_OQG/edit', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PPT HMSI', 'https://docs.google.com/presentation/d/1wEvCW8OjAVi7QyvH1OFxzaAPQG4KHDUZGOeO_kvg-0w/edit?usp=drive_link', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'LIST PESERTA HMSI', 'https://docs.google.com/spreadsheets/d/1mt5Zt1Ms6kAjUncD8mA1ezsbgnNYzAKK1RhKf64i8LM/edit?gid=0#gid=0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PRESENSI KONSUMSI', 'https://docs.google.com/document/d/1SDQpRJ77C4U_hYk4MV0PTViqBigKLgMMoQKV1WXejik/edit?tab=t.0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PRESENSI KONSUMSI HMSI', 'https://docs.google.com/document/d/131Qg5Ecz20kBa_g0yT91xl002zsSqn9FSOVO8ywZjSo/edit?tab=t.0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PRESENSI KEHADIRAN', 'https://docs.google.com/document/d/1xD7vFrHGRijc5uqhVP7IykiiNxUKcGTCFsdeNRLZgn4/edit?tab=t.0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'GUIDEBOOK FGD', 'https://docs.google.com/document/d/1R_wd88ft_uFwZTPCXUVGv68HM_bw4ErnB4UYEC44Rpo/edit?tab=t.ls09td51ccyk', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'TEKS BROADCAST', 'https://docs.google.com/document/d/1vbnRr_S-l3rch4QVqcjpKiE9BIuHxhzPtHLCNp3StsQ/edit?usp=sharing', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'GFORM FEEDBACK', 'https://forms.gle/2eyuoAbhdPEydhpt9', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'POSTER FEEDS OV', 'https://drive.google.com/drive/folders/1jT1f_4sFi29lE25_YPhrjlKtqmxeMV_O?usp=drive_link', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'BUMPER OV', 'https://drive.google.com/file/d/1EJJnstP6P_5b0nRyC7Bb6Kc9TdbBnv_w/view?usp=drive_link', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'BANNER OV', 'https://drive.google.com/file/d/1CywKjw3lawYaaZAzNfZ3qSpgmmoX2sB-/view?usp=drive_link', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'GDRIVE DOKUMENTASI', 'https://drive.google.com/drive/folders/1UFDVCfUN8NsGRjfKR_EDBUzxQXRs3g2N', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'GDRIVE KEBUTUHAN ASET', 'https://drive.google.com/open?id=12ojPjlcPz90MjT_-XQ99ZZtckrF2-an9', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'GDRIVE SURVEY', 'https://drive.google.com/drive/folders/1K_PwVuE1SyivP1-Zuzrh898XY4BLAOiA', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PPT QR FEEDBACK', 'https://docs.google.com/presentation/d/1s6B2n6EQyMIAjSNBMNEafdonPBdIXETrj1kgN73WCy4/edit?slide=id.g35d261a62ea_0_13#slide=id.g35d261a62ea_0_13', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'DOCS QR PRESENSI', 'https://docs.google.com/document/d/1xD7vFrHGRijc5uqhVP7IykiiNxUKcGTCFsdeNRLZgn4/edit?tab=t.0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'KEBUTUHAN OPERATOR', 'https://docs.google.com/document/d/10kuq6IDsaNo5uhshGUGo9jFF85RBteSMze94nBHxPU4/edit?usp=sharing', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'NOTULESI RAPAT EVALUASI OV HIMASTA UNAIR', 'https://docs.google.com/document/d/129HmMjG6ExWKsSPbuwGY17vGfo6EqOydiqQDoydFMCA/edit?tab=t.0', 'Ada banyak yang bisa diperbaiki next ov lewat ini'),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'Request IM Niskalarasi', 'https://docs.google.com/forms/d/e/1FAIpQLSdon5FjMfBZLPe3___KzatJgeHiAoPU6XnNLNB4BzWyHCc5ig/viewform', 'Ada SOP dan Tracking juga disini')
)
update links l
set url  = s.url,
    note = case when s.note <> '' then s.note else l.note end,
    division = case when s.division <> '' then s.division else l.division end
from sheet_links s
where l.name = s.name
  and l.section = s.section
  and l.event_id is not distinct from s.event_id
  and coalesce(l.source, '') <> 'manual'
  and l.url is distinct from s.url;

-- 2) Tambahkan yang belum ada sama sekali.
with sheet_links (event_id, section, division, name, url, note) as (
  values
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'PROPOSAL ORMAWA VISIT', 'https://docs.google.com/document/d/1b75NR8Zz9kYUS9yqX_AQG4_9LamQsFxTogMmOlrjW5k/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'GFORM MINAT DIVISI INTERN', 'https://forms.gle/J9YC8jnSXFcdj7iz5', 'Hasilnya disini: https://docs.google.com/spreadsheets/d/1wnX0_EY_fxKE9B0fcwIO0OaJrlhnYfi3v6mtm83pudI/edit?usp=sharing'),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'PPT PROGRESS', 'https://docs.google.com/presentation/d/1AE4xw1yNSYSZPs1OVeE-1oQ37ssA3Mx4pZZwF_J3BBQ/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'TEMPLATE REQUEST DIVISI', 'https://docs.google.com/spreadsheets/d/1SLPJuXNd2OXLpPE3kvo9zxwqUMGjo-0RzX3h9s_aWcw/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'SPREADSHEET DAFTAR PESERTA HMSI', 'https://docs.google.com/spreadsheets/d/1Q9v7Hi-ZToBeiQ8KSPFTFHWB_TIzv1rrSZC63Bbmnfw/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'SERTIFIKAT STAFF DAN INTERN ORMAWA VISIT', 'http://its.id/m/SertifikatPanitiaOVHMSIxHMTG2025', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'PIC', 'NOTULENSI RAPAT HMTG', 'https://docs.google.com/document/d/1964aLFPbMo6kbeHEDA6yogBcLqGknMr9z75wQjLL22Y/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'PPT HMSI', 'https://docs.google.com/presentation/d/1wEvCW8OjAVi7QyvH1OFxzaAPQG4KHDUZGOeO_kvg-0w/edit?usp=drive_link', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'RUNDOWN PANITIA', 'https://docs.google.com/document/d/1wYDHKqoqrONdRMDaVsk9oG7ub2LczHAAMIy2-OXQZcA/edit?tab=t.0', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'RUNDOWN PESERTA', 'https://docs.google.com/document/d/1gTDQ1Lq2uIk4god0QM7SN_jNSdMHLfhLqrp3o5e_020/edit?tab=t.0', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'ORMAWA VISIT GUIDEBOOK', 'https://docs.google.com/document/d/1yYGR5X39DIzqTwISOv5zq03c8wwGKz_4LqOXOuhvEb8/edit?tab=t.ls09td51ccyk', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'SCRIPT MC', 'https://docs.google.com/document/d/1Szs43wqbZlGvKsizwq4xQKuIlYcd7k7yEwPf3FdRq-E/edit?tab=t.g33rflxshscz', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'EVENT', 'GOOGLE FORM FEEDBACK ACARA', 'https://docs.google.com/presentation/d/1pbypEDPSJyPhjDBPvx1WfoeNmGgmhLJy2T08nwhPLZA/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'OPERATIONAL', '2025 PEMINJAMAN RUANG DAN GEDUNG BIRO MANAJEMEN ASET', 'https://docs.google.com/spreadsheets/d/1aoM96SJ8f5RFzUDpJEbdHE2n-NohbLnhoukVVTjQoSE/edit?gid=341712902#gid=341712902', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'OPERATIONAL', 'SPREADSHEET REQUEST OPERATIONAL', 'https://docs.google.com/spreadsheets/d/19_c-UgqH4hZwdeBXsWdpssHOGQbxW3fvIY4eX86sclk/edit?usp=sharing', ''),
    ('ov2-2025', 'HMSI ITS x HMTG ITS 2025 RECAP [DONE] ✨', 'CREATIVE', 'SPREADSHEET REQUEST IM', 'https://docs.google.com/spreadsheets/d/19_c-UgqH4hZwdeBXsWdpssHOGQbxW3fvIY4eX86sclk/edit?usp=sharing', 'Ada tracking dan SOP nya IM juga'),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'KESIBUKAN ALL MEMBER EA', 'https://docs.google.com/spreadsheets/d/1DwkIIJBACVlQeh9AKyR6rayLu_3V3jGpV6_okzEQaK0/edit?gid=1363968637#gid=1363968637', 'Kesibukan Fungsio'),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PROPOSAL ORMAWA VISIT', 'https://docs.google.com/document/d/1dkaW-lVB-fPELi7o4q9EeG87K1i2uoqAZsDuGAYYjgs/edit?usp=sharing', 'Proposal'),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'RUNDOWN OV (PANITIA)', 'https://docs.google.com/document/d/1Nq3W7Ax6k-uZBp3Xs8dxWU9T-ek6IN-r0T4rxbNoBfk/edit?hl=id&tab=t.0', 'Rundown Acara Panitia'),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'RUNDOWN OV (PESERTA)', 'https://docs.google.com/document/d/1gTDQ1Lq2uIk4god0QM7SN_jNSdMHLfhLqrp3o5e_020/edit?tab=t.0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'SCRIPT MC & CUE CARD MC', 'https://docs.google.com/document/d/1wsuC2DRtufi0c6Ff5wsyEWFVZ8-C_OQG/edit', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PPT HMSI', 'https://docs.google.com/presentation/d/1wEvCW8OjAVi7QyvH1OFxzaAPQG4KHDUZGOeO_kvg-0w/edit?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'LIST PESERTA HMSI', 'https://docs.google.com/spreadsheets/d/1mt5Zt1Ms6kAjUncD8mA1ezsbgnNYzAKK1RhKf64i8LM/edit?gid=0#gid=0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PRESENSI KONSUMSI', 'https://docs.google.com/document/d/1SDQpRJ77C4U_hYk4MV0PTViqBigKLgMMoQKV1WXejik/edit?tab=t.0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PRESENSI KONSUMSI HMSI', 'https://docs.google.com/document/d/131Qg5Ecz20kBa_g0yT91xl002zsSqn9FSOVO8ywZjSo/edit?tab=t.0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PRESENSI KEHADIRAN', 'https://docs.google.com/document/d/1xD7vFrHGRijc5uqhVP7IykiiNxUKcGTCFsdeNRLZgn4/edit?tab=t.0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PEMBAGIAN TEAM FGD', 'https://docs.google.com/document/d/1R_wd88ft_uFwZTPCXUVGv68HM_bw4ErnB4UYEC44Rpo/edit?tab=t.ls09td51ccyk', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'GUIDEBOOK FGD', 'https://docs.google.com/document/d/1R_wd88ft_uFwZTPCXUVGv68HM_bw4ErnB4UYEC44Rpo/edit?tab=t.ls09td51ccyk', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'TEKS BROADCAST', 'https://docs.google.com/document/d/1vbnRr_S-l3rch4QVqcjpKiE9BIuHxhzPtHLCNp3StsQ/edit?usp=sharing', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'GFORM FEEDBACK', 'https://forms.gle/2eyuoAbhdPEydhpt9', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'POSTER FEEDS OV', 'https://drive.google.com/drive/folders/1jT1f_4sFi29lE25_YPhrjlKtqmxeMV_O?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'BUMPER OV', 'https://drive.google.com/file/d/1EJJnstP6P_5b0nRyC7Bb6Kc9TdbBnv_w/view?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'BANNER OV', 'https://drive.google.com/file/d/1CywKjw3lawYaaZAzNfZ3qSpgmmoX2sB-/view?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'GDRIVE DOKUMENTASI', 'https://drive.google.com/drive/folders/1zI02iMCYg1Zkvi7ShBodBCrHrFdraUyM?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'GDRIVE KEBUTUHAN ASET', 'https://drive.google.com/open?id=12ojPjlcPz90MjT_-XQ99ZZtckrF2-an9', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'GDRIVE SURVEY', 'https://drive.google.com/drive/folders/1n9eQcr4fyuANIhh3La8w1mDdjRJ01cS1?usp=drive_link', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'PPT QR FEEDBACK', 'https://docs.google.com/presentation/d/1s6B2n6EQyMIAjSNBMNEafdonPBdIXETrj1kgN73WCy4/edit?slide=id.g35d261a62ea_0_13#slide=id.g35d261a62ea_0_13', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'DOCS QR PRESENSI', 'https://docs.google.com/document/d/1xD7vFrHGRijc5uqhVP7IykiiNxUKcGTCFsdeNRLZgn4/edit?tab=t.0', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'KEBUTUHAN OPERATOR', 'https://docs.google.com/document/d/10kuq6IDsaNo5uhshGUGo9jFF85RBteSMze94nBHxPU4/edit?usp=sharing', ''),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'NOTULESI RAPAT EVALUASI OV HIMASTA UNAIR', 'https://docs.google.com/document/d/129HmMjG6ExWKsSPbuwGY17vGfo6EqOydiqQDoydFMCA/edit?tab=t.0', 'Ada banyak yang bisa diperbaiki next ov lewat ini'),
    ('ov1-2025', 'HMSI ITS x HIMASTA UNAIR 2025 RECAP [DONE] ✨', '', 'Request IM Niskalarasi', 'https://docs.google.com/forms/d/e/1FAIpQLSdon5FjMfBZLPe3___KzatJgeHiAoPU6XnNLNB4BzWyHCc5ig/viewform', 'Ada SOP dan Tracking juga disini'),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] MAIN SHEET ORMAWA VISIT [2024]', 'https://docs.google.com/spreadsheets/d/1o0nwDyj3KpblOTSYE9Z8t6QC7TSxN2pQ7tUIDoNtwew/edit?hl=id&gid=1381895739#gid=1381895739', 'Contekan Main Sheet'),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] RUNDOWN', 'https://docs.google.com/document/d/1XfPTXyFvDpt5X1kwxR-e3ilSCu11ZGvx4IAKsmzbQLk/edit?tab=t.0', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] SCRIPT MC & CUE CARD MC', 'https://docs.google.com/document/d/1lAtKAKA9dWYb_SpP5FjS169V9uyVI1o_thfqi0KNg8s/edit?hl=id&tab=t.0', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] PPT HMSI', 'https://docs.google.com/presentation/d/17GZ_3UiXuCPS7pZpA0EInRCyI1aDVxtq_2_qPBzSfJk/edit?slide=id.g270b8447094_0_94#slide=id.g270b8447094_0_94', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] PRESENSI KEHADIRAN DAN LIST PESERTA HMSI', 'https://its.id/m/PresensiKonsumsiHMSIxHMIT', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] PEMBAGIAN TEAM FGD', 'https://docs.google.com/spreadsheets/d/1YO7FHp86NUb5bvnvl54ffLRiP9l3CEvd-omzMwMOY_I/edit?gid=0#gid=0', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] GUIDEBOOK FGD', 'https://docs.google.com/document/d/1s9BqVFFwVsY_WnhNM2Z6zfgkD3-Sv2XP4pGS3TXVygE/edit?tab=t.0', ''),
    (null, 'ORMAWA VISIT 2024 RECAP', '', '[CONTEKAN] GFORM FEEDBACK', 'https://docs.google.com/forms/d/e/1FAIpQLSeHyfdkWieE4COhGJZhp69iWBsuYLwz2oSHV6qt5h5eWU5RfA/viewform', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'PIC', 'PROPOSAL ORMAWA VISIT', 'https://docs.google.com/document/d/1qh1oKuL0GBZR8wOVMc1SBhZEzczi8bv0kyhTcPvRMQg/edit?tab=t.0', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'PIC', 'PPT PROGRESS', 'https://docs.google.com/presentation/d/1AE4xw1yNSYSZPs1OVeE-1oQ37ssA3Mx4pZZwF_J3BBQ/edit?usp=sharing', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'PIC', 'SOP', 'https://docs.google.com/document/d/1zqmTOF3NIvliOUrzY366Px_84Xzlcea52xrSLhImdSg/edit?usp=sharing', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'PIC', 'SPREADSHEET DAFTAR PESERTA HMSI', 'https://docs.google.com/spreadsheets/d/1Q9v7Hi-ZToBeiQ8KSPFTFHWB_TIzv1rrSZC63Bbmnfw/edit?usp=sharing', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'LO', 'LINK FEEDBACK', 'https://docs.google.com/forms/d/1ZcT6Mb56y0JZw6_tb-4oL5nrMUE59udIcmRKThL-vKE/edit?usp=forms_home&ouid=110931691000664434263&ths=true', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'PPT HMSI 2026', 'https://docs.google.com/presentation/d/1wEvCW8OjAVi7QyvH1OFxzaAPQG4KHDUZGOeO_kvg-0w/edit?usp=drive_link', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'RUNDOWN PANITIA', 'https://docs.google.com/document/d/1wYDHKqoqrONdRMDaVsk9oG7ub2LczHAAMIy2-OXQZcA/edit?tab=t.0', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'RUNDOWN PESERTA', 'https://docs.google.com/document/d/1gTDQ1Lq2uIk4god0QM7SN_jNSdMHLfhLqrp3o5e_020/edit?tab=t.0', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'ORMAWA VISIT GUIDEBOOK', 'https://docs.google.com/document/d/1AiXAeSEcdXSBsDLw2X-0-Cw_9S0M9s6G5zg2x4CeQGo/edit?tab=t.0', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'SCRIPT MC', 'https://docs.google.com/document/d/1Szs43wqbZlGvKsizwq4xQKuIlYcd7k7yEwPf3FdRq-E/edit?tab=t.g33rflxshscz', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'EVENT', 'GOOGLE FORM FEEDBACK ACARA', 'https://docs.google.com/presentation/d/1pbypEDPSJyPhjDBPvx1WfoeNmGgmhLJy2T08nwhPLZA/edit?usp=sharing', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'OPERATIONAL', '2025 PEMINJAMAN RUANG DAN GEDUNG BIRO MANAJEMEN ASET', 'https://docs.google.com/spreadsheets/d/1aoM96SJ8f5RFzUDpJEbdHE2n-NohbLnhoukVVTjQoSE/edit?gid=341712902#gid=341712902', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'OPERATIONAL', 'SPREADSHEET REQUEST OPERATIONAL', 'https://docs.google.com/spreadsheets/d/19_c-UgqH4hZwdeBXsWdpssHOGQbxW3fvIY4eX86sclk/edit?usp=sharing', ''),
    ('ov1-2026', 'HMSI ITS x HMD MEI 2026 (INTERNAL)', 'CREATIVE', 'SPREADSHEET REQUEST IM', 'https://docs.google.com/spreadsheets/d/1Rac543eTheXzoVVsm9ubzB2ZO8JJbYy98sPbszW_3-A/edit?gid=1491319627#gid=1491319627', 'SOP dan link request IM 2026 (terbaru)'),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'KESIBUKAN ALL MEMBER EA', 'https://docs.google.com/spreadsheets/d/1DwkIIJBACVlQeh9AKyR6rayLu_3V3jGpV6_okzEQaK0/edit?gid=1363968637#gid=1363968637', 'Kesibukan Fungsio'),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PROPOSAL ORMAWA VISIT', 'https://docs.google.com/document/d/1dkaW-lVB-fPELi7o4q9EeG87K1i2uoqAZsDuGAYYjgs/edit?usp=sharing', 'Proposal'),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'RUNDOWN OV (PANITIA)', 'https://docs.google.com/document/d/1Nq3W7Ax6k-uZBp3Xs8dxWU9T-ek6IN-r0T4rxbNoBfk/edit?hl=id&tab=t.0', 'Rundown Acara Panitia'),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'RUNDOWN OV (PESERTA)', 'https://docs.google.com/document/d/1gTDQ1Lq2uIk4god0QM7SN_jNSdMHLfhLqrp3o5e_020/edit?tab=t.0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'SCRIPT MC & CUE CARD MC', 'https://docs.google.com/document/d/1wsuC2DRtufi0c6Ff5wsyEWFVZ8-C_OQG/edit', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PPT HMSI', 'https://docs.google.com/presentation/d/1wEvCW8OjAVi7QyvH1OFxzaAPQG4KHDUZGOeO_kvg-0w/edit?usp=drive_link', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'LIST PESERTA HMSI', 'https://docs.google.com/spreadsheets/d/1mt5Zt1Ms6kAjUncD8mA1ezsbgnNYzAKK1RhKf64i8LM/edit?gid=0#gid=0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PRESENSI KONSUMSI', 'https://docs.google.com/document/d/1SDQpRJ77C4U_hYk4MV0PTViqBigKLgMMoQKV1WXejik/edit?tab=t.0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PRESENSI KONSUMSI HMSI', 'https://docs.google.com/document/d/131Qg5Ecz20kBa_g0yT91xl002zsSqn9FSOVO8ywZjSo/edit?tab=t.0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PRESENSI KEHADIRAN', 'https://docs.google.com/document/d/1xD7vFrHGRijc5uqhVP7IykiiNxUKcGTCFsdeNRLZgn4/edit?tab=t.0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'GUIDEBOOK FGD', 'https://docs.google.com/document/d/1R_wd88ft_uFwZTPCXUVGv68HM_bw4ErnB4UYEC44Rpo/edit?tab=t.ls09td51ccyk', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'TEKS BROADCAST', 'https://docs.google.com/document/d/1vbnRr_S-l3rch4QVqcjpKiE9BIuHxhzPtHLCNp3StsQ/edit?usp=sharing', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'GFORM FEEDBACK', 'https://forms.gle/2eyuoAbhdPEydhpt9', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'POSTER FEEDS OV', 'https://drive.google.com/drive/folders/1jT1f_4sFi29lE25_YPhrjlKtqmxeMV_O?usp=drive_link', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'BUMPER OV', 'https://drive.google.com/file/d/1EJJnstP6P_5b0nRyC7Bb6Kc9TdbBnv_w/view?usp=drive_link', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'BANNER OV', 'https://drive.google.com/file/d/1CywKjw3lawYaaZAzNfZ3qSpgmmoX2sB-/view?usp=drive_link', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'GDRIVE DOKUMENTASI', 'https://drive.google.com/drive/folders/1UFDVCfUN8NsGRjfKR_EDBUzxQXRs3g2N', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'GDRIVE KEBUTUHAN ASET', 'https://drive.google.com/open?id=12ojPjlcPz90MjT_-XQ99ZZtckrF2-an9', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'GDRIVE SURVEY', 'https://drive.google.com/drive/folders/1K_PwVuE1SyivP1-Zuzrh898XY4BLAOiA', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'PPT QR FEEDBACK', 'https://docs.google.com/presentation/d/1s6B2n6EQyMIAjSNBMNEafdonPBdIXETrj1kgN73WCy4/edit?slide=id.g35d261a62ea_0_13#slide=id.g35d261a62ea_0_13', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'DOCS QR PRESENSI', 'https://docs.google.com/document/d/1xD7vFrHGRijc5uqhVP7IykiiNxUKcGTCFsdeNRLZgn4/edit?tab=t.0', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'KEBUTUHAN OPERATOR', 'https://docs.google.com/document/d/10kuq6IDsaNo5uhshGUGo9jFF85RBteSMze94nBHxPU4/edit?usp=sharing', ''),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'NOTULESI RAPAT EVALUASI OV HIMASTA UNAIR', 'https://docs.google.com/document/d/129HmMjG6ExWKsSPbuwGY17vGfo6EqOydiqQDoydFMCA/edit?tab=t.0', 'Ada banyak yang bisa diperbaiki next ov lewat ini'),
    ('ov2-2026', 'HMSI ITS x HMD EKSTERNAL RECAP', '', 'Request IM Niskalarasi', 'https://docs.google.com/forms/d/e/1FAIpQLSdon5FjMfBZLPe3___KzatJgeHiAoPU6XnNLNB4BzWyHCc5ig/viewform', 'Ada SOP dan Tracking juga disini')
)
insert into links (event_id, section, division, name, url, note, source)
select s.event_id, s.section, s.division, s.name, s.url, s.note, 'sheet'
from sheet_links s
where not exists (
  select 1 from links l
  where l.name = s.name
    and l.section = s.section
    and l.event_id is not distinct from s.event_id
);

commit;

-- ------------------------------------------------------------------
-- Laporan: berapa tautan per edisi setelah impor.
-- ------------------------------------------------------------------
select coalesce(event_id, '(tanpa edisi)') as edisi, count(*) as jumlah
from links
group by 1
order by 1;
