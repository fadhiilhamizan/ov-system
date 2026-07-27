// Checks every .sql file in supabase/ with the lexer in sql-lint.mjs.
// Usage: npm run db:lint
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { assertSqlSane } from "./sql-lint.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../supabase");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".sql") ? [full] : [];
  });
}

let failed = 0;
for (const file of walk(root)) {
  const rel = relative(join(__dirname, ".."), file).replace(/\\/g, "/");
  try {
    const count = assertSqlSane(readFileSync(file, "utf8"), rel);
    console.log(`ok    ${rel} (${count} statements)`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${e.message}`);
  }
}

if (failed) {
  console.error(`\n${failed} file(s) failed.`);
  process.exit(1);
}
console.log("\nAll SQL files parse cleanly.");
