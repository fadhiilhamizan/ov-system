import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { getDivision, getDivisions, getEvents, getMembers, getTasks, getTaskLinksByEvent, getTeams } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { TasksView } from "@/components/tasks/tasks-view";
import { MembersProvider } from "@/components/members/members-context";
import { TaskLinksProvider } from "@/components/tasks/task-links-context";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";
import type { DivisionKey } from "@/lib/types";

export default async function DivisionDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const [user, event] = await Promise.all([getCurrentUser(), getActiveEvent()]);
  const division = await getDivision(event.id, key);
  if (!division) notFound();

  const [tasks, divisions, events, teams, members, taskLinks] = await Promise.all([
    getTasks({ event_id: event.id, division: division.key }),
    getDivisions(event.id),
    getEvents(),
    getTeams(event.id),
    getMembers(event.id),
    getTaskLinksByEvent(event.id),
  ]);
  const team = teams.find((t) => t.division === division.key);
  const t = await getT();

  return (
    <div>
      <Link
        href="/divisions"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("Semua divisi")}
      </Link>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <span
              className="flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: division.color }}
            >
              {division.short}
            </span>
            {division.name}
          </span>
        }
        description={
          team && (team.fungsionaris || team.intern) ? (
            <span className="inline-flex items-start gap-1.5">
              <Users2 className="mt-0.5 size-3.5 shrink-0" />
              {[team.fungsionaris, team.intern].filter(Boolean).join(" · ")}
            </span>
          ) : (
            t("Tugas divisi ini, tersinkron dengan Work Breakdown Structure.")
          )
        }
        actions={<Badge variant="outline">{event.title}</Badge>}
      />

      <TaskLinksProvider value={taskLinks}>
        <MembersProvider members={members}>
        <TasksView
          tasks={tasks}
          divisions={divisions}
          events={events}
          activeEventId={event.id}
          user={user}
          lockedDivision={division.key as DivisionKey}
        />
      </MembersProvider>
      </TaskLinksProvider>
    </div>
  );
}
