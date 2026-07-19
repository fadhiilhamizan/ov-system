// One-off seed migration for v1.5.0. Idempotent.
//  1) Fix each member's `year` (angkatan) from their NRP.
//  2) Delete the wrong ov2-2026 (HMSI ITS x HMD Eksternal) budget plans.
//  3) Ensure no legacy "ov-demo" rows linger in the REAL database — the demo
//     now lives in a SEPARATE Supabase project (see scripts/gen-demo-seed.mjs).
// Run: node scripts/seed-1_5.mjs   (then: node scripts/gen-seed-sql.mjs)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = join(__dirname, "../src/lib/seed/seed.json");
const db = JSON.parse(readFileSync(SEED, "utf8"));

const DEMO = "ov-demo";

function angkatanFromNrp(nrp) {
  const digits = String(nrp ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  const yy = parseInt(digits.slice(4, 6), 10);
  if (Number.isNaN(yy)) return null;
  const year = 2000 + yy;
  if (year < 2000 || year > new Date().getFullYear() + 1) return null;
  return year;
}

// ---- 1) angkatan from NRP ----
let fixed = 0;
for (const m of db.members) {
  const y = angkatanFromNrp(m.nrp);
  if (y && m.year !== y) {
    m.year = y;
    fixed++;
  }
}
console.log(`members: angkatan fixed for ${fixed}/${db.members.length}`);

// ---- 2) delete wrong ov2-2026 budget ----
const beforeBudget = db.budgetPlans.length;
db.budgetPlans = db.budgetPlans.filter((b) => b.event_id !== "ov2-2026");
console.log(`budgetPlans: removed ${beforeBudget - db.budgetPlans.length} ov2-2026 plan(s)`);

// ---- 3) strip any legacy demo rows from the REAL database ----
db.events = db.events.filter((e) => e.id !== DEMO);
db.members = db.members.filter((m) => m.event_id !== DEMO);
db.tasks = db.tasks.filter((t) => t.event_id !== DEMO);
db.budgetPlans = db.budgetPlans.filter((b) => b.event_id !== DEMO);
db.rundown = db.rundown.filter((r) => r.event_id !== DEMO);
db.jobHariH = db.jobHariH.filter((j) => j.event_id !== DEMO);
db.teams = db.teams.filter((t) => t.event_id !== DEMO);
db.prospects = db.prospects.filter((p) => p.event_id !== DEMO);
db.links = db.links.filter((l) => l.event_id !== DEMO);

writeFileSync(SEED, JSON.stringify(db, null, 2) + "\n", "utf8");
console.log("seed.json updated: angkatan fixed, wrong budget removed, demo rows stripped from real DB.");
