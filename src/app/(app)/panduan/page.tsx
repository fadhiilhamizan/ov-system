import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { GuideFlowchart } from "@/components/panduan/guide-flowchart";
import { GuideSections } from "@/components/panduan/guide-sections";
import { getT, getLang } from "@/lib/i18n/server";

export const metadata = { title: "Panduan" };

export default async function PanduanPage() {
  const [t, lang] = await Promise.all([getT(), getLang()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Panduan Penggunaan")}
        description={t("Alur penggunaan Ormawa Visit Management System dari awal sampai akhir.")}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("Alur Singkat")}
        </h2>
        <Card className="overflow-x-auto p-5 sm:p-8">
          <GuideFlowchart />
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("Panduan Lengkap per Fitur")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("Penjelasan rinci tiap menu: untuk apa, cara memakainya, hal yang perlu diperhatikan, dan siapa yang bisa mengaksesnya.")}
        </p>
        <GuideSections lang={lang} />
      </section>
    </div>
  );
}
