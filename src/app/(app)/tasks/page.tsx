import { getCurrentUser } from "@/lib/auth";
import { attenuate } from "@/lib/permissions";
import { getActiveEvent, getActiveDivision } from "@/lib/session";
import { getDivisions, getEvents, getMembers, getTasks, getTaskLinksByEvent, getTaskRefsByEvent, getLinks, getTeams } from "@/lib/data/repo";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { TasksView } from "@/components/tasks/tasks-view";
import { MembersProvider } from "@/components/members/members-context";
import { TaskLinksProvider } from "@/components/tasks/task-links-context";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Work Breakdown Structure" };

export default async function TasksPage() {
  const [user, event, activeDivision, t] = await Promise.all([
    getCurrentUser(),
    getActiveEvent(),
    getActiveDivision(),
    getT(),
  ]);
  const [tasks, divisions, events, members, taskLinks, taskRefs, superLinks, teams] = await Promise.all([
    getTasks({ event_id: event.id }),
    getDivisions(event.id),
    getEvents(),
    getMembers(event.id),
    getTaskLinksByEvent(event.id),
    getTaskRefsByEvent(event.id),
    getLinks(),
    getTeams(event.id),
  ]);

  return (
    <div>
      <PageHeader
        title={t("Work Breakdown Structure")}
        description={t("Seluruh tugas Ormawa Visit dalam satu sumber kebenaran. Ubah tampilan antara tabel, kanban, dan timeline.")}
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <TaskLinksProvider value={taskLinks} refs={taskRefs} superLink={superLinks}>
        <MembersProvider members={members} teams={teams}>
        <TasksView
          tasks={tasks}
          divisions={divisions}
          events={events}
          activeEventId={event.id}
          user={attenuate(user, event)}
          initialDivision={activeDivision}
        />
      </MembersProvider>
      </TaskLinksProvider>
    </div>
  );
}
