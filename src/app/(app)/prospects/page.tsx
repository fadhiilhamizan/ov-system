import { getCurrentUser } from "@/lib/auth";
import { getProspects } from "@/lib/data/repo";
import { prospectStage } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { ProspectsView } from "@/components/prospects/prospects-view";
import { StatCard } from "@/components/stat-card";
import { Target, CheckCircle2, XCircle, Clock } from "lucide-react";

export const metadata = { title: "Reach & Offer" };

export default async function ProspectsPage() {
  const [user, prospects, t] = await Promise.all([getCurrentUser(), getProspects(), getT()]);

  const count = (k: string) => prospects.filter((p) => prospectStage(p) === k).length;

  return (
    <div>
      <PageHeader
        title={t("Reach & Offer")}
        description={t("Data & alur himpunan yang dihubungi, dari reach pertama sampai konfirmasi.")}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("Total Prospek")} value={prospects.length} icon={<Target />} accent="#6366f1" />
        <StatCard label={t("Diterima")} value={count("diterima")} icon={<CheckCircle2 />} accent="#10b981" />
        <StatCard label={t("Menunggu")} value={count("menunggu")} icon={<Clock />} accent="#f59e0b" />
        <StatCard label={t("Ditolak")} value={count("ditolak")} icon={<XCircle />} accent="#ef4444" />
      </div>

      <ProspectsView prospects={prospects} user={user} />
    </div>
  );
}
