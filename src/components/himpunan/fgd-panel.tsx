"use client";
import * as React from "react";
import { toast } from "sonner";
import { GripVertical, Loader2, Plus, Table2, Trash2 } from "lucide-react";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  createFgdPlanAction, createFgdRowAction, deleteFgdPlanAction, deleteFgdRowAction,
  reorderFgdRowsAction, updateFgdPlanAction, updateFgdRowAction,
} from "@/lib/actions/himpunan";
import { HOME_ORG } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import { useSynced } from "@/lib/use-synced";
import { cn } from "@/lib/utils";
import type { FgdPlan, FgdRow } from "@/lib/types";

// ============================================================
// FGD plotting: which HMSI department talks to which of theirs.
//
// Edited straight in the table, like the Rundown, rather than through a dialog:
// this is a grid of short strings that gets filled in one pass, and a dialog
// per cell would be twenty round trips of clicking. Cells save on blur.
//
// A new table starts pre-filled with the ten HMSI departments (seeded in the
// repo, not here, so a table created any other way gets them too). They stay
// editable: some editions merge departments, and the partner may have fewer.
// ============================================================

export function FgdPanel({
  eventId, plans, rows, canManage,
}: {
  eventId: string;
  plans: FgdPlan[];
  rows: Record<string, FgdRow[]>;
  canManage: boolean;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const [addOpen, setAddOpen] = React.useState(false);
  const [partner, setPartner] = React.useState("");
  const [title, setTitle] = React.useState("");

  function addPlan() {
    start(async () => {
      const res = await createFgdPlanAction({ event_id: eventId, partner_name: partner, title });
      if (res.ok) {
        toast.success(t("Tabel FGD dibuat"));
        setAddOpen(false);
        setPartner("");
        setTitle("");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("Pasangkan tiap departemen HMSI ITS dengan departemen padanannya di himpunan mitra. Satu Ormawa Visit boleh punya beberapa tabel.")}
        </p>
        {canManage && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> {t("Tabel baru")}
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={<Table2 />}
          title={t("Belum ada tabel FGD")}
          description={
            canManage
              ? t("Buat tabel baru untuk mulai memplot pasangan departemen. Sepuluh departemen HMSI ITS terisi otomatis.")
              : t("Belum ada plotting FGD untuk Ormawa Visit ini.")
          }
        />
      ) : (
        <div className="space-y-5">
          {plans.map((plan) => (
            <PlanTable key={plan.id} plan={plan} rows={rows[plan.id] ?? []} canManage={canManage} />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Tabel FGD baru")}</DialogTitle>
            <DialogDescription>
              {t("Kolom kiri otomatis terisi 10 departemen HMSI ITS dan tetap bisa diubah.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("Nama himpunan mitra")}</label>
              <Input
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                placeholder="HMTI UB, KBMDSI, …"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("Judul tabel (opsional)")}</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("mis. Sesi pagi")} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button onClick={addPlan} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} {t("Buat")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanTable({
  plan, rows, canManage,
}: {
  plan: FgdPlan;
  rows: FgdRow[];
  canManage: boolean;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const [delOpen, setDelOpen] = React.useState(false);
  // The row order shown while a drag is being saved. `useSynced` hands control
  // back to the server's order as soon as the revalidated props arrive, so a
  // failed save undoes itself without a rollback branch of its own.
  const [order, setOrder] = useSynced(rows);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function addRow() {
    start(async () => {
      const res = await createFgdRowAction(plan.id);
      if (!res.ok) toast.error(res.error);
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.findIndex((r) => r.id === active.id);
    const to = order.findIndex((r) => r.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(order, from, to);
    const before = order;
    setOrder(next);
    void reorderFgdRowsAction(next.map((r) => r.id)).then((res) => {
      if (!res.ok) { toast.error(res.error); setOrder(before); }
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <PlanTitle plan={plan} canManage={canManage} />
        <span className="ml-auto text-[11px] text-muted-foreground">
          {rows.length} {t("baris")}
        </span>
        {canManage && (
          <Button variant="ghost" size="icon-sm" onClick={() => setDelOpen(true)} title={t("Hapus tabel")}>
            <Trash2 className="size-4 text-danger" />
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {canManage && <th className="w-8 border-b border-border" />}
              <th className="w-1/2 border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {HOME_ORG}
              </th>
              <th className="w-1/2 border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <PartnerHeading plan={plan} canManage={canManage} />
              </th>
              {canManage && <th className="w-10 border-b border-border" />}
            </tr>
          </thead>
          <SortableContext items={order.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <tbody>
            {order.map((row) => (
              <RowCells key={row.id} row={row} canManage={canManage} />
            ))}
            {order.length === 0 && (
              <tr>
                <td colSpan={canManage ? 4 : 2} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("Tabel ini kosong.")}
                </td>
              </tr>
            )}
          </tbody>
          </SortableContext>
        </table>
        </DndContext>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2">
          <Button variant="ghost" size="sm" onClick={addRow} disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}{" "}
            {t("Tambah baris")}
          </Button>
          {order.length > 1 && (
            <span className="text-[11px] text-muted-foreground">
              {t("Seret ikon untuk mengurutkan baris.")}
            </span>
          )}
        </div>
      )}

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Hapus tabel FGD?")}</DialogTitle>
            <DialogDescription>
              {t("Seluruh barisnya ikut terhapus dan tidak bisa dikembalikan.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => start(async () => {
                const res = await deleteFgdPlanAction(plan.id);
                if (res.ok) { toast.success(t("Tabel FGD dihapus")); setDelOpen(false); }
                else toast.error(res.error);
              })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} {t("Hapus")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PlanTitle({ plan, canManage }: { plan: FgdPlan; canManage: boolean }) {
  const t = useT();
  const [value, setValue] = useSynced(plan.title);
  if (!canManage) {
    return <span className="text-sm font-semibold">{plan.title || t("Plotting FGD")}</span>;
  }
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value === plan.title) return;
        void updateFgdPlanAction(plan.id, { title: value }).then((r) => {
          if (!r.ok) toast.error(r.error);
        });
      }}
      placeholder={t("Plotting FGD")}
      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground focus:ring-0"
    />
  );
}

/** The right-hand column heading is the partner's name, edited in place. */
function PartnerHeading({ plan, canManage }: { plan: FgdPlan; canManage: boolean }) {
  const t = useT();
  const [value, setValue] = useSynced(plan.partner_name);
  if (!canManage) {
    return <>{plan.partner_name || t("(belum diisi)")}</>;
  }
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value === plan.partner_name) return;
        void updateFgdPlanAction(plan.id, { partner_name: value }).then((r) => {
          if (!r.ok) toast.error(r.error);
        });
      }}
      placeholder={t("Nama himpunan mitra")}
      className="w-full border-0 bg-transparent p-0 text-xs font-semibold uppercase tracking-wide outline-none placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/70 focus:ring-0"
    />
  );
}

function RowCells({ row, canManage }: { row: FgdRow; canManage: boolean }) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: !canManage,
  });
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group", isDragging && "relative z-10 bg-muted shadow-lg")}
    >
      {canManage && (
        <td className="border-b border-border px-1 text-center align-middle">
          <button
            {...attributes}
            {...listeners}
            type="button"
            className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={t("Geser untuk mengurutkan")}
            title={t("Geser untuk mengurutkan")}
          >
            <GripVertical className="size-3.5" />
          </button>
        </td>
      )}
      <Cell row={row} field="ours" canManage={canManage} />
      <Cell row={row} field="theirs" canManage={canManage} />
      {canManage && (
        <td className="border-b border-border px-1 text-center align-middle">
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              const res = await deleteFgdRowAction(row.id);
              if (!res.ok) toast.error(res.error);
            })}
            className="rounded p-1 text-muted-foreground/50 opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus:opacity-100"
            title={t("Hapus baris")}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </button>
        </td>
      )}
    </tr>
  );
}

function Cell({
  row, field, canManage,
}: {
  row: FgdRow;
  field: "ours" | "theirs";
  canManage: boolean;
}) {
  const t = useT();
  const [value, setValue] = useSynced(row[field]);
  const placeholder = field === "ours" ? t("Departemen HMSI") : t("Departemen mitra");

  if (!canManage) {
    return (
      <td className="border-b border-border px-3 py-2 align-top">
        {row[field] || <span className="text-muted-foreground">-</span>}
      </td>
    );
  }
  return (
    <td className="border-b border-border p-0 align-top">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value === row[field]) return;
          void updateFgdRowAction(row.id, { [field]: value }).then((r) => {
            if (!r.ok) toast.error(r.error);
          });
        }}
        rows={1}
        placeholder={placeholder}
        className={cn(
          // `autosize` (field-sizing: content) is what keeps a long department
          // name from being clipped, same as the Rundown cells.
          "autosize w-full resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none",
          "placeholder:text-muted-foreground/50 focus:bg-primary/5",
        )}
      />
    </td>
  );
}
