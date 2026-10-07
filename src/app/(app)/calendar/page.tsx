import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { attenuate } from "@/lib/permissions";
import { getDivisions, getEvents, getSuperLinkDirectory, getLinkRefCounts, getMembers, getRundown, getTasks, getTaskLinksByEvent, getTaskRefsByEvent, getTaskCommentsByEvent, getTeams } from "@/lib/data/repo";
import { isCalView, parseYmd } from "@/lib/calendar";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { CalendarView } from "@/components/calendar/calendar-view";
import { MembersProvider } from "@/components/members/members-context";
import { TaskLinksProvider } from "@/components/tasks/task-links-context";
import { TaskCommentsProvider } from "@/components/tasks/task-comments-context";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Kalender" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const [event, user, t] = await Promise.all([getActiveEvent(), getCurrentUser(), getT()]);
  // Clicking a date opens the same task dialog as Work Breakdown, so this page
  // needs the reference data too: without it the editor has no Super Link
  // picker and cannot show what the task already references.
  const [tasks, divisions, events, members, taskLinks, taskRefs, taskComments, superLinks, teams, refCounts, rundown] = await Promise.all([
    getTasks({ event_id: event.id }),
    getDivisions(event.id),
    getEvents(),
    getMembers(event.id),
    getTaskLinksByEvent(event.id),
    getTaskRefsByEvent(event.id),
    getTaskCommentsByEvent(event.id),
    getSuperLinkDirectory(),
    getTeams(event.id),
    getLinkRefCounts(),
    // The Hari-H time grid places these by the clock.
    getRundown(event.id, "A"),
  ]);

  const dated = tasks.filter((t) => t.end_date);
  // ?view=&date= reopen the same place (the calendar writes them as you move).
  // Otherwise: the edition's Hari-H, else its first deadline, else today.
  const initialView = isCalView(sp.view) ? sp.view : "month";
  const initialDate =
    (parseYmd(sp.date) ? sp.date! : null) ??
    event.event_date ??
    dated[0]?.end_date ??
    new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title={t("Kalender")}
        description={t("Deadline dan rentang tugas, Hari-H, serta jam-jam rundown dalam satu kalender. Tampilan hari, 4 hari, minggu, bulan, tahun, atau jadwal.")}
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <TaskLinksProvider value={taskLinks} refs={taskRefs} superLink={superLinks} refCounts={refCounts}>
        <TaskCommentsProvider value={taskComments}>
        <MembersProvider members={members} teams={teams}>
        <CalendarView key={event.id}
          tasks={tasks}
          divisions={divisions}
          events={events}
          event={event}
          activeEventId={event.id}
          user={attenuate(user, event)}
          rundown={rundown}
          initialView={initialView}
          initialDate={initialDate}
        />
      </MembersProvider>
        </TaskCommentsProvider>
      </TaskLinksProvider>

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
