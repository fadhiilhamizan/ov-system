-- ============================================================
-- Ormawa Visit "Demo" edition (protected sandbox) + mockup data.
-- Idempotent: clears existing ov-demo rows first, then re-seeds them.
-- Run after the earlier migrations. Re-running resets the demo to its
-- original mockup (same as Settings -> "Reset Data Demo").
-- ============================================================
begin;

delete from links where event_id = 'ov-demo';
delete from prospects where event_id = 'ov-demo';
delete from budget_items where plan_id in (select id from budget_plans where event_id = 'ov-demo');
delete from budget_plans where event_id = 'ov-demo';
delete from job_harih where event_id = 'ov-demo';
delete from rundown where event_id = 'ov-demo';
delete from teams where event_id = 'ov-demo';
delete from tasks where event_id = 'ov-demo';
delete from members where event_id = 'ov-demo';

insert into events(id,code,title,partner,campus,type,mode,cabinet,event_date,plan_start,plan_end,location,status,"order")
values ('ov-demo','DEMO','Ormawa Visit Demo','Himpunan Demo','Universitas Contoh','external','offline','Sandbox','2026-09-20','2026-08-01','2026-09-19','Ruang Demo, Gedung Contoh','planning',100)
on conflict (id) do update set code=excluded.code,title=excluded.title,partner=excluded.partner,campus=excluded.campus,type=excluded.type,mode=excluded.mode,cabinet=excluded.cabinet,event_date=excluded.event_date,plan_start=excluded.plan_start,plan_end=excluded.plan_end,location=excluded.location,status=excluded.status,"order"=excluded."order";

-- members
insert into members(event_id,name,nickname,nrp,type,year,division) values ('ov-demo','Budi Santoso','Budi','5026221001','fungsionaris',2022,'EVENT');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('ov-demo','Siti Rahma','Siti','5026221002','fungsionaris',2022,'SECRETARY');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('ov-demo','Andi Wijaya','Andi','5026231003','fungsionaris',2023,'LO');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('ov-demo','Dewi Lestari','Dewi','5026231004','fungsionaris',2023,'CREATIVE');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('ov-demo','Rizky Pratama','Rizky','5026231005','fungsionaris',2023,'MARKETING');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('ov-demo','Putri Anggraini','Putri','5026241006','intern',2024,'CONSUMPTION');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('ov-demo','Fajar Nugroho','Fajar','5026241007','intern',2024,'OPERATIONAL');
insert into members(event_id,name,nickname,nrp,type,year,division) values ('ov-demo','Maya Kusuma','Maya','5026241008','intern',2024,'EVENT');

-- tasks
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','EVENT','1','Budi','Susun konsep acara Ormawa Visit Demo','2026-08-01',null,'2026-08-10',null,null,null,'ongoing');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','EVENT','2','Maya','Buat rundown acara','2026-08-11',null,'2026-08-20',null,null,null,'todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','EVENT','3','Budi','Evaluasi & laporan akhir','2026-09-21',null,'2026-09-30',null,null,null,'todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','SECRETARY','1','Siti','Buat proposal & surat-menyurat','2026-08-01',null,'2026-08-08',null,null,null,'done');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','SECRETARY','2','Siti','Notulensi & absensi peserta','2026-09-20',null,'2026-09-20',null,null,null,'todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','LO','1','Andi','Koordinasi dengan himpunan partner','2026-08-05',null,'2026-08-25',null,null,null,'ongoing');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','LO','2','Andi','Follow up konfirmasi kehadiran','2026-09-01',null,'2026-09-15',null,null,null,'todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','CREATIVE','1','Dewi','Desain feeds & poster publikasi','2026-08-10',null,'2026-08-18',null,null,null,'done');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','CREATIVE','2','Dewi','Siapkan dokumentasi acara','2026-09-19',null,'2026-09-20',null,null,null,'todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','MARKETING','1','Rizky','Publikasi di media sosial','2026-08-18',null,'2026-09-18',null,null,null,'ongoing');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','CONSUMPTION','1','Putri','Pesan konsumsi peserta','2026-09-10',null,'2026-09-19',null,null,null,'todo');
insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values ('ov-demo','OPERATIONAL','1','Fajar','Siapkan perlengkapan & ruangan','2026-09-15',null,'2026-09-19',null,null,null,'overtime');

-- budget
with p as (insert into budget_plans(name,event_id) values ('RAB Ormawa Visit Demo','ov-demo') returning id)
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
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values ('ov-demo','A',1,'08:00','08:30',null,'Registrasi peserta','Semua panitia',null,null,null,null,null,null,null,null);
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values ('ov-demo','A',2,'08:30','09:00',null,'Pembukaan & sambutan','MC',null,null,null,null,null,null,null,null);
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values ('ov-demo','A',3,'09:00','10:30',null,'Sesi sharing & FGD','Moderator',null,null,null,null,null,null,null,null);
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values ('ov-demo','A',4,'10:30','11:30',null,'Games & networking','Event',null,null,null,null,null,null,null,null);
insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values ('ov-demo','A',5,'11:30','12:00',null,'Penutupan & dokumentasi','MC',null,null,null,null,null,null,null,null);

-- job hari-h
insert into job_harih(event_id,no,pic,job,notes) values ('ov-demo','1','Maya','MC Acara',null);
insert into job_harih(event_id,no,pic,job,notes) values ('ov-demo','2','Siti','Registrasi & absensi',null);
insert into job_harih(event_id,no,pic,job,notes) values ('ov-demo','3','Dewi','Dokumentasi foto/video',null);
insert into job_harih(event_id,no,pic,job,notes) values ('ov-demo','4','Andi','LO himpunan partner',null);
insert into job_harih(event_id,no,pic,job,notes) values ('ov-demo','5','Putri, Fajar','Konsumsi & perlengkapan',null);

-- teams
insert into teams(event_id,division,fungsionaris,intern) values ('ov-demo','EVENT','Budi, Maya',null);
insert into teams(event_id,division,fungsionaris,intern) values ('ov-demo','SECRETARY','Siti',null);
insert into teams(event_id,division,fungsionaris,intern) values ('ov-demo','LO','Andi',null);
insert into teams(event_id,division,fungsionaris,intern) values ('ov-demo','CREATIVE','Dewi',null);
insert into teams(event_id,division,fungsionaris,intern) values ('ov-demo','MARKETING','Rizky',null);
insert into teams(event_id,division,fungsionaris,intern) values ('ov-demo','CONSUMPTION',null,'Putri');
insert into teams(event_id,division,fungsionaris,intern) values ('ov-demo','OPERATIONAL',null,'Fajar');

-- prospects
insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('ov-demo','Demo','1',null,null,null,'Himpunan Demo A','Universitas Contoh',null,'Andi','DIHUBUNGI','DITERIMA',null,false,'demo');
insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('ov-demo','Demo','2',null,null,null,'Himpunan Demo B','Institut Sample',null,'Andi','MENGHUBUNGI','DITUNGGU',null,false,'demo');
insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('ov-demo','Demo','3',null,null,null,'Himpunan Demo C','Politeknik Uji',null,'Budi','DIHUBUNGI','DITOLAK',null,false,'demo');
insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values ('ov-demo','Demo','4',null,null,null,'Himpunan Demo D','Universitas Placeholder',null,null,null,null,null,false,'demo');

-- links
insert into links(event_id,section,division,name,url,note,source) values ('ov-demo','Proposal','SECRETARY','Proposal Ormawa Visit Demo','https://example.com/proposal-demo',null,'demo');
insert into links(event_id,section,division,name,url,note,source) values ('ov-demo','Desain','CREATIVE','Folder Desain','https://example.com/desain-demo',null,'demo');
insert into links(event_id,section,division,name,url,note,source) values ('ov-demo','Dokumentasi','CREATIVE','Drive Dokumentasi','https://example.com/dokumentasi-demo',null,'demo');
insert into links(event_id,section,division,name,url,note,source) values ('ov-demo','Formulir','EVENT','Form Pendaftaran Peserta','https://example.com/form-demo',null,'demo');

commit;
