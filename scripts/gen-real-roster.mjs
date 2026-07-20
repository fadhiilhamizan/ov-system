// ============================================================
// Generates supabase/migrations/0019_real_roster.sql — replaces divisions,
// members and teams with HMSI EA's REAL per-Ormawa-Visit roster.
//
// Decisions (from the user):
//  - Divisions are STRICT per OV (exactly the listed team structure); other
//    divisions are removed. Existing TASKS are left untouched — tasks whose
//    division was removed simply lose their badge (orphaned), by choice.
//  - "Koordinator" is a per-division role stored on the team (teams.coordinator).
//  - Division/member NAMES are preserved exactly as given. Nicknames use the
//    [bracket] value, else the name written in the team, else the first
//    non-generic word of the full name.
//  - Division KEYS reuse the old keys where a division maps 1:1, so tasks in
//    kept divisions stay linked (e.g. ACARA keeps key EVENT).
//
// Run:  node scripts/gen-real-roster.mjs
// ============================================================
import { writeFileSync } from "node:fs";

const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const angkatan = (nrp) => 2000 + parseInt(String(nrp).slice(4, 6), 10);

// ---- master name + nickname tables (nickname from [brackets] where given) ----
const NAME = {
  // 2022/2023 fungsionaris
  "5026221210": "Arjuna Putra Kharisma", "5026221012": "Karina Filza Aafiyah",
  "5026221069": "Annisa Fadila Rahmawati", "5026231111": "Nisrina Kamiliya Riswanto",
  "5026221011": "Natasha Yosefani Putri", "5026221080": "Muhammad Fauzan",
  "5026221176": "Agung Budi Prasetya", "5026221194": "Arayzi Rayyansyah",
  "5026231061": "Devika Rahman", "5026231150": "Muhammad Dzaki Adfiz",
  "5026231217": "Rahmadhona Elokpribadi Kusmawan", "5026231161": "Muhammad Daniel Alfarisi",
  "5051231041": "Irhab Faiz Hidayat", "5026231141": "Auliya Malika Idi",
  "5026231172": "Mochammad Zhulmi Danovanz Hidanasukha", "5026231128": "Fadhiil Akmal Hamizan",
  "5026231074": "Burhan Shidqi Arrasyid",
  // 2024 interns (OV2-2025)
  "5026241003": "Agha Aryo Utomo", "5026241004": "Adesya Naila Salsabila",
  "5026241007": "I Gusti Ayu Anindya Septiari", "5026241008": "Aliya Nur Kamila Silia",
  "5026241014": "Audrey Sophia Malona Lumbantobing", "5026241017": "Faiza Aditya Zahratunnisa",
  "5026241028": "Christine Rotua Deborah Hutabarat", "5026241031": "Athilah Syahshiyah Tsabitah",
  "5026241043": "Muhammad Sandhika Setiawan", "5026241050": "Mahda Vekia",
  "5026241053": "Muhammad Aqzhara Fathyan Khairi", "5026241055": "Crystal Reinheart",
  "5026241066": "Pasha Avatar Ardan", "5026241076": "A. Kezia J.I. Manurung",
  "5026241080": "Harunina Irene Syafira", "5026241090": "Alwida Rahmat",
  "5026241112": "Claudio Huge Siburian", "5026241120": "Adelia Maritza Rani",
  "5026241128": "Ahmad 'Aaqila Akbar", "5026241156": "Franzaldi Amarullah Nalandhika",
  "5026241187": "Benedictus Nicholas Christian", "5026241194": "Izaaz Verdiansyah Khaisan Athif",
  "5026241201": "Thalia Harnum Fathina", "5026241204": "Muhammad Armaan Andromeda Harw",
  "5051241003": "Sheva Rafid Fairuz Rifa'i", "5051241013": "Suci Nur Aisyah",
  "5051241024": "Hayyu Izza M SHidqi",
  // OV1-2026 newcomers
  "5026231167": "Khalila Shafarayhani Atletiko", "5026241131": "Rofifah Zain Nur Alfiyah",
  "5026241069": "Muhammad Izzan Aquilla", "5026241183": "Naina Mazaya Putri",
  "5026241165": "Mega Agustina Sihombing", "5026241138": "Mazaya Zharfani Erfindri",
  // OV2-2026 interns (2025 batch)
  "5026251145": "Ahnaf Rayhan Nurducha", "5026251020": "Nastiti Ayu Lestari",
  "5026251031": "Rasya Hafidz Atharachman", "5026251041": "Navita Fitrianti Refani",
  "5026251129": "Tsabita Aulia Rakhmah", "5051251033": "Laysya Pramitha Cahyaning Arum",
  "5026251059": "Zafira Najla Rinjani", "5026251199": "Ghadiza Naura Aliya",
  "5026251176": "Muhammad Mazen Ibrahim", "5026251033": "Valery Dienda Setyabudi",
  "5051251019": "Nesda Yulditia", "5026251006": "Akbar Ariffianto",
  "5051251007": "Maureen Rahmania Maulana", "5026251021": "Alya Mutiara Putri",
  "5026251170": "Priska Fiantika Widyatama", "5026251188": "Refa Thalita Ardila",
  "5026251032": "Tiara Kumala Farid", "5026251158": "Raisa Adintria Rahman",
  "5026251104": "Deaka Rizkia Rahma", "5026251209": "Aryo Gading Kelana",
  "5026251178": "Farrel Danish Virdiansyah", "5026251157": "Famya Lituhayu",
  "5026251175": "Syofia Felanatasya Raka Yudharwita", "5026251127": "Aura Chayara Sultrawiria",
  "5026251029": "Gahyaka Galur Widyatmana", "5026251162": "Ni Luh Putu Raina Pradnya Pramesty",
  "5026251089": "Aulia Safa Az-Zahra", "5026251049": "Dimas Fajar Habibi",
};

const NICK = {
  "5026221210": "Mas Juna", "5026221012": "Mba Karina", "5026221069": "Mba Dila",
  "5026231111": "Nisrina", "5026221011": "Mba Tasha", "5026221080": "Mas Fauzan",
  "5026221176": "Mas Agung", "5026221194": "Mas Aray", "5026231061": "Vika",
  "5026231150": "Dzaki", "5026231217": "Dhone", "5026231161": "Daniel",
  "5051231041": "Irhab", "5026231141": "Aul", "5026231172": "Juno",
  "5026231128": "Fadhiil", "5026231074": "Burhan",
  "5026241003": "Agha", "5026241004": "Naila", "5026241007": "Anin", "5026241008": "Ali",
  "5026241014": "Audrey", "5026241017": "Zahra", "5026241028": "Christine", "5026241031": "Athilah",
  "5026241043": "Sandhik", "5026241050": "Mahda", "5026241053": "Aqzha", "5026241055": "Crystal",
  "5026241066": "Avatar", "5026241076": "Kezia", "5026241080": "Irene", "5026241090": "Alwida",
  "5026241112": "Claudio", "5026241120": "Adel", "5026241128": "Aqil", "5026241156": "Franz",
  "5026241187": "Nicho", "5026241194": "Izaaz", "5026241201": "Thalia", "5026241204": "Andro",
  "5051241003": "Fairuz", "5051241013": "Suci", "5051241024": "Hayyu",
  "5026241069": "Izzan",
};

const GENERIC = new Set(["muhammad","mochammad","muh","ahmad","a","i","ni","luh","putu","made","nyoman","ketut","wayan","gede","kadek","mas","mba","mbak"]);
function firstNonGeneric(name) {
  const words = name.replace(/[.'']/g, "").split(/\s+/).filter(Boolean);
  for (const w of words) if (!GENERIC.has(w.toLowerCase())) return w;
  return words[0] ?? "";
}
const nickOf = (nrp) => NICK[nrp] ?? firstNonGeneric(NAME[nrp]);

// ---- division colour by key (stable across OVs) ----
const COLOR = {
  LO: "#0ea5e9", EVENT: "#6366f1", CONSUMPTION: "#f97316", OPERATIONAL: "#10b981",
  OUTSOURCE: "#64748b", CREATIVE: "#d946ef", SECRETARY: "#8b5cf6", TREASURER: "#f59e0b",
};

// ---- per-event data --------------------------------------------------------
// division: [key, name, short, exclude_from_rundown]
// members:  [nrp, type]
// teams:    { div: key, coordinator, fungsionaris:[...], intern:[...] }
const DATA = {
  "ov1-2025": {
    divisions: [
      ["LO", "LIAISON OFFICER", "LO", false],
      ["EVENT", "ACARA", "ACR", false],
      ["CONSUMPTION", "KONSUMSI", "KON", false],
      ["OPERATIONAL", "KAMZIN & LOGISTIC", "KML", false],
      ["OUTSOURCE", "OUTSOURCE", "OUT", false],
    ],
    members: [
      ["5026221210","fungsionaris"],["5026221012","fungsionaris"],["5026221069","fungsionaris"],
      ["5026231111","fungsionaris"],["5026221011","fungsionaris"],["5026221080","fungsionaris"],
      ["5026221176","fungsionaris"],["5026221194","fungsionaris"],["5026231061","fungsionaris"],
      ["5026231150","fungsionaris"],["5026231217","fungsionaris"],["5026231161","fungsionaris"],
      ["5051231041","fungsionaris"],["5026231141","fungsionaris"],["5026231172","fungsionaris"],
      ["5026231128","fungsionaris"],["5026231074","fungsionaris"],
    ],
    teams: [
      { div: "LO", coordinator: "Devika", fungsionaris: ["Mba Dilla","Aul","Faiz","Devika"], intern: [] },
      { div: "EVENT", coordinator: "Mas Juna", fungsionaris: ["Fadhiil","Dona","Juno","Mba Karina","Nisrin","Mas Juna"], intern: [] },
      { div: "CONSUMPTION", coordinator: "Mba Tasha", fungsionaris: ["Dzaki","Mba Tasha"], intern: [] },
      { div: "OPERATIONAL", coordinator: "Daniel", fungsionaris: ["Burhan","Daniel","Mas Agung","Mas Fauzan"], intern: [] },
      { div: "OUTSOURCE", coordinator: "Mas Aray", fungsionaris: ["Mas Aray"], intern: [] },
    ],
  },
  "ov2-2025": {
    divisions: [
      ["LO", "LIAISON OFFICER", "LO", false],
      ["EVENT", "EVENT", "EVE", false],
      ["CONSUMPTION", "CONSUMPTION", "CON", false],
      ["OPERATIONAL", "OPERATIONAL", "OPR", false],
      ["CREATIVE", "CREATIVE & MARKETING", "CRM", false],
      ["SECRETARY", "SECRETARY", "SEC", true],
      ["TREASURER", "TREASURER", "TRE", true],
    ],
    members: [
      // fungsionaris (same 17 people)
      ...["5026221210","5026221012","5026221069","5026231111","5026221011","5026221080","5026221176","5026221194","5026231061","5026231150","5026231217","5026231161","5051231041","5026231141","5026231172","5026231128","5026231074"].map((n) => [n, "fungsionaris"]),
      // interns (27)
      ...["5026241003","5026241004","5026241007","5026241008","5026241014","5026241017","5026241028","5026241031","5026241043","5026241050","5026241053","5026241055","5026241066","5026241076","5026241080","5026241090","5026241112","5026241120","5026241128","5026241156","5026241187","5026241194","5026241201","5026241204","5051241003","5051241013","5051241024"].map((n) => [n, "intern"]),
    ],
    teams: [
      { div: "LO", coordinator: "Vika", fungsionaris: ["Vika","Daniel","Mba Tahe"], intern: ["Audrey","Irene","Kezia","Mahda","Suci"] },
      { div: "EVENT", coordinator: "Burhan", fungsionaris: ["Burhan","Juno","Mba dila","Mas Agung"], intern: ["Adesya","Avatar","Crystal","Franz","Haqi"] },
      { div: "CONSUMPTION", coordinator: "Nisrina", fungsionaris: ["Nisrina","Mba Karina"], intern: ["Aqil","Aqzha","Christine"] },
      { div: "OPERATIONAL", coordinator: "Faiz", fungsionaris: ["Faiz","Mas Aray"], intern: ["Ali","Andro","Nicho","Claudio","Sandhika"] },
      { div: "CREATIVE", coordinator: "Dzaki", fungsionaris: ["Dzaki","Auliya","Mas Fauzan","Mas Juna"], intern: ["Adel","Agha","Alwida","Anin","Athilah","Fairuz","Izaaz","Thalia"] },
      { div: "SECRETARY", coordinator: "Nisrina", fungsionaris: ["Nisrina"], intern: [] },
      { div: "TREASURER", coordinator: "Dzaki", fungsionaris: ["Dzaki"], intern: [] },
    ],
  },
  "ov1-2026": {
    divisions: [
      ["LO", "LIAISON OFFICER", "LO", false],
      ["EVENT", "EVENT", "EVE", false],
      ["CONSUMPTION", "CONSUMPTION", "CON", false],
      ["OPERATIONAL", "OPERATIONAL", "OPR", false],
      ["OUTSOURCE", "OUTSOURCE", "OUT", false],
    ],
    members: ["5026231141","5026231161","5026231074","5026231167","5026231128","5051231041","5026241131","5026241069","5026241008","5026241050","5026241183","5026241165","5026241138","5026241090","5026241031"].map((n) => [n, "fungsionaris"]),
    teams: [
      { div: "LO", coordinator: "Mahda", fungsionaris: ["Mahda","Mba Lila"], intern: [] },
      { div: "EVENT", coordinator: "Ali", fungsionaris: ["Ali","Naina","Izzan","Mazay","Mas padil"], intern: [] },
      { div: "CONSUMPTION", coordinator: "Atilah", fungsionaris: ["Atilah","Mas daniel"], intern: [] },
      { div: "OPERATIONAL", coordinator: "Alwida", fungsionaris: ["Alwida","Mas burhan","Mas irhab"], intern: [] },
      { div: "OUTSOURCE", coordinator: "Mba Aul", fungsionaris: ["Mba Aul"], intern: [] },
    ],
  },
  "ov2-2026": {
    // Struktur team: BELUM ADA — no divisions, no teams yet, roster only.
    divisions: [],
    members: [
      ...["5026231141","5026231161","5026231074","5026231167","5026231128","5051231041","5026241131","5026241069","5026241008","5026241050","5026241183","5026241165","5026241138","5026241090","5026241031"].map((n) => [n, "fungsionaris"]),
      ...["5026251145","5026251020","5026251031","5026251041","5026251129","5051251033","5026251059","5026251199","5026251176","5026251033","5051251019","5026251006","5051251007","5026251021","5026251170","5026251188","5026251032","5026251158","5026251104","5026251209","5026251178","5026251157","5026251175","5026251127","5026251029","5026251162","5026251089","5026251049"].map((n) => [n, "intern"]),
    ],
    teams: [],
  },
};

// ---- division resolution for member.division (best-effort) ------------------
const norm = (s) => s.toLowerCase().replace(/^(mas|mba|mbak|kak)\s+/,"").replace(/[^a-z0-9]/g,"");
function memberDivision(ev, nrp) {
  const nick = norm(nickOf(nrp));
  const first = norm(firstNonGeneric(NAME[nrp]));
  for (const tm of DATA[ev].teams) {
    const tokens = [tm.coordinator, ...tm.fungsionaris, ...tm.intern].map(norm);
    if (tokens.includes(nick) || tokens.includes(first)) return tm.div;
  }
  return null;
}

// ---- emit SQL --------------------------------------------------------------
const EVENTS = Object.keys(DATA);
let out = `-- ============================================================
-- 0019 — Replace divisions / members / teams with HMSI EA's real per-OV roster.
-- Generated by scripts/gen-real-roster.mjs — do not edit by hand.
--
-- Divisions become STRICT per OV; existing tasks are left as-is (tasks under a
-- removed division lose their badge, by design). "Koordinator" is a per-division
-- role on teams.coordinator. Run after 0001-0018.
-- ============================================================
begin;

-- Coordinator role on the team (idempotent).
alter table teams add column if not exists coordinator text default '';

-- Wipe the old dummy divisions/members/teams (tasks/rundown/budget untouched).
delete from teams;
delete from members;
delete from divisions;

`;

for (const ev of EVENTS) {
  const d = DATA[ev];
  out += `-- ---------- ${ev} ----------\n`;
  d.divisions.forEach(([key, name, short, excl], i) => {
    out += `insert into divisions(event_id,key,name,short,color,"order",exclude_from_rundown) values (${q(ev)},${q(key)},${q(name)},${q(short)},${q(COLOR[key] ?? "#6366f1")},${i + 1},${excl}) on conflict (event_id,key) do nothing;\n`;
  });
  for (const [nrp, type] of d.members) {
    const div = memberDivision(ev, nrp);
    out += `insert into members(event_id,name,nickname,nrp,type,year,division) values (${q(ev)},${q(NAME[nrp])},${q(nickOf(nrp))},${q(nrp)},${q(type)},${angkatan(nrp)},${div ? q(div) : "null"});\n`;
  }
  for (const tm of d.teams) {
    out += `insert into teams(event_id,division,coordinator,fungsionaris,intern) values (${q(ev)},${q(tm.div)},${q(tm.coordinator)},${q(tm.fungsionaris.join(", "))},${q(tm.intern.join(", "))});\n`;
  }
  out += `\n`;
}

out += `commit;\n`;

const path = "supabase/migrations/0019_real_roster.sql";
writeFileSync(path, out);
console.log(`wrote ${path}`);
// quick summary
for (const ev of EVENTS) {
  const d = DATA[ev];
  const withDiv = d.members.filter((m) => memberDivision(ev, m[0])).length;
  console.log(`  ${ev}: ${d.divisions.length} div, ${d.members.length} members (${withDiv} w/ division), ${d.teams.length} teams`);
}
