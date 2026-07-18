"use client";
import * as React from "react";
import { toast } from "sonner";
import { Wallet, ChevronDown, Plus, Trash2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  updateBudgetItemAction, createBudgetItemAction, deleteBudgetItemAction,
  createBudgetPlanAction, deleteBudgetPlanAction,
} from "@/lib/actions/budget";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetPlan, OVEvent } from "@/lib/types";

const CATEGORY_PRESETS = ["KONSUMSI", "TRANSPORTASI & AKOMODASI", "PERALATAN & CETAKAN", "PEMINJAMAN TEMPAT", "LAIN-LAIN"];

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

export function AddBudgetPlanButton({ events, defaultEventId }: { events: OVEvent[]; defaultEventId: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [name, setName] = React.useState("");
  const [eventId, setEventId] = React.useState(defaultEventId);

  function submit() {
    start(async () => {
      const res = await createBudgetPlanAction({ name, event_id: eventId });
      if (res.ok) { toast.success("Rencana anggaran ditambahkan"); setOpen(false); setName(""); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Tambah Rencana</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Rencana Anggaran</DialogTitle>
          <DialogDescription>Buat skenario RAB baru (mis. "RAB Maksimal", "RAB Fix").</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Nama rencana <span className="text-danger">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="RAB Maksimal" />
          </div>
          <div className="grid gap-1.5">
            <Label>Ormawa Visit <span className="text-danger">*</span></Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />} Tambah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddItemDialog({ planId, categories }: { planId: string; categories: string[] }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState({ category: categories[0] ?? "LAIN-LAIN", name: "", qty: "", unit: "", unit_price: "" });
  const allCategories = [...new Set([...CATEGORY_PRESETS, ...categories])];

  function submit() {
    start(async () => {
      const res = await createBudgetItemAction(planId, {
        category: f.category,
        name: f.name,
        qty: f.qty ? Number(f.qty) : null,
        unit: f.unit,
        unit_price: f.unit_price ? Number(f.unit_price) : null,
      });
      if (res.ok) {
        toast.success("Item ditambahkan");
        setOpen(false);
        setF({ category: f.category, name: "", qty: "", unit: "", unit_price: "" });
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="size-3.5" /> Tambah Item</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Item Anggaran</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Kategori</Label>
            <Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value.toUpperCase() })} list="budget-categories" />
            <datalist id="budget-categories">{allCategories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="grid gap-1.5">
            <Label>Nama item <span className="text-danger">*</span></Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Konsumsi Peserta" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Qty</Label>
              <Input type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Satuan</Label>
              <Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="Kotak" />
            </div>
            <div className="grid gap-1.5">
              <Label>Harga satuan</Label>
              <Input type="number" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.name.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />} Tambah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePlanButton({ plan }: { plan: BudgetPlan }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-danger dark:hover:bg-red-500/10"
        >
          <Trash2 className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Hapus rencana anggaran?</DialogTitle>
          <DialogDescription>&ldquo;{plan.name}&rdquo; beserta seluruh itemnya akan dihapus permanen.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
          <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
            const res = await deleteBudgetPlanAction(plan.id);
            if (res.ok) { toast.success("Rencana anggaran dihapus"); setOpen(false); } else toast.error(res.error);
          })}>{pending && <Loader2 className="size-4 animate-spin" />}Hapus</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteItemButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex size-6 items-center justify-center rounded text-muted-foreground/60 transition hover:bg-red-50 hover:text-danger dark:hover:bg-red-500/10">
          <Trash2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus item?</DialogTitle>
          <DialogDescription>&ldquo;{itemName}&rdquo; akan dihapus dari rencana anggaran ini.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
          <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
            const res = await deleteBudgetItemAction(itemId);
            if (res.ok) toast.success("Item dihapus"); else toast.error(res.error);
            setOpen(false);
          })}>{pending && <Loader2 className="size-4 animate-spin" />}Hapus</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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

  function edit(itemId: string, patch: { qty?: number; unit_price?: number }) {
    setState((prev) =>
      prev.map((p) => ({
        ...p,
        items: p.items.map((it) => {
          if (it.id !== itemId) return it;
          const next = { ...it, ...patch };
          next.total = (next.qty ?? 0) * (next.unit_price ?? 0);
          return next;
        }),
      })),
    );
    updateBudgetItemAction(itemId, patch).then((r) => {
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
  onEdit: (itemId: string, patch: { qty?: number; unit_price?: number }) => void;
}) {
  const [open, setOpen] = React.useState(true);
  const grand = plan.items.reduce((s, i) => s + (i.total ?? 0), 0);

  // group by category preserving order
  const cats: { name: string; items: BudgetPlan["items"]; subtotal: number }[] = [];
  plan.items.forEach((it) => {
    let c = cats.find((x) => x.name === it.category);
    if (!c) {
      c = { name: it.category, items: [], subtotal: 0 };
      cats.push(c);
    }
    c.items.push(it);
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
        {canManage && <DeletePlanButton plan={plan} />}
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border">
          {/* category summary */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 px-5 py-3">
            {cats.map((c) => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: catColor(c.name) }} />
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">{formatRupiah(c.subtotal)}</span>
              </div>
            ))}
            {canManage && (
              <div className="ml-auto">
                <AddItemDialog planId={plan.id} categories={cats.map((c) => c.name)} />
              </div>
            )}
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
                  {canManage && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <React.Fragment key={c.name}>
                    <tr className="bg-muted/30">
                      <td colSpan={canManage ? 6 : 5} className="px-5 py-1.5 text-xs font-semibold" style={{ color: catColor(c.name) }}>
                        {c.name}
                      </td>
                    </tr>
                    {c.items.map((it) => (
                      <tr key={it.id} className="border-b border-border/60 last:border-0">
                        <td className="px-5 py-2">{it.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {canManage ? (
                            <NumCell value={it.qty} onCommit={(v) => onEdit(it.id, { qty: v })} width="w-16" />
                          ) : (
                            it.qty ?? "-"
                          )}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">{it.unit || "-"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {canManage ? (
                            <NumCell value={it.unit_price} onCommit={(v) => onEdit(it.id, { unit_price: v })} width="w-24" />
                          ) : (
                            formatRupiah(it.unit_price)
                          )}
                        </td>
                        <td className="px-5 py-2 text-right font-medium tabular-nums">{formatRupiah(it.total)}</td>
                        {canManage && (
                          <td className="px-2 py-2">
                            <DeleteItemButton itemId={it.id} itemName={it.name} />
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="border-b border-border">
                      <td colSpan={4} className="px-5 py-1.5 text-right text-xs text-muted-foreground">Subtotal {c.name}</td>
                      <td className="px-5 py-1.5 text-right text-xs font-semibold tabular-nums">{formatRupiah(c.subtotal)}</td>
                      {canManage && <td />}
                    </tr>
                  </React.Fragment>
                ))}
                <tr className="bg-muted/40">
                  <td colSpan={4} className="px-5 py-2.5 text-right font-semibold">Total Pengeluaran</td>
                  <td className="px-5 py-2.5 text-right text-base font-bold tabular-nums">{formatRupiah(grand)}</td>
                  {canManage && <td />}
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
