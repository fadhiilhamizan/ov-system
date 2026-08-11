// One-off repair for v1.19.0 - restores the legacy team rosters in the local
// JSON seed from the generated supabase/seed.sql (the two are kept in sync by
// `npm run db:seed`, so seed.sql is the reliable copy).
//
// Context: the division team structure is now DERIVED from each member's own
// `divisions`. The legacy seed's team rosters are SPACE-separated free text
// ("Vika Daniel Mba Tahe") that cannot be split reliably into names, so they
// are NOT folded into the members here - the UI keeps showing them as a
// fallback for any division that has no members assigned yet. Real (Supabase)
// data uses comma-separated rosters and is migrated properly by 0027.
//
// Usage: node scripts/seed-1_19.mjs   (then: npm run db:seed)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedFile = join(__dirname, "../src/lib/seed/seed.json");
const sqlFile = join(__dirname, "../supabase/seed.sql");

const seed = JSON.parse(readFileSync(seedFile, "utf8"));
const sql = readFileSync(sqlFile, "utf8");

const unq = (v) => (v === "null" ? "" : v.slice(1, -1).replace(/''/g, "'"));
// insert into teams(event_id,division,fungsionaris,intern) values ('x','y','z','w');
const re = /insert into teams\(event_id,division,fungsionaris,intern\) values \((.+?)\);/g;
const rows = new Map();
for (const m of sql.matchAll(re)) {
  const parts = m[1].match(/'(?:[^']|'')*'|null/g) ?? [];
  if (parts.length < 4) continue;
  const [event_id, division, fungsionaris, intern] = parts.map(unq);
  rows.set(`${event_id}::${division}`, { fungsionaris, intern });
}

let restored = 0;
for (const t of seed.teams) {
  const row = rows.get(`${t.event_id}::${t.division}`);
  if (!row) continue;
  t.fungsionaris = row.fungsionaris;
  t.intern = row.intern;
  t.coordinator = t.coordinator ?? "";
  restored++;
}

// Members: make the multi-division field explicit, seeded from the legacy
// single column (empty for the legacy roster - that's expected).
let withDivision = 0;
for (const m of seed.members) {
  m.divisions = m.divisions?.length ? m.divisions : m.division ? [m.division] : [];
  m.division = m.divisions[0] ?? null;
  if (m.division) withDivision++;
}

writeFileSync(seedFile, JSON.stringify(seed, null, 2) + "\n", "utf8");
console.log(`teams restored from seed.sql: ${restored}/${seed.teams.length}`);
console.log(`members: ${seed.members.length}, with a primary division: ${withDivision}`);
