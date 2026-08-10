"use client";
import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, GripVertical } from "lucide-react";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FaqActions } from "@/components/faq/faq-manage";
import { reorderFaqsAction } from "@/lib/actions/faq";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";
import { useAutosave } from "@/lib/use-autosave";
import { SaveIndicator } from "@/components/ui/save-indicator";
import { cn } from "@/lib/utils";
import type { Faq } from "@/lib/types";

const CARD = "rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden";

/** The card itself, with no drag wiring — rendered as-is for read-only roles. */
function FaqCard({
  faq, index, manage, defaultOpen, handle, style, dragging, innerRef,
}: {
  faq: Faq;
  index: number;
  manage: boolean;
  defaultOpen: boolean;
  /** The grip button, supplied only when the row is sortable. */
  handle?: React.ReactNode;
  style?: React.CSSProperties;
  dragging?: boolean;
  innerRef?: (node: HTMLElement | null) => void;
}) {
  return (
    <div ref={innerRef} style={style} className={cn(CARD, dragging && "relative z-10 shadow-lg")}>
      <details className="group" open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 font-medium transition hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
          {handle}
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
            {index + 1}
          </span>
          <span className="flex-1">{faq.question}</span>
          {manage && <FaqActions faq={faq} />}
          <ChevronDown className="size-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className={cn(
          "whitespace-pre-line border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground",
          handle ? "pl-[4.5rem]" : "pl-16",
        )}>
          {faq.answer}
        </div>
      </details>
    </div>
  );
}

/** Sortable variant. `useSortable` needs a DndContext above it, so this is only
 *  ever rendered inside the manage branch below. */
function SortableFaq({ faq, index, defaultOpen }: { faq: Faq; index: number; defaultOpen: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: faq.id });
  return (
    <FaqCard
      faq={faq}
      index={index}
      manage
      defaultOpen={defaultOpen}
      innerRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragging={isDragging}
      handle={
        // The grip is the ONLY drag handle: dragging the summary itself would
        // fight with the click that expands the answer.
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.preventDefault()}
          className="flex shrink-0 cursor-grab touch-none items-center justify-center rounded p-1 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
          aria-label="Geser untuk mengurutkan"
        >
          <GripVertical className="size-4" />
        </button>
      }
    />
  );
}

export function FaqList({ faqs, manage }: { faqs: Faq[]; manage: boolean }) {
  const t = useT();
  // Server order is the truth; this local copy exists so a drag lands instantly,
  // and it resets whenever the server sends a different sequence.
  const orderKey = faqs.map((f) => f.id).join(",");
  const [items, setItems] = useResetOn(orderKey, () => faqs);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const autosave = useAutosave();
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((f) => f.id === active.id);
    const to = items.findIndex((f) => f.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(items, from, to);
    setItems(next); // optimistic
    autosave.run(async () => {
      const res = await reorderFaqsAction(next.map((f) => f.id));
      if (!res.ok) { toast.error(res.error); setItems(faqs); }
      return res;
    });
  }

  if (!manage) {
    return (
      <div className="space-y-2.5">
        {items.map((f, i) => (
          <FaqCard key={f.id} faq={f} index={i} manage={false} defaultOpen={i === 0} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {t("Seret ikon untuk mengurutkan pertanyaan; nomor tersusun otomatis.")}
        <SaveIndicator status={autosave.status} />
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {items.map((f, i) => (
            <SortableFaq key={f.id} faq={f} index={i} defaultOpen={i === 0} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
