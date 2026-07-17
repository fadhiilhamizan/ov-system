import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser, USE_SUPABASE } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { getEvents } from "@/lib/data/repo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, activeEvent, events] = await Promise.all([
    getCurrentUser(),
    getActiveEvent(),
    getEvents(),
  ]);

  return (
    <AppShell user={user} events={events} activeEventId={activeEvent.id} demoMode={!USE_SUPABASE}>
      {children}
    </AppShell>
  );
}
