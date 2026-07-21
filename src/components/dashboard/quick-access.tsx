"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

export interface QuickLink {
  href: string;
  label: string;
  sub: string;
  color: string;
  icon: React.ReactNode;
}

/**
 * Horizontally scrollable quick-access strip. Arrows appear only when the row
 * actually overflows, so it degrades to a plain row on wide screens.
 */
export function QuickAccessCarousel({ links }: { links: QuickLink[] }) {
  const t = useT();
  const ref = React.useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(true);

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  React.useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  function scrollBy(dir: 1 | -1) {
    ref.current?.scrollBy({ left: dir * Math.max(240, (ref.current.clientWidth ?? 0) * 0.8), behavior: "smooth" });
  }

  const hidden = atStart && atEnd; // no overflow → no arrows

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {links.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group flex min-w-[190px] flex-1 snap-start items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white transition group-hover:scale-105 [&_svg]:size-4"
              style={{ backgroundColor: q.color }}
            >
              {q.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t(q.label)}</p>
              <p className="truncate text-[11px] text-muted-foreground">{t(q.sub)}</p>
            </div>
          </Link>
        ))}
      </div>

      {!hidden && (
        <>
          <CarouselArrow side="left" disabled={atStart} onClick={() => scrollBy(-1)} label={t("Sebelumnya")} />
          <CarouselArrow side="right" disabled={atEnd} onClick={() => scrollBy(1)} label={t("Berikutnya")} />
        </>
      )}
    </div>
  );
}

function CarouselArrow({
  side, disabled, onClick, label,
}: { side: "left" | "right"; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-md transition hover:bg-muted disabled:pointer-events-none disabled:opacity-0 sm:flex",
        side === "left" ? "-left-3" : "-right-3",
      )}
    >
      {side === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
    </button>
  );
}
