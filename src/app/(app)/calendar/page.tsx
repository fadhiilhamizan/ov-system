import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { getDivisions, getEvents, getMembers, getTasks } from "@/lib/data/repo";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { CalendarView } from "@/components/calendar/calendar-view";
import { MembersProvider } from "@/components/members/members-context";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Kalender" };

export default async function CalendarPage() {
  const [event, user, t] = await Promise.all([getActiveEvent(), getCurrentUser(), getT()]);
  const [tasks, divisions, events, members] = await Promise.all([
    getTasks({ event_id: event.id }),
    getDivisions(event.id),
    getEvents(),
    getMembers(event.id),
  ]);

  const dated = tasks.filter((t) => t.end_date);
  const initialMonth =
    event.event_date?.slice(0, 7) ??
    dated[0]?.end_date?.slice(0, 7) ??
    new Date().toISOString().slice(0, 7);

  return (
    <div>
      <PageHeader
        title={t("Kalender")}
        description={t("Deadline tugas & hari pelaksanaan dalam satu tampilan. Klik tanggal untuk detail atau menambah tugas.")}
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <MembersProvider members={members}>
        <CalendarView
          tasks={tasks}
          divisions={divisions}
          events={events}
          event={event}
          activeEventId={event.id}
          user={user}
          initialMonth={initialMonth}
        />
      </MembersProvider>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {divisions
          .filter((d) => dated.some((t) => t.division === d.key))
          .map((d) => (
            <span key={d.key} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
              {d.name}
            </span>
          ))}
      </div>
    </div>
  );
}
