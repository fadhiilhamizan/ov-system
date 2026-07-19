import { createBrowserClient } from "@supabase/ssr";
import { DEMO_COOKIE, demoConfigured, supabaseCreds } from "@/lib/demo";

/** Is the browser currently in demo mode (cookie set + demo project configured)? */
function isDemoBrowser(): boolean {
  if (typeof document === "undefined") return false;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${DEMO_COOKIE}=`));
  return hit?.split("=")[1] === "1" && demoConfigured();
}

/** Browser Supabase client. Routes to the demo project in demo mode. */
export function createClient() {
  const { url, key } = supabaseCreds(isDemoBrowser());
  return createBrowserClient(url!, key!);
}

export const isSupabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
export const isDemoConfigured = demoConfigured();
