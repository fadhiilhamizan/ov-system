import Link from "next/link";
import { ArrowRight, Users2 } from "lucide-react";
import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { divisionStats, getDivisions, getTeams } from "@/lib/data/repo";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/charts/donut";
import { StackedBar } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { AddDivisionButton, DivisionActions } from "@/components/divisions/division-manage";
import { STATUS_META } from "@/lib/constants";

export const metadata = { title: "Divisi" };

export default async function DivisionsPage() {
  const [event, user, t] = await Promise.all([getActiveEvent(), getCurrentUser(), getT()]);
  const [stats, teams, divisions] = await Promise.all([
    divisionStats(event.id),
    getTeams(event.id),
    getDivisions(),
  ]);
  const manage = can.manageDivisions(user);
  const statMap = new Map(stats.map((s) => [s.division.key, s]));

  // Show every division (so empty ones can still be managed), merged with stats.
  const cards = divisions.map((division) => {
    const s = statMap.get(division.key);
    return {
      division,
      total: s?.total ?? 0,
      done: s?.done ?? 0,
      ongoing: s?.ongoing ?? 0,
      todo: s?.todo ?? 0,
      overtime: s?.overtime ?? 0,
      progress: s?.progress ?? 0,
    };
  });

  return (
    <div>
      <PageHeader
        title={t("Divisi")}
        description={`${t("Setiap Divisi yang ada di Ormawa Visit")} ${event.title}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{event.title}</Badge>
            {manage && <AddDivisionButton />}
          </div>
        }
      />

      {cards.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {t("Belum ada divisi.")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((s) => {
            const team = teams.find((tm) => tm.division === s.division.key);
            return (
              <Card key={s.division.key} className="relative h-full p-5 transition hover:shadow-md">
                {manage && (
                  <div className="absolute right-3 top-3 z-10">
                    <DivisionActions division={s.division} />
                  </div>
                )}
                <Link href={`/divisions/${s.division.key}`} className="group block">
                  <div className="flex items-start justify-between gap-3 pr-8">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{ backgroundColor: s.division.color }}
                      >
                        {s.division.short}
                      </span>
                      <div>
                        <h3 className="font-semibold leading-tight">{s.division.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {s.total} {t("tugas")}
                          {s.division.exclude_from_rundown && (
                            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px]">{t("tanpa rundown")}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {s.total > 0 && <ProgressRing value={s.progress} size={52} color={s.division.color} />}
                  </div>

                  {s.total > 0 && (
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
                          {s.done} {t("selesai")}
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
                  )}

                  {team && (team.fungsionaris || team.intern) && (
                    <div className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                      <Users2 className="mt-0.5 size-3.5 shrink-0" />
                      <span className="line-clamp-2">
                        {[team.fungsionaris, team.intern].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                    {t("Buka papan")} <ArrowRight className="ml-1 size-3.5" />
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
