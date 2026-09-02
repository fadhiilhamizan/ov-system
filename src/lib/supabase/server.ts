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
  // Fail with a sentence somebody can act on. The library's own message
  // ("supabaseUrl is required") arrives from inside node_modules on whatever
  // page happened to read data first, and says nothing about which of the four
  // variables is missing or where they go.
  if (!url || !key) {
    throw new Error(
      demo
        ? "Mode demo aktif tapi NEXT_PUBLIC_SUPABASE_DEMO_URL / _ANON_KEY belum diisi. Lihat .env.example."
        : "NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY belum diisi. Salin .env.example ke .env.local dan isi keduanya.",
    );
  }
  return createServerClient(url, key, {
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
