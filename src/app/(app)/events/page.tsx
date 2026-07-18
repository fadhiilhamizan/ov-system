import { CalendarRange, MapPin, Target, ListChecks } from "lucide-react";
import { getEvents, taskStats, budgetTotal } from "@/lib/data/repo";
import { getActiveEvent } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/charts/donut";
import { AddEventButton, EventActions } from "@/components/events/event-manage";
import { formatDate, formatRupiah } from "@/lib/format";

export const metadata = { title: "Ormawa Visit" };

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "info" }> = {
  active: { label: "Aktif", variant: "success" },
  planning: { label: "Rencana", variant: "warning" },
  done: { label: "Selesai", variant: "info" },
};

export default async function EventsPage() {
  const [events, active, user] = await Promise.all([getEvents(), getActiveEvent(), getCurrentUser()]);
  const manage = can.manageEvents(user);
  const cards = await Promise.all(
    events.map(async (e) => ({
      event: e,
      stats: await taskStats(e.id),
      budget: await budgetTotal(e.id),
    })),
  );

  return (
    <div>
      <PageHeader
        title="Daftar Ormawa Visit"
        description="Riwayat & rencana semua Ormawa Visit lintas kabinet. Ganti yang aktif dari pemilih di kanan atas."
        actions={manage ? <AddEventButton /> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map(({ event: e, stats, budget }) => {
          const st = STATUS[e.status];
          const isActive = e.id === active.id;
          return (
            <Card
              key={e.id}
              className="relative overflow-hidden p-5"
              style={isActive ? { boxShadow: "0 0 0 2px var(--primary) inset" } : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <Badge variant="outline">{e.code}</Badge>
                    {isActive && <Badge variant="primary">Sedang dilihat</Badge>}
                  </div>
                  <h3 className="mt-2 text-lg font-bold leading-tight">{e.title}</h3>
                  <p className="text-sm text-muted-foreground">{e.cabinet}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {stats.total > 0 && <ProgressRing value={stats.progress} size={54} />}
                  {manage && <EventActions event={e} />}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Info icon={<CalendarRange />} label="Tanggal" value={formatDate(e.event_date, { long: true }) ?? "TBD"} />
                <Info icon={<MapPin />} label="Lokasi" value={e.location} />
                <Info icon={<Target />} label="Partner" value={e.partner} />
                <Info icon={<ListChecks />} label="Tugas" value={`${stats.by.done}/${stats.total} selesai`} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
                <Badge variant={e.type === "internal" ? "info" : "primary"}>
                  {e.type === "internal" ? "Internal ITS" : "Eksternal"}
                </Badge>
                <Badge variant="outline">{e.mode === "offline" ? "Offline" : "Online"}</Badge>
                {budget > 0 && <span className="ml-auto font-medium text-muted-foreground">RAB {formatRupiah(budget)}</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
    </div>
  );
}
