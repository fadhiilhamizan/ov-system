// Generates supabase/migrations/0014_demo_event.sql from the ov-demo rows in
// seed.json. The migration first clears any existing demo-scoped rows, so it
// is idempotent and mirrors the runtime "Reset Data Demo" behaviour.
// Usage: node scripts/gen-demo-sql.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "../src/lib/seed/seed.json"), "utf8"));

const DEMO = "ov-demo";
const q = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "null" : Number(v));
const b = (v) => (v ? "true" : "false");
const d = (v) => (v ? `'${v}'` : "null");

const e = seed.events.find((x) => x.id === DEMO);
const scoped = (rows) => rows.filter((r) => r.event_id === DEMO);

let out = `-- ============================================================
-- Ormawa Visit "Demo" edition (protected sandbox) + mockup data.
-- Idempotent: clears existing ov-demo rows first, then re-seeds them.
-- Run after the earlier migrations. Re-running resets the demo to its
-- original mockup (same as Settings -> "Reset Data Demo").
-- ============================================================
begin;

delete from links where event_id = '${DEMO}';
delete from prospects where event_id = '${DEMO}';
delete from budget_items where plan_id in (select id from budget_plans where event_id = '${DEMO}');
delete from budget_plans where event_id = '${DEMO}';
delete from job_harih where event_id = '${DEMO}';
delete from rundown where event_id = '${DEMO}';
delete from teams where event_id = '${DEMO}';
delete from tasks where event_id = '${DEMO}';
delete from members where event_id = '${DEMO}';

insert into events(id,code,title,partner,campus,type,mode,cabinet,event_date,plan_start,plan_end,location,status,"order")
values (${q(e.id)},${q(e.code)},${q(e.title)},${q(e.partner)},${q(e.campus)},${q(e.type)},${q(e.mode)},${q(e.cabinet)},${d(e.event_date)},${d(e.plan_start)},${d(e.plan_end)},${q(e.location)},${q(e.status)},${e.order})
on conflict (id) do update set code=excluded.code,title=excluded.title,partner=excluded.partner,campus=excluded.campus,type=excluded.type,mode=excluded.mode,cabinet=excluded.cabinet,event_date=excluded.event_date,plan_start=excluded.plan_start,plan_end=excluded.plan_end,location=excluded.location,status=excluded.status,"order"=excluded."order";

`;

out += `-- members\n`;
for (const m of scoped(seed.members))
  out += `insert into members(event_id,name,nickname,nrp,type,year,division) values (${q(m.event_id)},${q(m.name)},${q(m.nickname)},${q(m.nrp)},${q(m.type)},${n(m.year)},${q(m.division)});\n`;

out += `\n-- tasks\n`;
for (const t of scoped(seed.tasks))
  out += `insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values (${q(t.event_id)},${q(t.division)},${q(t.no)},${q(t.pic)},${q(t.title)},${d(t.start_date)},${q(t.start_raw)},${d(t.end_date)},${q(t.end_raw)},${q(t.notes)},${q(t.result)},${q(t.status)});\n`;

out += `\n-- budget\n`;
for (const plan of seed.budgetPlans.filter((p) => p.event_id === DEMO)) {
  const values = plan.items
    .map((i, idx) => `(${q(i.category)},${n(i.no)},${q(i.name)},${n(i.qty)},${q(i.unit)},${n(i.unit_price)},${n(i.total)},${idx})`)
    .join(",\n    ");
  out += `with p as (insert into budget_plans(name,event_id) values (${q(plan.name)},${q(plan.event_id)}) returning id)\n  insert into budget_items(plan_id,category,no,name,qty,unit,unit_price,total,"order")\n  select p.id, v.* from p, (values\n    ${values}\n  ) as v(category,no,name,qty,unit,unit_price,total,ord);\n\n`;
}

out += `-- rundown\n`;
for (const r of scoped(seed.rundown))
  out += `insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values (${q(r.event_id)},${q(r.variant)},${n(r.no)},${q(r.time_start)},${q(r.time_end)},${q(r.duration)},${q(r.activity)},${q(r.keterangan)},${q(r.host)},${q(r.opr_link)},${q(r.mc)},${q(r.job_lo)},${q(r.job_event)},${q(r.job_consump)},${q(r.job_creative)},${q(r.job_opr)});\n`;

out += `\n-- job hari-h\n`;
for (const j of scoped(seed.jobHariH))
  out += `insert into job_harih(event_id,no,pic,job,notes) values (${q(j.event_id)},${q(j.no)},${q(j.pic)},${q(j.job)},${q(j.notes)});\n`;

out += `\n-- teams\n`;
for (const t of scoped(seed.teams))
  out += `insert into teams(event_id,division,fungsionaris,intern) values (${q(t.event_id)},${q(t.division)},${q(t.fungsionaris)},${q(t.intern)});\n`;

out += `\n-- prospects\n`;
for (const p of scoped(seed.prospects))
  out += `insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values (${q(p.event_id)},${q(p.batch)},${q(p.no)},${q(p.date_text)},${q(p.month)},${q(p.contact)},${q(p.org_name)},${q(p.campus)},${q(p.location)},${q(p.pic)},${q(p.contact_status)},${q(p.their_response)},${q(p.our_response)},${b(p.done)},${q(p.source)});\n`;

out += `\n-- links\n`;
for (const l of scoped(seed.links))
  out += `insert into links(event_id,section,division,name,url,note,source) values (${q(l.event_id)},${q(l.section)},${q(l.division)},${q(l.name)},${q(l.url)},${q(l.note)},${q(l.source)});\n`;

out += `\ncommit;\n`;

writeFileSync(join(__dirname, "../supabase/migrations/0014_demo_event.sql"), out, "utf8");
console.log("Wrote supabase/migrations/0014_demo_event.sql", `(${out.length} chars)`);
