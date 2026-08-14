"use client";
import * as React from "react";
import { CircleSlash, LayoutGrid } from "lucide-react";
import { setActiveDivision } from "@/lib/actions/session";
import { FilterMultiSelect, type FilterOption } from "@/components/ui/filter-multi-select";
import { NO_DIVISION, serialiseDivisionFocus } from "@/lib/task-filters";
import type { Division } from "@/lib/types";
import { useT } from "@/lib/i18n/provider";

/**
 * Focus the Work Breakdown on one or more divisions.
 *
 * Multi-select since v1.35.0: "LO and Event" is a normal thing to want to see,
 * and the old single-select made it a choice between them.
 *
 * The selection is CONTROLLED BY THE PARENT and merely mirrored into a cookie,
 * which is the opposite of how the single-select worked. It has to be: writing
 * the cookie is a server action, so the value only comes back a round trip
 * later. Ticking a second division before that landed used to compute the
 * toggle against the stale (still empty) selection and REPLACE the first one
 * instead of adding to it. The parent's state answers immediately; the cookie
 * catches up and is only read again on the next page load, which is all it was
 * ever for.
 */
export function DivisionFilter({
  divisions, active, onChange, showNoDivision = false,
}: {
  divisions: Division[];
  /** Ticked division keys. Empty = no filter. */
  active: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** Offer "Tanpa divisi" - only worth showing when some task actually has
   *  none, e.g. after the division it belonged to was deleted. */
  showNoDivision?: boolean;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();

  const options: FilterOption[] = divisions.map((d) => ({
    value: d.key,
    label: d.name,
    color: d.color,
  }));
  if (showNoDivision) {
    options.push({
      value: NO_DIVISION,
      label: t("Tanpa divisi"),
      muted: true,
      icon: <CircleSlash className="size-3 shrink-0 text-muted-foreground" />,
    });
  }

  return (
    <FilterMultiSelect
      label={t("Fokus divisi")}
      allLabel={t("Semua Divisi")}
      unit={t("divisi")}
      icon={<LayoutGrid className="size-3.5" />}
      options={options}
      picked={active}
      onChange={(next) => {
        onChange(next);
        start(() => setActiveDivision(serialiseDivisionFocus(next)));
      }}
      align="end"
      // Deliberately NOT disabled while the cookie is being written: the filter
      // has already applied locally, and blocking the next tick is exactly the
      // lag that made the old version lose selections.
      className={pending ? "opacity-60" : undefined}
      emptyText={t("Belum ada divisi")}
    />
  );
}
