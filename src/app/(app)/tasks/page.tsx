import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent, getActiveDivision } from "@/lib/session";
import { getDivisions, getEvents, getTasks } from "@/lib/data/repo";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { TasksView } from "@/components/tasks/tasks-view";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Work Breakdown Structure" };

export default async function TasksPage() {
  const [user, event, activeDivision, t] = await Promise.all([
    getCurrentUser(),
    getActiveEvent(),
    getActiveDivision(),
    getT(),
  ]);
  const [tasks, divisions, events] = await Promise.all([
    getTasks({ event_id: event.id }),
    getDivisions(),
    getEvents(),
  ]);

  return (
    <div>
      <PageHeader
        title={t("Work Breakdown Structure")}
        description={t("Seluruh tugas Ormawa Visit dalam satu sumber kebenaran. Ubah tampilan antara tabel, kanban, dan timeline.")}
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <TasksView
        tasks={tasks}
        divisions={divisions}
        events={events}
        activeEventId={event.id}
        user={user}
        initialDivision={activeDivision}
      />
    </div>
  );
}
