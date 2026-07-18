import Link from "next/link";
import {
  ListChecks,
  TrendingUp,
  AlertTriangle,
  Wallet,
  Target,
  ArrowUpRight,
  CalendarClock,
  Users,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import {
  taskStats,
  divisionStats,
  prospectStats,
  budgetTotal,
  getDivisions,
  getMembers,
} from "@/lib/data/repo";
import { PIPELINE_STAGES, prospectStage, STATUS_META } from "@/lib/constants";
import { formatRupiah, formatDate, relativeDeadline, daysUntil } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutChart } from "@/components/charts/donut";
import { BarList } from "@/components/charts/bars";
import { StatusBadge } from "@/components/status-badge";
import { DivisionBadge } from "@/components/division-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import type { DivisionKey, TaskStatus } from "@/lib/types";

const STATUS_HEX: Record<TaskStatus, string> = {
  todo: "var(--status-todo)",
  ongoing: "var(--status-ongoing)",
  overtime: "var(--status-overtime)",
  done: "var(--status-done)",
};

export default async function DashboardPage() {
  const [user, event] = await Promise.all([getCurrentUser(), getActiveEvent()]);
  const [stats, divStats, pstats, budget, divisions, members] = await Promise.all([
    taskStats(event.id),
    divisionStats(event.id),
    prospectStats(event.id),
    budgetTotal(event.id),
    getDivisions(),
    getMembers(),
  ]);
  const memberCount = members.length;

  const attention = stats.by.ongoing + stats.by.overtime;

  const upcoming = stats.tasks
    .filter((t) => t.end_date && t.status !== "done")
    .sort((a, b) => (a.end_date! < b.end_date! ? -1 : 1))
    .slice(0, 6);

  const stageCounts = PIPELINE_STAGES.map((s) => ({
    ...s,
    count: pstats.prospects.filter((p) => prospectStage(p) === s.key).length,
  }));
  const accepted = stageCounts.find((s) => s.key === "diterima")?.count ?? 0;

  const donutData = (["done", "ongoing", "overtime", "todo"] as TaskStatus[])
    .map((s) => ({ label: STATUS_META[s].label, value: stats.by[s], color: STATUS_HEX[s] }))
    .filter((d) => d.value > 0);

  return (
    <div>
      <PageHeader
        title={`Halo, ${user.name.split(" ")[0]} 👋`}
        description={
          <>
            Ringkasan progres untuk <span className="font-medium text-foreground">{event.title}</span> ·{" "}
            {event.cabinet}
          </>
        }
        actions={
          <Link
            href="/tasks"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110"
          >
            Buka Work Breakdown <ArrowUpRight className="size-4" />
          </Link>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Tugas"
          value={stats.total}
          sub={`${divStats.length} divisi aktif`}
          icon={<ListChecks />}
          accent="#6366f1"
        />
        <StatCard
          label="Progress"
          value={`${stats.progress}%`}
          sub={`${stats.by.done} dari ${stats.total} selesai`}
          icon={<TrendingUp />}
          accent="#10b981"
        />
        <StatCard
          label="Perlu Perhatian"
          value={attention}
          sub={`${stats.by.overtime} overtime · ${stats.by.ongoing} on going`}
          icon={<AlertTriangle />}
          accent="#f59e0b"
        />
        <StatCard
          label="Anggaran Edisi"
          value={formatRupiah(budget)}
          sub="Total rencana pengeluaran"
          icon={<Wallet />}
          accent="#0ea5e9"
        />
      </div>

      {/* Progress + pipeline */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Progres Keseluruhan</CardTitle>
            <Badge variant="outline">{stats.total} tugas</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
              {donutData.length ? (
                <DonutChart
                  data={donutData}
                  centerLabel={`${stats.progress}%`}
                  centerSub="Selesai"
                />
              ) : (
                <div className="text-sm text-muted-foreground">Belum ada tugas.</div>
              )}
              <div className="grid flex-1 grid-cols-2 gap-3">
                {(["done", "ongoing", "overtime", "todo"] as TaskStatus[]).map((s) => (
                  <div key={s} className="rounded-lg border border-border bg-background/50 p-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${STATUS_META[s].dot}`} />
                      <span className="text-xs text-muted-foreground">{STATUS_META[s].label}</span>
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums">{stats.by[s]}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Pipeline Prospek</CardTitle>
            <Link href="/prospects" className="text-xs text-primary hover:underline">
              Lihat semua
            </Link>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{pstats.total}</span>
              <span className="text-sm text-muted-foreground">himpunan direach</span>
              <Badge variant="success" className="ml-auto">
                <Target className="size-3" /> {accepted} diterima
              </Badge>
            </div>
            <div className="space-y-2.5">
              {stageCounts.map((s) => (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 text-sm">{s.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{s.count}</span>
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(s.count / (pstats.total || 1)) * 100}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Division progress + deadlines */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Progres per Divisi</CardTitle>
          </CardHeader>
          <CardContent>
            {divStats.length ? (
              <BarList
                data={divStats.map((d) => ({
                  label: (
                    <span className="inline-flex items-center gap-2">
                      <DivisionBadge division={d.division} />
                      <span className="text-muted-foreground">{d.division.name}</span>
                    </span>
                  ),
                  value: d.progress,
                  max: 100,
                  color: d.division.color,
                  right: (
                    <span>
                      {d.done}/{d.total} · {d.progress}%
                    </span>
                  ),
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada data divisi.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Deadline Terdekat</CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length ? (
              upcoming.map((t) => {
                const d = daysUntil(t.end_date);
                const overdue = d !== null && d < 0;
                const div = divisions.find((x) => x.key === t.division);
                return (
                  <Link
                    key={t.id}
                    href="/tasks"
                    className="flex items-start gap-3 rounded-lg border border-border p-2.5 transition hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        {div && <DivisionBadge division={div} />}
                        <span className="text-[11px] text-muted-foreground">{formatDate(t.end_date)}</span>
                      </div>
                    </div>
                    <Badge variant={overdue ? "danger" : d !== null && d <= 3 ? "warning" : "outline"}>
                      {relativeDeadline(t.end_date)}
                    </Badge>
                  </Link>
                );
              })
            ) : (
              <EmptyState
                icon={<CalendarClock />}
                title="Tidak ada deadline aktif"
                description="Semua tugas ber-deadline sudah selesai untuk Ormawa Visit ini."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event summary */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Edisi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={<CalendarDays />} label="Tanggal" value={formatDate(event.event_date, { long: true }) ?? "Belum ditentukan"} />
            <InfoRow icon={<MapPin />} label="Lokasi" value={event.location} />
            <InfoRow icon={<Target />} label="Partner" value={`${event.partner} · ${event.campus}`} />
            <InfoRow icon={<Users />} label="Anggota EA" value={`${memberCount} orang`} />
            <div className="flex items-center gap-2 pt-1">
              <Badge variant={event.type === "internal" ? "info" : "primary"}>
                {event.type === "internal" ? "Internal ITS" : "Eksternal"}
              </Badge>
              <Badge variant="outline">{event.mode === "offline" ? "Offline" : "Online"}</Badge>
              <Badge variant="outline">{event.cabinet}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Akses Cepat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {QUICK_LINKS.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="group flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-primary/40 hover:bg-accent/40"
                >
                  <span
                    className="flex size-9 items-center justify-center rounded-lg text-white [&_svg]:size-4"
                    style={{ backgroundColor: q.color }}
                  >
                    {q.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{q.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{q.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
    </div>
  );
}

const QUICK_LINKS: { href: string; label: string; sub: string; color: string; icon: React.ReactNode }[] = [
  { href: "/tasks", label: "Work Breakdown", sub: "Kelola tugas", color: "#6366f1", icon: <ListChecks /> },
  { href: "/divisions", label: "Divisi", sub: "Per divisi", color: "#10b981", icon: <Users /> },
  { href: "/prospects", label: "Prospek", sub: "Pipeline himpunan", color: "#f59e0b", icon: <Target /> },
  { href: "/budget", label: "Anggaran", sub: "RAB", color: "#0ea5e9", icon: <Wallet /> },
  { href: "/rundown", label: "Rundown", sub: "Susunan acara", color: "#d946ef", icon: <CalendarClock /> },
  { href: "/calendar", label: "Kalender", sub: "Timeline", color: "#f43f5e", icon: <CalendarDays /> },
];
