import { getCurrentUser } from "@/lib/auth";
import { getProspects } from "@/lib/data/repo";
import { prospectStage, PIPELINE_STAGES } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { ProspectsView } from "@/components/prospects/prospects-view";
import { StatCard } from "@/components/stat-card";
import { Target, CheckCircle2, XCircle, Clock } from "lucide-react";

export const metadata = { title: "Reach & Offer" };

export default async function ProspectsPage() {
  const [user, prospects] = await Promise.all([getCurrentUser(), getProspects()]);

  const count = (k: string) => prospects.filter((p) => prospectStage(p) === k).length;

  return (
    <div>
      <PageHeader
        title="Reach & Offer"
        description="Data & alur himpunan yang dihubungi, dari reach pertama sampai konfirmasi."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Prospek" value={prospects.length} icon={<Target />} accent="#6366f1" />
        <StatCard label="Diterima" value={count("diterima")} icon={<CheckCircle2 />} accent="#10b981" />
        <StatCard label="Menunggu" value={count("menunggu")} icon={<Clock />} accent="#f59e0b" />
        <StatCard label="Ditolak" value={count("ditolak")} icon={<XCircle />} accent="#ef4444" />
      </div>

      <ProspectsView prospects={prospects} user={user} />
    </div>
  );
}
