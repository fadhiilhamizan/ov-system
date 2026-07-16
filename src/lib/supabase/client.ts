import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client. Only used when Supabase env vars are set. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export const isSupabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
