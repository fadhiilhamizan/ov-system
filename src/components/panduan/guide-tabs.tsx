"use client";
import * as React from "react";
import { Workflow, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

/**
 * Toggle between the quick flowchart and the detailed per-feature guide.
 * Both are rendered on the server and passed in as children; this only switches
 * which one is visible.
 */
export function GuideTabs({ flow, full }: { flow: React.ReactNode; full: React.ReactNode }) {
  const t = useT();
  const [tab, setTab] = React.useState<"flow" | "full">("flow");

  const Btn = ({ id, icon, label }: { id: "flow" | "full"; icon: React.ReactNode; label: string }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
        tab === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
        <Btn id="flow" icon={<Workflow className="size-4" />} label={t("Alur Singkat")} />
        <Btn id="full" icon={<BookOpen className="size-4" />} label={t("Panduan Lengkap per Fitur")} />
      </div>
      <div>{tab === "flow" ? flow : full}</div>
    </div>
  );
}
