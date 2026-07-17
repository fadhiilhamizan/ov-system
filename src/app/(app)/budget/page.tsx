import { getCurrentUser } from "@/lib/auth";
import { getBudgetPlans, getEvents } from "@/lib/data/repo";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { BudgetView } from "@/components/budget/budget-view";
import { StatCard } from "@/components/stat-card";
import { Wallet, Layers, Receipt } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty";

export const metadata = { title: "Anggaran (RAB)" };

export default async function BudgetPage() {
  const [user, plans, events] = await Promise.all([
    getCurrentUser(),
    getBudgetPlans(),
    getEvents(),
  ]);

  const grand = plans.reduce((s, p) => s + p.items.reduce((a, i) => a + (i.total ?? 0), 0), 0);
  const itemCount = plans.reduce((s, p) => s + p.items.length, 0);

  return (
    <div>
      <PageHeader
        title="Rencana Anggaran Biaya"
        description="Itemisasi anggaran per skenario (maksimal/minimal), lengkap dengan kategori & subtotal. Angka dapat diedit langsung."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total Rencana Anggaran" value={formatRupiah(grand)} icon={<Wallet />} accent="#0ea5e9" />
        <StatCard label="Skenario / Plan" value={plans.length} icon={<Layers />} accent="#6366f1" />
        <StatCard label="Total Item" value={itemCount} icon={<Receipt />} accent="#f59e0b" />
      </div>

      {plans.length ? (
        <BudgetView plans={plans} events={events} canManage={can.manageBudget(user)} />
      ) : (
        <EmptyState icon={<Wallet />} title="Belum ada RAB" description="Belum ada rencana anggaran tersimpan." />
      )}
    </div>
  );
}
