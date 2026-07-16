import { ClipboardList } from "lucide-react";
import { getActiveEvent } from "@/lib/session";
import { getJobs } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";

export const metadata = { title: "Job Hari-H" };

export default async function JobsPage() {
  const event = await getActiveEvent();
  const jobs = getJobs(event.id);

  return (
    <div>
      <PageHeader
        title="Job Description Hari-H"
        description="Pembagian tugas panitia saat hari pelaksanaan Ormawa Visit."
        actions={<Badge variant="outline">{event.title}</Badge>}
      />

      {jobs.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {jobs.map((j) => (
            <Card key={j.id} className="flex items-start gap-3 p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
                {j.no}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold leading-tight">{j.job}</h4>
                {j.pic && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {j.pic.split(",").map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs">
                        <Avatar name={p.trim()} size={20} />
                        {p.trim()}
                      </span>
                    ))}
                  </div>
                )}
                {j.notes && <p className="mt-2 text-xs text-muted-foreground">{j.notes}</p>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<ClipboardList />} title="Belum ada pembagian job" description="Job hari-H belum diinput untuk edisi ini." />
      )}
    </div>
  );
}
