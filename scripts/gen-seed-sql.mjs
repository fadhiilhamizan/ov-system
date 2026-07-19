// Generates supabase/seed.sql from the Excel-derived seed.json.
// Usage: node scripts/gen-seed-sql.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "../src/lib/seed/seed.json"), "utf8"));

const q = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "null" : Number(v));
const b = (v) => (v ? "true" : "false");
const d = (v) => (v ? `'${v}'` : "null");

let out = `-- Auto-generated from Excel seed. Run after migrations.\n-- HMSI ITS Ormawa Visit\nbegin;\n\n`;

out += `-- divisions\n`;
for (const x of seed.divisions)
  out += `insert into divisions(key,name,short,color,"order") values (${q(x.key)},${q(x.name)},${q(x.short)},${q(x.color)},${x.order}) on conflict (key) do nothing;\n`;

out += `\n-- events\n`;
for (const e of seed.events)
  out += `insert into events(id,code,title,partner,campus,type,mode,cabinet,event_date,plan_start,plan_end,location,status,"order") values (${q(e.id)},${q(e.code)},${q(e.title)},${q(e.partner)},${q(e.campus)},${q(e.type)},${q(e.mode)},${q(e.cabinet)},${d(e.event_date)},${d(e.plan_start)},${d(e.plan_end)},${q(e.location)},${q(e.status)},${e.order}) on conflict (id) do nothing;\n`;

out += `\n-- members\n`;
for (const m of seed.members)
  out += `insert into members(event_id,name,nickname,nrp,type,year,division) values (${q(m.event_id)},${q(m.name)},${q(m.nickname)},${q(m.nrp)},${q(m.type)},${n(m.year)},${q(m.division)});\n`;

out += `\n-- tasks\n`;
for (const t of seed.tasks)
  out += `insert into tasks(event_id,division,no,pic,title,start_date,start_raw,end_date,end_raw,notes,result,status) values (${q(t.event_id)},${q(t.division)},${q(t.no)},${q(t.pic)},${q(t.title)},${d(t.start_date)},${q(t.start_raw)},${d(t.end_date)},${q(t.end_raw)},${q(t.notes)},${q(t.result)},${q(t.status)});\n`;

out += `\n-- prospects\n`;
for (const p of seed.prospects)
  out += `insert into prospects(event_id,batch,no,date_text,month,contact,org_name,campus,location,pic,contact_status,their_response,our_response,done,source) values (${q(p.event_id)},${q(p.batch)},${q(p.no)},${q(p.date_text)},${q(p.month)},${q(p.contact)},${q(p.org_name)},${q(p.campus)},${q(p.location)},${q(p.pic)},${q(p.contact_status)},${q(p.their_response)},${q(p.our_response)},${b(p.done)},${q(p.source)});\n`;

out += `\n-- links\n`;
for (const l of seed.links)
  out += `insert into links(event_id,section,division,name,url,note,source) values (${q(l.event_id)},${q(l.section)},${q(l.division)},${q(l.name)},${q(l.url)},${q(l.note)},${q(l.source)});\n`;

out += `\n-- budget\n`;
for (const plan of seed.budgetPlans) {
  const values = plan.items
    .map((i, idx) => `(${q(i.category)},${n(i.no)},${q(i.name)},${n(i.qty)},${q(i.unit)},${n(i.unit_price)},${n(i.total)},${idx})`)
    .join(",\n    ");
  out += `with p as (insert into budget_plans(name,event_id) values (${q(plan.name)},${q(plan.event_id)}) returning id)\n  insert into budget_items(plan_id,category,no,name,qty,unit,unit_price,total,"order")\n  select p.id, v.* from p, (values\n    ${values}\n  ) as v(category,no,name,qty,unit,unit_price,total,ord);\n\n`;
}

out += `-- rundown\n`;
for (const r of seed.rundown)
  out += `insert into rundown(event_id,variant,no,time_start,time_end,duration,activity,keterangan,host,opr_link,mc,job_lo,job_event,job_consump,job_creative,job_opr) values (${q(r.event_id)},${q(r.variant)},${n(r.no)},${q(r.time_start)},${q(r.time_end)},${q(r.duration)},${q(r.activity)},${q(r.keterangan)},${q(r.host)},${q(r.opr_link)},${q(r.mc)},${q(r.job_lo)},${q(r.job_event)},${q(r.job_consump)},${q(r.job_creative)},${q(r.job_opr)});\n`;

out += `\n-- job hari-h\n`;
for (const j of seed.jobHariH)
  out += `insert into job_harih(event_id,no,pic,job,notes) values (${q(j.event_id)},${q(j.no)},${q(j.pic)},${q(j.job)},${q(j.notes)});\n`;

out += `\n-- faqs\n`;
seed.faqs.forEach((f, i) => {
  out += `insert into faqs(question,answer,"order") values (${q(f.question)},${q(f.answer)},${i});\n`;
});

out += `\n-- teams\n`;
for (const t of seed.teams)
  out += `insert into teams(event_id,division,fungsionaris,intern) values (${q(t.event_id)},${q(t.division)},${q(t.fungsionaris)},${q(t.intern)});\n`;

out += `\ncommit;\n`;

writeFileSync(join(__dirname, "../supabase/seed.sql"), out, "utf8");
console.log("Wrote supabase/seed.sql", `(${out.length} chars)`);
