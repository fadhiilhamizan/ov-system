import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser, USE_SUPABASE } from "@/lib/auth";
import { getActiveEvent, getActiveDivision } from "@/lib/session";
import { getEvents, getDivisions } from "@/lib/data/repo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Runs on every navigation — keep it light. The division filter uses the
  // (small, cached) divisions table rather than fetching all tasks.
  const [user, activeEvent, events, activeDivision, divisions] = await Promise.all([
    getCurrentUser(),
    getActiveEvent(),
    getEvents(),
    getActiveDivision(),
    getDivisions(),
  ]);

  return (
    <AppShell
      user={user}
      events={events}
      activeEventId={activeEvent.id}
      divisions={divisions}
      activeDivision={activeDivision}
      demoMode={!USE_SUPABASE}
    >
      {children}
    </AppShell>
  );
}
