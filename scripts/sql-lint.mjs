// ============================================================
// A tiny PostgreSQL lexer used to sanity-check GENERATED .sql before it is
// written to disk. It does not understand SQL semantics — it only tracks how
// the text is quoted, which is exactly where the generators kept going wrong:
//
//   1. a value containing a single quote emitted as '…'…'…' (unbalanced), and
//   2. a `do $$ … $$` block whose COMMENT contained "$$", silently ending the
//      block early — dollar-quoting is lexical, so `--` does not protect it.
//
// Both produce SQL that looks fine to read and fails in the SQL editor.
// Usage: assertSqlSane(sql, "demo-seed.sql")
// ============================================================

/** Statement-leading keywords the generators are allowed to emit. */
const STATEMENT_HEADS = new Set([
  "alter", "begin", "comment", "commit", "create", "delete", "do", "drop",
  "grant", "insert", "revoke", "select", "set", "truncate", "update", "with",
]);

/**
 * Split `sql` into top-level statements, ignoring semicolons that sit inside
 * strings, dollar-quoted bodies, or comments. Throws if anything is left open.
 */
export function lexStatements(sql, label = "sql", { nested = false } = {}) {
  const statements = [];
  let current = "";
  let i = 0;
  let line = 1;

  const at = (n) => sql.slice(i, i + n);
  const fail = (msg) => {
    throw new Error(`${label}: ${msg} (line ${line})`);
  };

  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "\n") line++;

    // ---- line comment ----
    if (at(2) === "--") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      continue;
    }

    // ---- block comment (nestable in Postgres) ----
    if (at(2) === "/*") {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql[i] === "\n") line++;
        if (at(2) === "/*") { depth++; i += 2; continue; }
        if (at(2) === "*/") { depth--; i += 2; continue; }
        i++;
      }
      if (depth > 0) fail("unterminated /* block comment");
      continue;
    }

    // ---- single-quoted string ('' is an escaped quote) ----
    if (ch === "'") {
      const startLine = line;
      i++;
      for (;;) {
        if (i >= sql.length) {
          throw new Error(`${label}: unterminated ' string opened on line ${startLine}`);
        }
        if (sql[i] === "\n") line++;
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { i += 2; continue; } // escaped quote
          i++;
          break;
        }
        i++;
      }
      // `'abc'def` is never valid SQL — it means a quote closed earlier than
      // intended, which is exactly what an un-escaped value produces when it is
      // interpolated into a '…' literal. Catching it here is the whole point:
      // the quotes still BALANCE, so nothing else would notice.
      if (/[A-Za-z0-9_]/.test(sql[i] ?? "")) {
        throw new Error(
          `${label}: string literal opened on line ${startLine} is followed directly by ` +
            `"${sql.slice(i, i + 20)}" — a quote closed early. Escape the value ('' ) or ` +
            `dollar-quote the statement.`,
        );
      }
      current += "''"; // collapse to an empty literal; content is irrelevant here
      continue;
    }

    // ---- double-quoted identifier ----
    if (ch === '"') {
      const startLine = line;
      i++;
      while (i < sql.length && sql[i] !== '"') {
        if (sql[i] === "\n") line++;
        i++;
      }
      if (i >= sql.length) fail(`unterminated " identifier opened on line ${startLine}`);
      i++;
      current += "x";
      continue;
    }

    // ---- dollar-quoted string: $tag$ … $tag$ ----
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
    if (dollar) {
      const tag = dollar[0];
      const startLine = line;
      const close = sql.indexOf(tag, i + tag.length);
      if (close === -1) {
        throw new Error(`${label}: unterminated ${tag} block opened on line ${startLine}`);
      }
      const body = sql.slice(i + tag.length, close);
      // Recurse: a plpgsql body has its own string literals, and a bad quote in
      // there (e.g. inside an EXECUTE) is invisible from out here.
      lexStatements(body, `${label} (inside ${tag} on line ${startLine})`, { nested: true });
      line += (body.match(/\n/g) ?? []).length;
      i = close + tag.length;
      current += "''";
      continue;
    }

    // ---- statement terminator ----
    if (ch === ";") {
      statements.push({ text: current.trim(), line });
      current = "";
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  // A nested (plpgsql) body legitimately ends with `end` and no trailing ';'.
  if (!nested && current.trim()) {
    throw new Error(`${label}: trailing text after the last ';' — "${current.trim().slice(0, 60)}"`);
  }
  return statements;
}

/**
 * Throw unless every top-level statement starts with a plausible keyword. This
 * is what catches a prematurely-closed dollar block: the leftover tail shows up
 * as its own "statement" starting with punctuation.
 */
export function assertSqlSane(sql, label = "sql") {
  const statements = lexStatements(sql, label);
  for (const { text, line } of statements) {
    if (!text) continue;
    const head = (/^[A-Za-z_]+/.exec(text) ?? [""])[0].toLowerCase();
    if (!STATEMENT_HEADS.has(head)) {
      throw new Error(
        `${label}: statement ending on line ${line} does not start with a SQL keyword ` +
          `(got "${text.slice(0, 60)}"). A dollar-quoted block probably closed early — ` +
          `check for "$$" inside its comments.`,
      );
    }
  }
  assertNoSessionState(sql, label);
  return statements.length;
}

/**
 * Reject SQL whose statements depend on session state surviving between them.
 *
 * A temporary table lives in ONE session. The Supabase SQL editor talks to the
 * database through a connection pooler, so the next statement can land on a
 * different backend — and `create temporary table … on commit drop` is gone by
 * the time a later SELECT reads it. It fails with a bare
 *   ERROR: 42P01: relation "…" does not exist
 * which points at the SELECT and says nothing about the real cause. This shipped
 * once (migration 0030) and cost the user a failed run.
 *
 * Anything that needs intermediate rows must fit in ONE statement: a `WITH …
 * AS (VALUES …)` CTE, or a `DO $$ … $$` block that does all its work internally.
 */
export function assertNoSessionState(sql, label = "sql") {
  // Strip comments and dollar-quoted bodies before matching, so prose that
  // merely mentions the pattern (like this file's own docs) is not flagged.
  const stripped = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1?\$/g, "''");

  const temp = /\bcreate\s+(?:global\s+|local\s+)?(?:temp|temporary)\s+table\b/i.exec(stripped);
  if (temp) {
    const line = stripped.slice(0, temp.index).split("\n").length;
    throw new Error(
      `${label}: "create temporary table" on line ~${line}. A temp table only exists in one ` +
        `session, and the Supabase SQL editor runs through a connection pooler — a later ` +
        `statement can hit a different connection and fail with 'relation does not exist'. ` +
        `Use a "with … as (values …)" CTE inside the single statement that needs it, or do ` +
        `all the work inside one DO block.`,
    );
  }
}
