"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCloneOptionsAction } from "@/lib/actions/manage";
import { useT } from "@/lib/i18n/provider";
import { CLONE_MODULES, type CloneFilters, type CloneModule, type CloneSources, type OVEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Label for each copyable menu, in the order they are copied. */
export function useCloneLabels(): Record<CloneModule, string> {
  const t = useT();
  return {
    divisions: t("Divisi"),
    members: t("Anggota & Tim"),
    prospects: t("Reach & Offer"),
    tasks: t("Work Breakdown"),
    rundown: t("Rundown"),
    jobs: t("Job Hari-H"),
    links: t("Super Link"),
    budget: t("Anggaran (RAB)"),
  };
}

/** Source-edition options loaded on demand: divisions and RAB plans. */
interface SourceOptions {
  divisions: { key: string; name: string }[];
  plans: { id: string; name: string }[];
}

/**
 * Pick, per menu, which Ormawa Visit to copy it from - and, for the three menus
 * that support it, WHICH part.
 *
 * One source dropdown PER ROW: divisions can come from one edition while the
 * rundown comes from another. For members/Work Breakdown a division filter
 * narrows the copy to specific divisions; for the RAB a plan filter narrows it
 * to specific plans. Those options are fetched from the chosen source only when
 * it is chosen, so an unopened dialog costs nothing.
 */
export function ClonePicker({
  options, value, onChange, filters, onFiltersChange,
}: {
  /** Editions that may be used as a source (the target itself is excluded). */
  options: OVEvent[];
  value: CloneSources;
  onChange: (next: CloneSources) => void;
  filters: CloneFilters;
  onFiltersChange: (next: CloneFilters) => void;
}) {
  const t = useT();
  const labels = useCloneLabels();
  const fallback = options[0]?.id ?? "";

  // One options cache per source event id, shared by every row that copies from
  // it. Never re-fetched for an id already loaded.
  const [cache, setCache] = React.useState<Record<string, SourceOptions>>({});
  const [loading, setLoading] = React.useState<Set<string>>(new Set());

  const load = React.useCallback((eventId: string) => {
    if (!eventId || cache[eventId] || loading.has(eventId)) return;
    setLoading((s) => new Set(s).add(eventId));
    getCloneOptionsAction(eventId)
      .then((opts) => setCache((c) => ({ ...c, [eventId]: opts })))
      .catch(() => toast.error(t("Gagal memuat pilihan divisi/rencana.")))
      .finally(() => setLoading((s) => { const n = new Set(s); n.delete(eventId); return n; }));
  }, [cache, loading, t]);

  function toggle(mod: CloneModule, on: boolean) {
    const next = { ...value };
    if (on) { next[mod] = value[mod] || fallback; load(next[mod]!); }
    else {
      delete next[mod];
      // Drop this menu's filter too, so a re-tick starts from "everything".
      onFiltersChange(clearFilterFor(mod, filters));
    }
    onChange(next);
  }

  function setSource(mod: CloneModule, src: string) {
    onChange({ ...value, [mod]: src });
    onFiltersChange(clearFilterFor(mod, filters));
    load(src);
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {CLONE_MODULES.map((mod) => {
        const on = !!value[mod];
        const src = value[mod];
        const opts = src ? cache[src] : undefined;
        const isLoading = src ? loading.has(src) : false;
        return (
          <div key={mod} className="px-3 py-2">
            <div className="flex items-center gap-3">
              <label className="flex min-w-[130px] cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={on} onCheckedChange={(v) => toggle(mod, v === true)} />
                {labels[mod]}
              </label>
              <div className="min-w-0 flex-1">
                {on ? (
                  <Select value={src} onValueChange={(v) => setSource(mod, v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {options.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("Tidak disalin")}</span>
                )}
              </div>
            </div>

            {/* Per-menu narrowing. Only appears once the row is on and its source
                options have loaded. */}
            {on && (mod === "members" || mod === "tasks" || mod === "budget") && (
              <div className="mt-2 pl-[calc(130px+0.75rem)]">
                {isLoading ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> {t("Memuat pilihan…")}
                  </span>
                ) : mod === "budget" ? (
                  <PlanFilter
                    plans={opts?.plans ?? []}
                    picked={filters.budgetPlanIds ?? []}
                    onChange={(ids) => onFiltersChange({ ...filters, budgetPlanIds: ids })}
                  />
                ) : (
                  <DivisionFilter
                    divisions={opts?.divisions ?? []}
                    picked={(mod === "tasks" ? filters.taskDivisions : filters.memberDivisions) ?? []}
                    onChange={(keys) =>
                      onFiltersChange(
                        mod === "tasks"
                          ? { ...filters, taskDivisions: keys }
                          : { ...filters, memberDivisions: keys },
                      )
                    }
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function clearFilterFor(mod: CloneModule, filters: CloneFilters): CloneFilters {
  if (mod === "tasks") return { ...filters, taskDivisions: undefined };
  if (mod === "members") return { ...filters, memberDivisions: undefined };
  if (mod === "budget") return { ...filters, budgetPlanIds: undefined };
  return filters;
}

/** Chips of divisions; none picked = copy all of them. */
function DivisionFilter({
  divisions, picked, onChange,
}: {
  divisions: { key: string; name: string }[];
  picked: string[];
  onChange: (keys: string[]) => void;
}) {
  const t = useT();
  if (!divisions.length) {
    return <span className="text-[11px] text-muted-foreground">{t("Sumber ini belum punya divisi.")}</span>;
  }
  const set = new Set(picked);
  const toggle = (key: string) => {
    const n = new Set(set);
    if (n.has(key)) n.delete(key); else n.add(key);
    onChange([...n]);
  };
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {picked.length ? `${picked.length} ${t("divisi dipilih")}` : t("Semua divisi")}
      </p>
      <div className="flex flex-wrap gap-1">
        {divisions.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => toggle(d.key)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] transition",
              set.has(d.key)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {d.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Chips of budget plans; none picked = copy all. Hidden when there is only one
 *  plan, since "which plan" is not a real choice then. */
function PlanFilter({
  plans, picked, onChange,
}: {
  plans: { id: string; name: string }[];
  picked: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useT();
  if (plans.length <= 1) {
    return (
      <span className="text-[11px] text-muted-foreground">
        {plans.length ? t("Sumber ini punya satu rencana; semuanya disalin.") : t("Sumber ini belum punya rencana RAB.")}
      </span>
    );
  }
  const set = new Set(picked);
  const toggle = (id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    onChange([...n]);
  };
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {picked.length ? `${picked.length} ${t("rencana dipilih")}` : t("Semua rencana")}
      </p>
      <div className="flex flex-wrap gap-1">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] transition",
              set.has(p.id)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
