import { requireModule } from "@/lib/guard";
import { getActiveEvent } from "@/lib/session";
import { getBudgetPlans, getEvents } from "@/lib/data/repo";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { BudgetView, AddBudgetPlanButton } from "@/components/budget/budget-view";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Layers, Receipt } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty";
import { planTotal, primaryBudgetPlan } from "@/lib/budget";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Anggaran" };

export default async function BudgetPage() {
  // Guard first: staff/intern/guest have no access to Anggaran.
  const user = await requireModule("budget");
  const [event, events] = await Promise.all([
    getActiveEvent(),
    getEvents(),
  ]);
  const plans = await getBudgetPlans(event.id);
  const t = await getT();

  // The headline figure is the MAIN plan's total, not every plan added up: two
  // RAB scenarios are two figures for the same money, so the old sum reported
  // an amount nobody would ever spend and grew with each scenario drafted.
  const main = primaryBudgetPlan(plans);
  const itemCount = plans.reduce((s, p) => s + p.items.length, 0);

  return (
    <div>
      <PageHeader
        title={t("Rencana Anggaran Biaya")}
        description={t("Itemisasi anggaran per skenario (maksimal/minimal), lengkap dengan kategori & subtotal. Angka bisa diedit langsung.")}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{event.title}</Badge>
            {can.manageBudget(user) && <AddBudgetPlanButton />}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label={t("Anggaran Edisi")}
          value={formatRupiah(main ? planTotal(main) : 0)}
          sub={main ? `${t("Rencana utama")}: ${main.name}` : undefined}
          icon={<Wallet />}
          accent="#0ea5e9"
        />
        <StatCard label={t("Skenario / Plan")} value={plans.length} icon={<Layers />} accent="#6366f1" />
        <StatCard label={t("Total Item")} value={itemCount} icon={<Receipt />} accent="#f59e0b" />
      </div>

      {plans.length ? (
        <BudgetView plans={plans} events={events} canManage={can.manageBudget(user)} />
      ) : (
        <EmptyState
          icon={<Wallet />}
          title={t("Belum ada anggaran")}
          description={`${t("Belum ada rencana anggaran untuk")} ${event.title}.`}
        />
      )}
    </div>
  );
}
