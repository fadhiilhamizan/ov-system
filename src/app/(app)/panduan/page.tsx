import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { GuideFlowchart } from "@/components/panduan/guide-flowchart";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Panduan" };

export default async function PanduanPage() {
  const t = await getT();
  return (
    <div>
      <PageHeader
        title={t("Panduan Penggunaan")}
        description={t("Alur penggunaan Ormawa Visit Management System dari awal sampai akhir.")}
      />
      <Card className="overflow-x-auto p-5 sm:p-8">
        <GuideFlowchart />
      </Card>
    </div>
  );
}
