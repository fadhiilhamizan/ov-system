import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser, USE_SUPABASE } from "@/lib/auth";
import { getActiveEvent, getActiveDivision } from "@/lib/session";
import { getEvents, getDivisions } from "@/lib/data/repo";
import { DEMO_COOKIE, demoActive } from "@/lib/demo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Runs on every navigation — keep it light. The division filter uses the
  // (small, cached) divisions table rather than fetching all tasks.
  const activeEvent = await getActiveEvent();
  const [user, events, activeDivision, divisions, store] = await Promise.all([
    getCurrentUser(),
    getEvents(),
    getActiveDivision(),
    getDivisions(activeEvent.id),
    cookies(),
  ]);
  const sandboxMode = demoActive(store.get(DEMO_COOKIE)?.value);

  return (
    <AppShell
      user={user}
      events={events}
      activeEventId={activeEvent.id}
      divisions={divisions}
      activeDivision={activeDivision}
      demoMode={!USE_SUPABASE}
      sandboxMode={sandboxMode}
    >
      {children}
    </AppShell>
  );
}
