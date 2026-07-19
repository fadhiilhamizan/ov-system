// One-off seed migration for v1.6.0. Idempotent.
//  - divisions: add exclude_from_rundown (default false).
//  - rundown: build division_jobs from the old job_* columns, operator from
//    opr_link, and drop the legacy host/opr_link/job_* fields.
// Run: node scripts/seed-1_6.mjs   (then: node scripts/gen-seed-sql.mjs)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = join(__dirname, "../src/lib/seed/seed.json");
const db = JSON.parse(readFileSync(SEED, "utf8"));

for (const d of db.divisions) {
  if (d.exclude_from_rundown === undefined) d.exclude_from_rundown = false;
}

const MAP = {
  job_lo: "LO",
  job_event: "EVENT",
  job_consump: "CONSUMPTION",
  job_creative: "CREATIVE",
  job_opr: "OPERATIONAL",
};

let converted = 0;
for (const r of db.rundown) {
  if (r.division_jobs === undefined) {
    const dj = {};
    for (const [field, key] of Object.entries(MAP)) {
      const val = (r[field] ?? "").toString().trim();
      if (val) dj[key] = val;
    }
    r.division_jobs = dj;
    converted++;
  }
  if (r.operator === undefined) r.operator = (r.opr_link ?? "").toString();
  // drop legacy fields
  delete r.host;
  delete r.opr_link;
  delete r.job_lo;
  delete r.job_event;
  delete r.job_consump;
  delete r.job_creative;
  delete r.job_opr;
}

writeFileSync(SEED, JSON.stringify(db, null, 2) + "\n", "utf8");
console.log(`seed.json updated: divisions exclude flag added; rundown converted (${converted} rows) to division_jobs + operator.`);
