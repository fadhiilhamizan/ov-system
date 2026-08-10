import { HelpCircle } from "lucide-react";
import { getFaqs } from "@/lib/data/repo";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { AddFaqButton } from "@/components/faq/faq-manage";
import { FaqList } from "@/components/faq/faq-list";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "FAQ" };

export default async function FaqPage() {
  const [faqs, user, t] = await Promise.all([getFaqs(), getCurrentUser(), getT()]);
  const manage = can.manageFaq(user);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="FAQ"
        description={t("Pertanyaan yang sering diajukan seputar Ormawa Visit - External Affairs HMSI ITS.")}
        actions={manage ? <AddFaqButton /> : undefined}
      />

      {faqs.length === 0 ? (
        <EmptyState icon={<HelpCircle />} title={t("Belum ada FAQ")} description={t("Pertanyaan yang sering diajukan akan tampil di sini.")} />
      ) : (
        <FaqList faqs={faqs} manage={manage} />
      )}

      <Card className="mt-4 flex items-start gap-3 border-dashed p-5">
        <HelpCircle className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-medium">{t("Masih ada pertanyaan?")}</p>
          <p className="text-muted-foreground">
            {t("Tanyakan ke PIC Ormawa Visit atau fungsionaris yang menemani tugasmu, jangan malu bertanya ya :)")}
          </p>
        </div>
      </Card>
    </div>
  );
}
