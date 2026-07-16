import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { getEvents } from "@/lib/data/repo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, activeEvent] = await Promise.all([getCurrentUser(), getActiveEvent()]);
  const events = getEvents();

  return (
    <AppShell user={user} events={events} activeEventId={activeEvent.id}>
      {children}
    </AppShell>
  );
}
