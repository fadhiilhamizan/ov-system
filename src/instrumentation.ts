import type { Instrumentation } from "next";
import { createServerClient } from "@supabase/ssr";
import { DEMO_COOKIE, demoActive, supabaseCreds } from "@/lib/demo";
import { reportError } from "@/lib/data/developer-repo";

// ============================================================
// What actually threw on the server, written into the app's own error log.
//
// In production React replaces every server-side render error with one fixed
// sentence and a `digest`, which is a 32-bit hash of the message plus the stack
// (next/dist/shared/lib/hash). It is not reversible, so a boundary report from
// the browser can only ever say "an error occurred in the Server Components
// render" - thirty-one of those sat in the log for two weeks saying nothing
// about the cause. The hash is fine as a JOIN KEY, but something has to hold
// the other side of the join.
//
// `onRequestError` is that something: Next hands it the ORIGINAL error, before
// redaction, together with the same digest the browser sees. Writing both means
// the Developer menu shows the crash twice - once as the browser experienced it
// and once with the real message - and `[digest N]` in each is what lines the
// two up. Redirects and notFound() never reach here: Next resolves those to a
// well-known digest and returns before calling this hook.
//
// It writes through the SAME anon-key, RLS-gated path as every other write in
// this app (AGENTS.md: no code path bypasses the policies, and there is no
// service-role key to bypass them with), so the reporter's session has to come
// from somewhere. `cookies()` is not available - this fires outside the request
// scope React sets up - but the raw headers are passed in, so the session is
// read off those instead. No session means no report, which is correct: the
// error_log insert policy requires `auth.uid()`, and an anonymous crash has no
// account to file under.
// ============================================================

/** Next's own control flow, in case one ever reaches this hook. */
const CONTROL_FLOW = /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/;

function header(
  headers: { [key: string]: string | string[] | undefined },
  name: string,
): string {
  const v = headers[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/**
 * The `Cookie` header as @supabase/ssr wants it.
 *
 * Values arrive percent-encoded (that is how they were serialised into
 * Set-Cookie), and `cookies().getAll()` would have decoded them, so decode here
 * too or the auth token is handed back subtly wrong and every read is anonymous.
 */
function parseCookies(raw: string): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const name = part.slice(0, eq).trim();
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      value = decodeURIComponent(value);
    } catch {
      // A value that is not valid percent-encoding is passed through as-is.
    }
    if (name) out.push({ name, value });
  }
  return out;
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  try {
    const message = err instanceof Error ? err.message : String(err);
    if (!message || CONTROL_FLOW.test(message)) return;

    const digest =
      typeof err === "object" && err !== null && "digest" in err
        ? String((err as { digest?: unknown }).digest ?? "")
        : "";
    if (CONTROL_FLOW.test(digest)) return;

    const jar = parseCookies(header(request.headers, "cookie"));
    // The demo project is pinned below 0039, so it has no error_log at all.
    if (demoActive(jar.find((c) => c.name === DEMO_COOKIE)?.value)) return;
    // No session, no insert policy. Saves a round trip that would only be
    // refused, and keeps a crawler hitting a broken route out of the log.
    if (!jar.some((c) => c.name.startsWith("sb-"))) return;

    const { url, key } = supabaseCreds(false);
    if (!url || !key) return;

    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => jar,
        // Nothing to write back: there is no response to attach a refreshed
        // cookie to from here, and a report must never change the session.
        setAll: () => {},
      },
    });

    await reportError(
      {
        kind: "server",
        // Same `[digest N]` suffix the boundary report carries, so the two
        // halves of one crash group next to each other in the Developer menu.
        message: digest ? `${message} [digest ${digest}]` : message,
        stack: err instanceof Error ? (err.stack ?? "") : "",
        // `routeType` separates a page render from a Server Action or the
        // proxy, which the path alone does not say.
        path: `${request.path} (${context.routeType})`,
        userAgent: header(request.headers, "user-agent"),
      },
      client,
    );
  } catch {
    // A failed error report must never itself become an error - this hook runs
    // inside the request that already failed once.
  }
};
