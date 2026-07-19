// Next.js 16 renamed `middleware` → `proxy` (nodejs runtime).
// Refreshes the Supabase auth session on each request. When Supabase
// is not configured, this is a no-op so the local demo keeps working.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Demo mode runs against a separate Supabase project with the anon key and no
  // login — skip the production session refresh + auth redirect entirely.
  const demoConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_DEMO_ANON_KEY;
  if (demoConfigured && request.cookies.get("ov_demo")?.value === "1") {
    return NextResponse.next();
  }

  // Demo / local mode — do nothing.
  if (!url || !anon) return NextResponse.next();

  // Skip the auth round-trip on router prefetch requests — they don't need a
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

  // Touch the session so it stays fresh (also tells us if the user is signed in).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense-in-depth route protection: block unauthenticated access to the
  // app before the page renders. Mirrors getCurrentUser() in lib/auth.ts —
  // the guest cookie is an allowed read-only bypass. Public paths (login,
  // API routes with their own auth) are exempt. The per-page redirect in the
  // layout stays as a second layer.
  const path = request.nextUrl.pathname;
  const isPublic = path === "/login" || path.startsWith("/api");
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
