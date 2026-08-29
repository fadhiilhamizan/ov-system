// Next.js 16 renamed `middleware` → `proxy` (nodejs runtime).
// Refreshes the Supabase auth session on each request. When Supabase
// is not configured, this is a no-op so the local demo keeps working.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Demo mode runs against a separate Supabase project with the anon key and no
  // login - skip the production session refresh + auth redirect entirely.
  const demoConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY;
  if (demoConfigured && request.cookies.get("ov_demo")?.value === "1") {
    return NextResponse.next();
  }

  // Demo / local mode - do nothing.
  if (!url || !anon) return NextResponse.next();

  // Skip the auth round-trip on router prefetch requests - they don't need a
  // session refresh, and prefetching the whole sidebar would otherwise fire a
  // burst of getUser() calls (slow + hits Supabase auth rate limits).
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    (request.headers.get("sec-purpose") ?? "").includes("prefetch");
  if (isPrefetch) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touch the session so it stays fresh, and find out whether one exists.
  //
  // `getSession()`, NOT `getUser()`. The difference is a network call: getUser
  // asks the auth server to validate the token on EVERY request, and the app
  // layout then calls getUser again a moment later, so each navigation paid two
  // round trips to Supabase to answer the same question. getSession reads the
  // signed cookie locally and only goes to the network when the token actually
  // needs refreshing, which is rare.
  //
  // The trade-off is that a session read this way is not server-validated, so a
  // forged cookie could get past THIS check. That is fine, and deliberate: what
  // happens next is `getCurrentUser()` in the app layout calling `getUser()` for
  // real, which rejects it and redirects to /login one hop later. And RLS, which
  // is the boundary that actually matters here, never sees a valid identity
  // either way. This gate is a fast pre-filter; it was never the thing keeping
  // anyone out.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  // Defense-in-depth route protection: block unauthenticated access to the
  // app before the page renders. Mirrors getCurrentUser() in lib/auth.ts -
  // the guest cookie is an allowed read-only bypass. The public paths are
  // listed below, by name. The per-page redirect in the layout is the
  // authoritative one.
  // /signup and /auth/* (the OAuth code exchange) must stay reachable without
  // a session - that's the whole point of signing up. The legal pages are
  // public too: you have to be able to read them BEFORE agreeing to them.
  //
  // There is deliberately NO blanket /api exemption. This app has no /api
  // routes, so the entry only ever meant that the first one somebody adds
  // would be born unauthenticated. A route that needs to be public says so
  // here, by name.
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" ||
    path === "/signup" ||
    path === "/privacy" ||
    path === "/terms" ||
    path.startsWith("/auth/");
  const isGuest = request.cookies.get("ov_guest")?.value === "1";
  if (!user && !isGuest && !isPublic) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
