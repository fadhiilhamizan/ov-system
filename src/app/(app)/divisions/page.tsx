import Link from "next/link";
import { ArrowRight, Users2 } from "lucide-react";
import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { divisionStats, getTeams } from "@/lib/data/repo";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/charts/donut";
import { StackedBar } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { AddDivisionButton } from "@/components/divisions/division-manage";
import { STATUS_META } from "@/lib/constants";

export const metadata = { title: "Divisi" };

export default async function DivisionsPage() {
  const [event, user, t] = await Promise.all([getActiveEvent(), getCurrentUser(), getT()]);
  const [stats, teams] = await Promise.all([divisionStats(event.id), getTeams(event.id)]);

  return (
    <div>
      <PageHeader
        title={t("Divisi")}
        description={`Setiap Divisi yang ada di Ormawa Visit ${event.title}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{event.title}</Badge>
            {can.manageDivisions(user) && <AddDivisionButton />}
          </div>
        }
      />

      {stats.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Belum ada tugas untuk Ormawa Visit ini.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((s) => {
            const team = teams.find((t) => t.division === s.division.key);
            return (
              <Link key={s.division.key} href={`/divisions/${s.division.key}`} className="group">
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{ backgroundColor: s.division.color }}
                      >
                        {s.division.short}
                      </span>
                      <div>
                        <h3 className="font-semibold leading-tight">{s.division.name}</h3>
                        <p className="text-xs text-muted-foreground">{s.total} tugas</p>
                      </div>
                    </div>
                    <ProgressRing value={s.progress} size={52} color={s.division.color} />
                  </div>

                  <div className="mt-4">
                    <StackedBar
                      segments={[
                        { value: s.done, color: "var(--status-done)" },
                        { value: s.ongoing, color: "var(--status-ongoing)" },
                        { value: s.overtime, color: "var(--status-overtime)" },
                        { value: s.todo, color: "var(--status-todo)" },
                      ]}
                    />
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>
                        <span className={`mr-1 inline-block size-1.5 rounded-full align-middle ${STATUS_META.done.dot}`} />
                        {s.done} selesai
                      </span>
                      <span>
                        <span className={`mr-1 inline-block size-1.5 rounded-full align-middle ${STATUS_META.ongoing.dot}`} />
                        {s.ongoing} on going
                      </span>
                      <span>
                        <span className={`mr-1 inline-block size-1.5 rounded-full align-middle ${STATUS_META.todo.dot}`} />
                        {s.todo} to do
                      </span>
                    </div>
                  </div>

                  {team && (team.fungsionaris || team.intern) && (
                    <div className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                      <Users2 className="mt-0.5 size-3.5 shrink-0" />
                      <span className="line-clamp-2">
                        {[team.fungsionaris, team.intern].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                    Buka papan <ArrowRight className="ml-1 size-3.5" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
