import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { getDivisions, getEvents, getTasks } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { TasksView } from "@/components/tasks/tasks-view";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Work Breakdown Structure" };

export default async function TasksPage() {
  const [user, event] = await Promise.all([getCurrentUser(), getActiveEvent()]);
  const tasks = getTasks({ event_id: event.id });
  const divisions = getDivisions();
  const events = getEvents();

  return (
    <div>
      <PageHeader
        title="Work Breakdown Structure"
        description="Seluruh tugas Ormawa Visit dalam satu sumber kebenaran. Ubah tampilan antara tabel, kanban, dan timeline."
        actions={<Badge variant="outline">{event.title}</Badge>}
      />
      <TasksView
        tasks={tasks}
        divisions={divisions}
        events={events}
        activeEventId={event.id}
        user={user}
      />
    </div>
  );
}
