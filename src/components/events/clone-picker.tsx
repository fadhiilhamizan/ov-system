"use client";
import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/provider";
import { CLONE_MODULES, type CloneModule, type CloneSources, type OVEvent } from "@/lib/types";

/** Label for each copyable menu, in the order they are copied. */
export function useCloneLabels(): Record<CloneModule, string> {
  const t = useT();
  return {
    divisions: t("Divisi"),
    members: t("Anggota & Tim"),
    prospects: t("Reach & Offer"),
    tasks: t("Tugas (WBS)"),
    rundown: t("Rundown"),
    jobs: t("Job Hari-H"),
    budget: t("Anggaran (RAB)"),
  };
}

/**
 * Pick, per menu, which Ormawa Visit to copy it from.
 *
 * One source dropdown PER ROW rather than a single source for everything: the
 * whole point is that divisions can come from one edition while the rundown
 * comes from another. Unticking a row removes it from the payload entirely.
 */
export function ClonePicker({
  options, value, onChange,
}: {
  /** Editions that may be used as a source (the target itself is excluded). */
  options: OVEvent[];
  value: CloneSources;
  onChange: (next: CloneSources) => void;
}) {
  const t = useT();
  const labels = useCloneLabels();
  const fallback = options[0]?.id ?? "";

  function toggle(mod: CloneModule, on: boolean) {
    const next = { ...value };
    if (on) next[mod] = value[mod] || fallback;
    else delete next[mod];
    onChange(next);
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {CLONE_MODULES.map((mod) => {
        const on = !!value[mod];
        return (
          <div key={mod} className="flex items-center gap-3 px-3 py-2">
            <label className="flex min-w-[130px] cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={on} onCheckedChange={(v) => toggle(mod, v === true)} />
              {labels[mod]}
            </label>
            <div className="min-w-0 flex-1">
              {on ? (
                <Select value={value[mod]} onValueChange={(v) => onChange({ ...value, [mod]: v })}>
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
        );
      })}
    </div>
  );
}
