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
import { useLocalFirst, type LocalFirst } from "@/lib/use-local-first";
import { useCellDraft } from "@/lib/use-cell-draft";
import { LocalSaveStatus } from "@/components/ui/local-save-status";
import { cn, uuidV4 } from "@/lib/utils";
import type { FgdPlan, FgdRow } from "@/lib/types";
import { ImportXlsxButton } from "@/components/ui/import-xlsx";

// ============================================================
// FGD plotting: which HMSI department talks to which of theirs.
//
// Edited straight in the table, like the Rundown, rather than through a dialog:
// this is a grid of short strings that gets filled in one pass, and a dialog
// per cell would be twenty round trips of clicking. Local-first like the
// Rundown too (use-local-first.ts): typing, adding, removing and dragging rows
// all show at once and save in the background, one write after another.
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
  // Plan-level edits (title, partner name, delete) are local-first too.
  const planStore = useLocalFirst(plans);
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
          <div className="flex items-center gap-2">
            {plans.length > 0 && (
              <ImportXlsxButton
                module="fgd"
                targets={plans.map((p, i) => ({
                  value: p.id,
                  label: [p.title || `${t("Tabel")} ${i + 1}`, p.partner_name].filter(Boolean).join(" - "),
                }))}
              />
            )}
            <Button onClick={() => setAddOpen(true)} aria-keyshortcuts="N">
              <Plus className="size-4" /> {t("Tabel baru")}
            </Button>
          </div>
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
          {planStore.rows.map((plan) => (
            <PlanTable key={plan.id} plan={plan} rows={rows[plan.id] ?? []} canManage={canManage} planStore={planStore} />
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
  plan, rows, canManage, planStore,
}: {
  plan: FgdPlan;
  rows: FgdRow[];
  canManage: boolean;
  planStore: LocalFirst<FgdPlan>;
}) {
  const t = useT();
  const [delOpen, setDelOpen] = React.useState(false);
  const store = useLocalFirst(rows);
  const order = store.rows;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function addRow() {
    const id = uuidV4();
    const nextOrder = order.reduce((m, r) => Math.max(m, r.order + 1), 0);
    store.add({ id, plan_id: plan.id, ours: "", theirs: "", order: nextOrder }, () => createFgdRowAction(plan.id, id));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.findIndex((r) => r.id === active.id);
    const to = order.findIndex((r) => r.id === over.id);
    if (from < 0 || to < 0) return;
    const ids = arrayMove(order, from, to).map((r) => r.id);
    store.reorder(ids, () => reorderFgdRowsAction(ids));
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <PlanTitle plan={plan} canManage={canManage} planStore={planStore} />
        <LocalSaveStatus status={store.status} className="ml-auto" />
        <span className={cn("text-[11px] text-muted-foreground", store.status === "idle" && "ml-auto")}>
          {order.length} {t("baris")}
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
              <th className="w-1/2 border-b border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                {HOME_ORG}
              </th>
              <th className="w-1/2 border-b border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                <PartnerHeading plan={plan} canManage={canManage} planStore={planStore} />
              </th>
              {canManage && <th className="w-10 border-b border-border" />}
            </tr>
          </thead>
          <SortableContext items={order.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <tbody>
            {order.map((row) => (
              <RowCells key={row.id} row={row} canManage={canManage} store={store} />
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
          <Button variant="ghost" size="sm" onClick={addRow}>
            <Plus className="size-3.5" /> {t("Tambah baris")}
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
              onClick={() => {
                setDelOpen(false);
                planStore.remove([plan.id], () => deleteFgdPlanAction(plan.id), { success: t("Tabel FGD dihapus") });
              }}
            >
              {t("Hapus")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PlanTitle({ plan, canManage, planStore }: { plan: FgdPlan; canManage: boolean; planStore: LocalFirst<FgdPlan> }) {
  const t = useT();
  const d = useCellDraft(plan.title, (title) =>
    planStore.patch(plan.id, { title }, () => updateFgdPlanAction(plan.id, { title })), 1500);
  if (!canManage) {
    return <span className="text-sm font-semibold">{plan.title || t("Plotting FGD")}</span>;
  }
  return (
    <input
      value={d.v}
      onChange={(e) => d.set(e.target.value)}
      onFocus={d.onFocus}
      onBlur={d.onBlur}
      placeholder={t("Plotting FGD")}
      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground focus:ring-0"
    />
  );
}

/** The right-hand column heading is the partner's name, edited in place. */
function PartnerHeading({ plan, canManage, planStore }: { plan: FgdPlan; canManage: boolean; planStore: LocalFirst<FgdPlan> }) {
  const t = useT();
  const d = useCellDraft(plan.partner_name, (partner_name) =>
    planStore.patch(plan.id, { partner_name }, () => updateFgdPlanAction(plan.id, { partner_name })), 1500);
  if (!canManage) {
    return <>{plan.partner_name || t("(belum diisi)")}</>;
  }
  return (
    <input
      value={d.v}
      onChange={(e) => d.set(e.target.value)}
      onFocus={d.onFocus}
      onBlur={d.onBlur}
      placeholder={t("Nama himpunan mitra")}
      className="w-full border-0 bg-transparent p-0 text-xs font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/70 focus:ring-0"
    />
  );
}

function RowCells({ row, canManage, store }: { row: FgdRow; canManage: boolean; store: LocalFirst<FgdRow> }) {
  const t = useT();
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
      <Cell row={row} field="ours" canManage={canManage} store={store} />
      <Cell row={row} field="theirs" canManage={canManage} store={store} />
      {canManage && (
        <td className="border-b border-border px-1 text-center align-middle">
          <button
            type="button"
            onClick={() => store.remove([row.id], () => deleteFgdRowAction(row.id))}
            className="rounded p-1 text-muted-foreground/50 opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus:opacity-100"
            title={t("Hapus baris")}
          >
            <Trash2 className="size-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
}

function Cell({
  row, field, canManage, store,
}: {
  row: FgdRow;
  field: "ours" | "theirs";
  canManage: boolean;
  store: LocalFirst<FgdRow>;
}) {
  const t = useT();
  const d = useCellDraft(row[field], (value) =>
    store.patch(row.id, { [field]: value }, () => updateFgdRowAction(row.id, { [field]: value })), 1500);
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
        value={d.v}
        onChange={(e) => d.set(e.target.value)}
        onFocus={d.onFocus}
        onBlur={d.onBlur}
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
