-- ============================================================
-- MOCKUP SEED for the SEPARATE demo Supabase project.
-- Run this ONLY on the demo project (never on production), after the
-- schema migrations (0001..0011) and demo-open-access.sql.
-- All data here is fictional/example data — safe to modify freely.
-- ============================================================
begin;

-- divisions
insert into divisions(key,name,short,color,"order") values ('PIC','PIC Ormawa Visit','PIC','#6366f1',1) on conflict (key) do nothing;
insert into divisions(key,name,short,color,"order") values ('COORDINATOR','Coordinator','COORD','#8b5cf6',2) on conflict (key) do nothing;
insert into divisions(key,name,short,color,"order") values ('SECRETARY','Secretary','SEC','#ec4899',3) on conflict (key) do nothing;
insert into divisions(key,name,short,color,"order") values ('TREASURER','Treasurer','TRE','#f59e0b',4) on conflict (key) do nothing;
insert into divisions(key,name,short,color,"order") values ('LO','Liaison Officer','LO','#0ea5e9',5) on conflict (key) do nothing;
insert into divisions(key,name,short,color,"order") values ('EVENT','Event','EVE','#10b981',6) on conflict (key) do nothing;
insert into divisions(key,name,short,color,"order") values ('CONSUMPTION','Consumption','CON','#f97316',7) on conflict (key) do nothing;
insert into divisions(key,name,short,color,"order") values ('OPERATIONAL','Operational','OPR','#64748b',8) on conflict (key) do nothing;
insert into divisions(key,name,short,color,"order") values ('CREATIVE','Creative','CRE','#d946ef',9) on conflict (key) do nothing;
insert into divisions(key,name,short,color,"order") values ('MARKETING','Marketing','MRT','#f43f5e',10) on conflict (key) do nothing;
insert into divisions(key,name,short,color,"order") values ('OUTSOURCE','Outsource','OUT','#14b8a6',11) on conflict (key) do nothing;

-- demo edition (active = the landing edition)
insert into events(id,code,title,partner,campus,type,mode,cabinet,event_date,plan_start,plan_end,location,status,"order")
values ('demo-ov','DEMO','Ormawa Visit Demo','Himpunan Demo','Universitas Contoh','external','offline','Sandbox','2026-09-20','2026-08-01','2026-09-19','Ruang Demo, Gedung Contoh','active',1)
on conflict (id) do nothing;

-- members
insert into members(event_id,name,nickname,nrp,type,year,division) values ('demo-ov','Budi Santoso','Budi','5026221001','fungsionaris',2022,'EVENT');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('demo-ov','Siti Rahma','Siti','5026221002','fungsionaris',2022,'SECRETARY');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('demo-ov','Andi Wijaya','Andi','5026231003','fungsionaris',2023,'LO');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('demo-ov','Dewi Lestari','Dewi','5026231004','fungsionaris',2023,'CREATIVE');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('demo-ov','Rizky Pratama','Rizky','5026231005','fungsionaris',2023,'MARKETING');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('demo-ov','Putri Anggraini','Putri','5026241006','intern',2024,'CONSUMPTION');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('demo-ov','Fajar Nugroho','Fajar','5026241007','intern',2024,'OPERATIONAL');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('demo-ov','Maya Kusuma','Maya','5026241008','intern',2024,'EVENT');

-- tasks
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','EVENT','1','Budi','Susun konsep acara Ormawa Visit Demo','2026-08-01','','2026-08-10','','','','ongoing');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','EVENT','2','Maya','Buat rundown acara','2026-08-11','','2026-08-20','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','EVENT','3','Budi','Evaluasi & laporan akhir','2026-09-21','','2026-09-30','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','SECRETARY','1','Siti','Buat proposal & surat-menyurat','2026-08-01','','2026-08-08','','','','done');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','SECRETARY','2','Siti','Notulensi & absensi peserta','2026-09-20','','2026-09-20','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','LO','1','Andi','Koordinasi dengan himpunan partner','2026-08-05','','2026-08-25','','','','ongoing');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','LO','2','Andi','Follow up konfirmasi kehadiran','2026-09-01','','2026-09-15','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','CREATIVE','1','Dewi','Desain feeds & poster publikasi','2026-08-10','','2026-08-18','','','','done');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','CREATIVE','2','Dewi','Siapkan dokumentasi acara','2026-09-19','','2026-09-20','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','MARKETING','1','Rizky','Publikasi di media sosial','2026-08-18','','2026-09-18','','','','ongoing');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','CONSUMPTION','1','Putri','Pesan konsumsi peserta','2026-09-10','','2026-09-19','','','','todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('demo-ov','OPERATIONAL','1','Fajar','Siapkan perlengkapan & ruangan','2026-09-15','','2026-09-19','','','','overtime');

-- budget
with p as (insert into budget_plans(name,event_id) values ('RAB Ormawa Visit Demo','demo-ov') returning id)
  insert into budget_items(plan_id,category,no,name,qty,unit,unit_price,total,"order")
  select p.id, v.* from p, (values
    ('KONSUMSI',1,'Snack peserta',30,'box',15000,450000,0),
    ('KONSUMSI',2,'Air mineral',5,'dus',20000,100000,1),
    ('KESEKRETARIATAN',3,'Cetak proposal',3,'eksemplar',25000,75000,2),
    ('ACARA',4,'Plakat / cinderamata',1,'buah',150000,150000,3),
    ('KREATIF',5,'Cetak banner',1,'buah',120000,120000,4),
    ('OPERASIONAL',6,'Sewa perlengkapan',1,'paket',200000,200000,5)
  ) as v(category,no,name,qty,unit,unit_price,total,ord);

-- rundown
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values ('demo-ov','A',1,'08:00','08:30','','Registrasi peserta','Semua panitia','','','','','','','','');
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values ('demo-ov','A',2,'08:30','09:00','','Pembukaan & sambutan','MC','','','','','','','','');
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values ('demo-ov','A',3,'09:00','10:30','','Sesi sharing & FGD','Moderator','','','','','','','','');
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values ('demo-ov','A',4,'10:30','11:30','','Games & networking','Event','','','','','','','','');
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values ('demo-ov','A',5,'11:30','12:00','','Penutupan & dokumentasi','MC','','','','','','','','');

-- job hari-h
insert into job_harih(event_id,no,pic,job,notes) values ('demo-ov','1','Maya','MC Acara','');
insert into job_harih(event_id,no,pic,job,notes) values ('demo-ov','2','Siti','Registrasi & absensi','');
insert into job_harih(event_id,no,pic,job,notes) values ('demo-ov','3','Dewi','Dokumentasi foto/video','');
insert into job_harih(event_id,no,pic,job,notes) values ('demo-ov','4','Andi','LO himpunan partner','');
insert into job_harih(event_id,no,pic,job,notes) values ('demo-ov','5','Putri, Fajar','Konsumsi & perlengkapan','');

-- teams
insert into teams(event_id,division,fungsionaris,intern) values ('demo-ov','EVENT','Budi, Maya',null);
insert into teams(event_id,division,fungsionaris,intern) values ('demo-ov','SECRETARY','Siti',null);
insert into teams(event_id,division,fungsionaris,intern) values ('demo-ov','LO','Andi',null);
insert into teams(event_id,division,fungsionaris,intern) values ('demo-ov','CREATIVE','Dewi',null);
insert into teams(event_id,division,fungsionaris,intern) values ('demo-ov','MARKETING','Rizky',null);
insert into teams(event_id,division,fungsionaris,intern) values ('demo-ov','CONSUMPTION',null,'Putri');
insert into teams(event_id,division,fungsionaris,intern) values ('demo-ov','OPERATIONAL',null,'Fajar');

-- prospects
insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('demo-ov','Demo','1','','','','Himpunan Demo A','Universitas Contoh','','Andi','DIHUBUNGI','DITERIMA','',false,'demo');
insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('demo-ov','Demo','2','','','','Himpunan Demo B','Institut Sample','','Andi','MENGHUBUNGI','DITUNGGU','',false,'demo');
insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('demo-ov','Demo','3','','','','Himpunan Demo C','Politeknik Uji','','Budi','DIHUBUNGI','DITOLAK','',false,'demo');
insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('demo-ov','Demo','4','','','','Himpunan Demo D','Universitas Placeholder','',null,null,null,'',false,'demo');

-- links
insert into links(event_id,section,division,name,url,note,source) values ('demo-ov','Proposal','SECRETARY','Proposal Ormawa Visit Demo','https://example.com/proposal-demo','','demo');
insert into links(event_id,section,division,name,url,note,source) values ('demo-ov','Desain','CREATIVE','Folder Desain','https://example.com/desain-demo','','demo');
insert into links(event_id,section,division,name,url,note,source) values ('demo-ov','Dokumentasi','CREATIVE','Drive Dokumentasi','https://example.com/dokumentasi-demo','','demo');
insert into links(event_id,section,division,name,url,note,source) values ('demo-ov','Formulir','EVENT','Form Pendaftaran Peserta','https://example.com/form-demo','','demo');

commit;
