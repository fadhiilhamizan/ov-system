"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Users2, Trash2, Loader2, X, CalendarOff, Calendar, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogTrigger } from "@/components/ui/dialog";
import { TeamActions, TeamFormDialog } from "@/components/members/member-manage";
import { ProgressRing } from "@/components/charts/donut";
import { StackedBar } from "@/components/charts/bars";
import { AddDivisionButton, DivisionActions } from "@/components/divisions/division-manage";
import { STATUS_META } from "@/lib/constants";
import { useMultiSelect } from "@/lib/use-multi-select";
import { bulkDeleteDivisionsAction, bulkUpdateDivisionsAction } from "@/lib/actions/manage";
import { useT } from "@/lib/i18n/provider";
import type { Division, Member, Team } from "@/lib/types";

export interface DivisionStat {
  division: Division;
  total: number;
  done: number;
  ongoing: number;
  todo: number;
  overtime: number;
  progress: number;
}

/** Split a comma/·/double-space joined roster string into display chips. */
const roster = (s: string) => (s ?? "").split(/\s{2,}|,|·/).map((x) => x.trim()).filter(Boolean);

function TeamBlock({
  division, team, divisions, members, eventId, canManageTeams,
}: {
  division: Division;
  team?: Team;
  divisions: Division[];
  members: Member[];
  eventId: string;
  canManageTeams: boolean;
}) {
  const t = useT();
  const fung = roster(team?.fungsionaris ?? "");
  const intern = roster(team?.intern ?? "");
  const coord = roster(team?.coordinator ?? "");
  const empty = !coord.length && !fung.length && !intern.length;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Users2 className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("Struktur Tim")}
        </span>
        {canManageTeams && (
          <span className="ml-auto">
            {team ? (
              <TeamActions team={team} divisions={divisions} members={members} eventId={eventId} />
            ) : (
              <TeamFormDialog
                mode="create"
                divisions={divisions}
                members={members}
                eventId={eventId}
                trigger={
                  <DialogTrigger asChild>
                    <button className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary transition hover:bg-muted">
                      <Plus className="size-3" /> {t("Isi tim")}
                    </button>
                  </DialogTrigger>
                }
              />
            )}
          </span>
        )}
      </div>

      {empty ? (
        <p className="text-xs text-muted-foreground/70">{t("Belum diisi.")}</p>
      ) : (
        <div className="space-y-1.5">
          {coord.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] uppercase text-muted-foreground">{t("Koordinator")}</span>
              {coord.map((n, i) => (
                <span key={i} className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-primary/25">{n}</span>
              ))}
            </div>
          )}
          {fung.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] uppercase text-muted-foreground">{t("Fungsionaris")}</span>
              {fung.map((n, i) => (
                <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{n}</span>
              ))}
            </div>
          )}
          {intern.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] uppercase text-muted-foreground">Intern</span>
              {intern.map((n, i) => (
                <span key={i} className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{n}</span>
              ))}
            </div>
          )}
        </div>
      )}
      <span className="sr-only">{division.name}</span>
    </div>
  );
}

export function DivisionsGrid({
  divisions,
  stats,
  teams,
  members,
  eventId,
  canManage,
  canManageTeams,
}: {
  divisions: Division[];
  stats: DivisionStat[];
  teams: Team[];
  members: Member[];
  eventId: string;
  canManage: boolean;
  canManageTeams: boolean;
}) {
  const t = useT();
  const sel = useMultiSelect();
  React.useEffect(() => sel.clear(), [divisions]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pending, start] = React.useTransition();

  const statMap = React.useMemo(() => new Map(stats.map((s) => [s.division.key, s])), [stats]);
  const cards = divisions.map((division) => {
    const s = statMap.get(division.key);
    return {
      division,
      total: s?.total ?? 0, done: s?.done ?? 0, ongoing: s?.ongoing ?? 0,
      todo: s?.todo ?? 0, overtime: s?.overtime ?? 0, progress: s?.progress ?? 0,
    };
  });

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) { toast.success(ok); sel.clear(); } else toast.error(res.error);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        {canManage && <AddDivisionButton />}
      </div>

      {canManage && sel.count > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{sel.count} {t("dipilih")}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={pending}
              onClick={() => run(() => bulkUpdateDivisionsAction(sel.ids, { exclude_from_rundown: true }), t("Divisi diperbarui"))}>
              <CalendarOff className="size-4" /> {t("Tanpa rundown")}
            </Button>
            <Button variant="outline" size="sm" disabled={pending}
              onClick={() => run(() => bulkUpdateDivisionsAction(sel.ids, { exclude_from_rundown: false }), t("Divisi diperbarui"))}>
              <Calendar className="size-4" /> {t("Ikut rundown")}
            </Button>
            <Button variant="destructive" size="sm" disabled={pending}
              onClick={() => run(() => bulkDeleteDivisionsAction(sel.ids), t("Divisi dihapus"))}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} {t("Hapus")}
            </Button>
            <Button variant="ghost" size="sm" onClick={sel.clear} disabled={pending}><X className="size-4" /> {t("Batal")}</Button>
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("Belum ada divisi.")}</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((s) => {
            const team = teams.find((tm) => tm.division === s.division.key);
            const checked = sel.selected.has(s.division.key);
            return (
              <Card key={s.division.key} className="relative h-full p-5 transition hover:shadow-md">
                {canManage && (
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
                    <Checkbox checked={checked} onCheckedChange={() => sel.toggle(s.division.key)} aria-label={t("Pilih")} />
                    <DivisionActions division={s.division} />
                  </div>
                )}
                <Link href={`/divisions/${s.division.key}`} className="group block">
                  <div className="flex items-start justify-between gap-3 pr-16">
                    <div className="flex items-center gap-3">
                      <span className="flex aspect-square size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: s.division.color }}>
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
                      <StackedBar segments={[
                        { value: s.done, color: "var(--status-done)" },
                        { value: s.ongoing, color: "var(--status-ongoing)" },
                        { value: s.overtime, color: "var(--status-overtime)" },
                        { value: s.todo, color: "var(--status-todo)" },
                      ]} />
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span><span className={`mr-1 inline-block size-1.5 rounded-full align-middle ${STATUS_META.done.dot}`} />{s.done} {t("selesai")}</span>
                        <span><span className={`mr-1 inline-block size-1.5 rounded-full align-middle ${STATUS_META.ongoing.dot}`} />{s.ongoing} on going</span>
                        <span><span className={`mr-1 inline-block size-1.5 rounded-full align-middle ${STATUS_META.todo.dot}`} />{s.todo} to do</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                    {t("Buka papan")} <ArrowRight className="ml-1 size-3.5" />
                  </div>
                </Link>

                {/* Team structure lives on the division card — the separate
                    "Struktur Tim" tab was merged in here. Outside the <Link>
                    so its controls stay clickable. */}
                <TeamBlock
                  division={s.division}
                  team={team}
                  divisions={divisions}
                  members={members}
                  eventId={eventId}
                  canManageTeams={canManageTeams}
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
