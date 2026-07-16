"use client";
import * as React from "react";
import { toast } from "sonner";
import { Wallet, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateBudgetItemAction } from "@/lib/actions/budget";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetPlan, OVEvent } from "@/lib/types";

const CAT_COLORS: Record<string, string> = {
  KONSUMSI: "#f97316",
  "TRANSPORTASI & AKOMODASI": "#0ea5e9",
  "PERALATAN & CETAKAN": "#8b5cf6",
  "PEMINJAMAN TEMPAT": "#10b981",
  "LAIN-LAIN": "#64748b",
};
function catColor(c: string) {
  const key = Object.keys(CAT_COLORS).find((k) => c.toUpperCase().startsWith(k.split(" ")[0]));
  return (key && CAT_COLORS[key]) || "#6366f1";
}

export function BudgetView({
  plans,
  events,
  canManage,
}: {
  plans: BudgetPlan[];
  events: OVEvent[];
  canManage: boolean;
}) {
  const evMap = new Map(events.map((e) => [e.id, e]));
  const [state, setState] = React.useState(plans);
  React.useEffect(() => setState(plans), [plans]);

  function edit(planId: string, index: number, patch: { qty?: number; unit_price?: number }) {
    setState((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const items = p.items.map((it, i) => {
          if (i !== index) return it;
          const next = { ...it, ...patch };
          next.total = (next.qty ?? 0) * (next.unit_price ?? 0);
          return next;
        });
        return { ...p, items };
      }),
    );
    updateBudgetItemAction(planId, index, patch).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        setState(plans);
      }
    });
  }

  return (
    <div className="space-y-5">
      {state.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          event={evMap.get(plan.event_id)}
          canManage={canManage}
          onEdit={edit}
        />
      ))}
    </div>
  );
}

function PlanCard({
  plan,
  event,
  canManage,
  onEdit,
}: {
  plan: BudgetPlan;
  event?: OVEvent;
  canManage: boolean;
  onEdit: (planId: string, index: number, patch: { qty?: number; unit_price?: number }) => void;
}) {
  const [open, setOpen] = React.useState(true);
  const grand = plan.items.reduce((s, i) => s + (i.total ?? 0), 0);

  // group by category preserving order
  const cats: { name: string; items: { it: BudgetPlan["items"][number]; index: number }[]; subtotal: number }[] = [];
  plan.items.forEach((it, index) => {
    let c = cats.find((x) => x.name === it.category);
    if (!c) {
      c = { name: it.category, items: [], subtotal: 0 };
      cats.push(c);
    }
    c.items.push({ it, index });
    c.subtotal += it.total ?? 0;
  });

  const scenario = /MAKSIMAL|MAX/i.test(plan.name) ? "max" : /MINIMAL|MIN/i.test(plan.name) ? "min" : null;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-muted/30"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Wallet className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{plan.name}</h3>
            {event && <Badge variant="outline">{event.code}</Badge>}
            {scenario && <Badge variant={scenario === "max" ? "warning" : "success"}>{scenario === "max" ? "Maksimal" : "Minimal"}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{plan.items.length} item · {cats.length} kategori</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums">{formatRupiah(grand)}</div>
          <div className="text-[11px] text-muted-foreground">Total</div>
        </div>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border">
          {/* category summary */}
          <div className="flex flex-wrap gap-3 border-b border-border bg-muted/20 px-5 py-3">
            {cats.map((c) => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: catColor(c.name) }} />
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">{formatRupiah(c.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 text-left font-medium">Item</th>
                  <th className="px-2 py-2 text-right font-medium">Qty</th>
                  <th className="px-2 py-2 text-left font-medium">Satuan</th>
                  <th className="px-2 py-2 text-right font-medium">Harga</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <React.Fragment key={c.name}>
                    <tr className="bg-muted/30">
                      <td colSpan={5} className="px-5 py-1.5 text-xs font-semibold" style={{ color: catColor(c.name) }}>
                        {c.name}
                      </td>
                    </tr>
                    {c.items.map(({ it, index }) => (
                      <tr key={index} className="border-b border-border/60 last:border-0">
                        <td className="px-5 py-2">{it.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {canManage ? (
                            <NumCell value={it.qty} onCommit={(v) => onEdit(plan.id, index, { qty: v })} width="w-16" />
                          ) : (
                            it.qty ?? "—"
                          )}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">{it.unit || "—"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {canManage ? (
                            <NumCell value={it.unit_price} onCommit={(v) => onEdit(plan.id, index, { unit_price: v })} width="w-24" />
                          ) : (
                            formatRupiah(it.unit_price)
                          )}
                        </td>
                        <td className="px-5 py-2 text-right font-medium tabular-nums">{formatRupiah(it.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-border">
                      <td colSpan={4} className="px-5 py-1.5 text-right text-xs text-muted-foreground">Subtotal {c.name}</td>
                      <td className="px-5 py-1.5 text-right text-xs font-semibold tabular-nums">{formatRupiah(c.subtotal)}</td>
                    </tr>
                  </React.Fragment>
                ))}
                <tr className="bg-muted/40">
                  <td colSpan={4} className="px-5 py-2.5 text-right font-semibold">Total Pengeluaran</td>
                  <td className="px-5 py-2.5 text-right text-base font-bold tabular-nums">{formatRupiah(grand)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function NumCell({
  value,
  onCommit,
  width,
}: {
  value: number | null;
  onCommit: (v: number) => void;
  width: string;
}) {
  const [v, setV] = React.useState(value ?? 0);
  React.useEffect(() => setV(value ?? 0), [value]);
  return (
    <input
      type="number"
      value={v}
      onChange={(e) => setV(Number(e.target.value))}
      onBlur={() => v !== (value ?? 0) && onCommit(v)}
      className={cn(
        "rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-right tabular-nums transition hover:border-border focus:border-ring focus:bg-card focus:outline-none",
        width,
      )}
    />
  );
}
