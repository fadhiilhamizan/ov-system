import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser, USE_SUPABASE } from "@/lib/auth";
import { getActiveEvent, getActiveDivision } from "@/lib/session";
import { getEvents, divisionStats } from "@/lib/data/repo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, activeEvent, events, activeDivision] = await Promise.all([
    getCurrentUser(),
    getActiveEvent(),
    getEvents(),
    getActiveDivision(),
  ]);

  // Divisions that actually appear in the currently open Ormawa Visit.
  const stats = await divisionStats(activeEvent.id);
  const divisions = stats.map((s) => s.division);

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
