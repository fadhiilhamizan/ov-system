import { ChevronDown, HelpCircle } from "lucide-react";
import { getFaqs } from "@/lib/data/repo";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { AddFaqButton, FaqActions } from "@/components/faq/faq-manage";
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
        <div className="space-y-2.5">
          {faqs.map((f, i) => (
            <Card key={f.id} className="overflow-hidden">
              <details className="group" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 font-medium transition hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1">{f.question}</span>
                  {manage && <FaqActions faq={f} />}
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="whitespace-pre-line border-t border-border px-5 py-4 pl-16 text-sm leading-relaxed text-muted-foreground">
                  {f.answer}
                </div>
              </details>
            </Card>
          ))}
        </div>
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
