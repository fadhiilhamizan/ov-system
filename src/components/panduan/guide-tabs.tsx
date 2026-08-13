"use client";
import * as React from "react";
import { Workflow, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

type Tab = "flow" | "full";

/**
 * Toggle between the quick flowchart and the detailed per-feature guide.
 * Both are rendered on the server and passed in as children; this only switches
 * which one is visible.
 */
export function GuideTabs({ flow, full }: { flow: React.ReactNode; full: React.ReactNode }) {
  const t = useT();
  const [tab, setTab] = React.useState<Tab>("flow");

  /**
   * Follow the URL's anchor.
   *
   * Only ONE tab is mounted at a time, so a link to /panduan#guide-violet would
   * otherwise point at an element that is not in the document and land the
   * reader on the flowchart instead. Done in an effect rather than in the
   * initial state because the hash never reaches the server, and reading it
   * during render would be a hydration mismatch.
   */
  React.useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      if (hash === "alur") setTab("flow");
      else if (hash === "panduan-lengkap" || hash.startsWith("guide-")) setTab("full");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
        <TabBtn id="flow" active={tab} onSelect={setTab} icon={<Workflow className="size-4" />} label={t("Alur Singkat")} />
        <TabBtn id="full" active={tab} onSelect={setTab} icon={<BookOpen className="size-4" />} label={t("Panduan Lengkap per Fitur")} />
      </div>
      <div id={tab === "flow" ? "alur" : "panduan-lengkap"}>{tab === "flow" ? flow : full}</div>
    </div>
  );
}

/** Module-scope so the button keeps a stable component identity across renders. */
function TabBtn({
  id, active, onSelect, icon, label,
}: {
  id: Tab;
  active: Tab;
  onSelect: (t: Tab) => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
        active === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {label}
    </button>
  );
}
