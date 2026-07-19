import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DEMO_COOKIE, demoActive, supabaseCreds } from "@/lib/demo";

/**
 * Server Supabase client (App Router, Next.js 16 async cookies).
 *
 * Routes to the SEPARATE demo project when the `ov_demo` cookie is set and a
 * demo project is configured; otherwise to production. This is the single
 * choke point that keeps demo and real data in different databases.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const demo = demoActive(cookieStore.get(DEMO_COOKIE)?.value);
  const { url, key } = supabaseCreds(demo);
  return createServerClient(url!, key!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component - safe to ignore, the proxy
          // refreshes the session.
        }
      },
    },
  });
}
