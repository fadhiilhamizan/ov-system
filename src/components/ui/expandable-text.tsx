"use client";
import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

// ============================================================
// A note that is clamped until you ask for the rest of it.
//
// Table cells used to end a long note in a bare "…" with the full text hidden
// in a `title` tooltip, so the only reliable way to read a catatan was to open
// the row's EDIT dialog - a write action, on a page you may only have read
// access to, just to finish a sentence. Now the cell says how to see the rest
// and puts it back when you are done.
//
// HOW THE TOGGLE DECIDES TO APPEAR. Measured, not guessed from the character
// count: the same 90 characters clamp at two lines in a narrow Catatan column
// and fit on one in a wide one, so a length threshold shows a "Selengkapnya"
// that reveals nothing, which is worse than no button. The measurement happens
// in a REF CALLBACK rather than an effect - React runs it after the DOM is
// laid out, it re-runs whenever the element or the text changes, and it keeps
// this component clear of the set-state-in-effect pattern the codebase has
// spent a lint pass removing.
// ============================================================

export function ExpandableText({
  text,
  lines = 2,
  className,
  /** Rendered when there is no text at all. */
  empty = "-",
}: {
  text: string | null | undefined;
  /** How many lines to show while collapsed. */
  lines?: 1 | 2 | 3;
  className?: string;
  empty?: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [clipped, setClipped] = React.useState(false);
  const value = (text ?? "").trim();

  // Only attached while collapsed: expanded, scrollHeight equals clientHeight
  // and the element would report itself as "fits", taking the Tutup button away
  // with it. Re-created per `value` so editing a note re-measures.
  const measure = React.useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const over = el.scrollHeight > el.clientHeight + 1;
      setClipped((prev) => (prev === over ? prev : over));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure when the text changes
    [value, lines],
  );

  if (!value) return <span className="text-muted-foreground">{empty}</span>;

  const clamp = lines === 1 ? "line-clamp-1" : lines === 3 ? "line-clamp-3" : "line-clamp-2";

  return (
    <div className={cn("min-w-0", className)}>
      <p
        ref={open ? undefined : measure}
        className={cn("whitespace-pre-line break-words", !open && clamp)}
      >
        {value}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary transition hover:underline"
        >
          {open ? (
            <>
              {t("Tutup")} <ChevronUp className="size-3" />
            </>
          ) : (
            <>
              {t("Selengkapnya")} <ChevronDown className="size-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
