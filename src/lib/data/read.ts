import "server-only";

// ============================================================
// What a READ does when Supabase returns an error.
//
// Every getter used to destructure `data` alone and hand back an empty list.
// That is a lie with a very specific shape: a dropped connection, a revoked
// column grant, an expired token or a malformed query all render as "there is
// nothing here", and nothing downstream can tell that apart from an edition
// that genuinely has no tasks yet. The roster page said the roster was empty;
// Violet grounded an answer on nothing and answered confidently.
//
// (Note it is NOT how an RLS read denial looks. A `select` with no matching
// policy filters rows away silently - it returns zero rows, not an error. The
// errors this catches are the operational ones, and those are exactly the ones
// worth showing.)
//
// So: one exception, and it is narrow. This project ships several databases at
// different migration levels on purpose - the demo project is pinned at 0001
// to 0018 plus 0027, and the Himpunan tables only arrive with 0040 - so a table
// that is simply not there yet is a known state, not a fault, and degrading to
// an empty list is what keeps those pages rendering. Everything else throws and
// reaches the segment error boundary, which says the page failed to load and
// offers a retry. That is the honest answer.
// ============================================================

/**
 * The error means "this part of the schema is not in this database".
 *
 * `42P01` is Postgres for an unknown table and `42703` for an unknown column;
 * `PGRST205`/`PGRST204` are PostgREST's own equivalents, raised from its schema
 * cache before the query is ever sent. The message test is the backstop, since
 * the code is occasionally absent on cache misses.
 */
export function isSchemaGap(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703") return true;
  if (error.code === "PGRST205" || error.code === "PGRST204") return true;
  return /does not exist|schema cache/i.test(error.message ?? "");
}

/**
 * Run a read, or throw.
 *
 * `fallback` is returned ONLY for a schema gap (see above), and the skip is
 * logged so a database that quietly lost a table is still visible in the server
 * output rather than looking like an empty edition forever.
 *
 * @param what short label for the log line, e.g. "tasks"
 */
export async function readRows<T>(
  what: string,
  op: PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>,
  fallback: T,
): Promise<T> {
  const { data, error } = await op;
  if (error) {
    if (isSchemaGap(error)) {
      console.warn(`[read] ${what}: skipped, not in this database (${error.message})`);
      return fallback;
    }
    throw new Error(`${what}: ${error.message}`);
  }
  return data ?? fallback;
}
