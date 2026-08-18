"use client";
import * as React from "react";
import { toast } from "sonner";
import { Copy, TerminalSquare, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { EmptyState } from "@/components/ui/empty";
import {
  clearConsoleLines, getConsoleLines, subscribeConsole, type ConsoleLevel,
} from "@/lib/dev-console";
import { cn } from "@/lib/utils";

// ============================================================
// The console, in the page.
//
// For the two cases where devtools is not an option and the bug only happens
// there: a phone, which is what most of this app is used on, and production.
//
// This shows YOUR session only, and it is not persisted anywhere. That is the
// deliberate split from the Error tab: that one collects everybody's crashes
// into the database, this one is a live view of the noise in front of you.
//
// There is no eval box, and there will not be one. A field that runs arbitrary
// JavaScript in an authenticated session is an XSS vector with a UI: anyone who
// can talk a developer into pasting a line has the developer's session. The
// diagnostics worth having are the ones already on the Sistem tab, which run
// known queries.
// ============================================================

const LEVEL_META: Record<ConsoleLevel, { label: string; className: string }> = {
  error: { label: "error", className: "text-danger" },
  warn: { label: "warn", className: "text-amber-600 dark:text-amber-400" },
  info: { label: "info", className: "text-sky-600 dark:text-sky-400" },
  log: { label: "log", className: "text-foreground" },
  debug: { label: "debug", className: "text-muted-foreground" },
};

export function ConsolePanel() {
  // useSyncExternalStore, not useState + effect: the buffer is written from
  // outside React (a patched console can be called by anything, at any time),
  // and this is the hook that exists for exactly that.
  const lines = React.useSyncExternalStore(subscribeConsole, getConsoleLines, () => []);
  const [levels, setLevels] = React.useState<Set<string>>(new Set());
  const [q, setQ] = React.useState("");
  const [follow, setFollow] = React.useState(true);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  const shown = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    return lines.filter(
      (l) => (levels.size === 0 || levels.has(l.level)) && (!query || l.text.toLowerCase().includes(query)),
    );
  }, [lines, levels, q]);

  React.useEffect(() => {
    if (follow) endRef.current?.scrollIntoView({ block: "end" });
  }, [shown.length, follow]);

  function copyAll() {
    const text = shown.map((l) => `[${time(l.at)}] ${l.level.toUpperCase()} ${l.text}`).join("\n");
    void navigator.clipboard.writeText(text);
    toast.success(`${shown.length} baris disalin`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1 sm:max-w-xs">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Saring isi log…" />
        </div>
        <FilterMultiSelect
          label="Level" allLabel="Semua level" unit="level"
          options={(Object.keys(LEVEL_META) as ConsoleLevel[]).map((l) => ({
            value: l,
            label: LEVEL_META[l].label,
            count: lines.filter((x) => x.level === l).length,
          }))}
          picked={levels} onChange={setLevels}
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-primary" />
          Ikuti baris terbaru
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyAll} disabled={!shown.length}>
            <Copy className="size-4" /> Salin
          </Button>
          <Button variant="outline" size="sm" onClick={clearConsoleLines} disabled={!lines.length}>
            <Trash2 className="size-4" /> Bersihkan
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {shown.length} dari {lines.length} baris di sesi ini. Buffer maksimal 400 baris, tidak disimpan
        ke mana pun, dan hilang saat halaman dimuat ulang. Error yang perlu ditindaklanjuti ada di tab Error.
      </p>

      <Card className="p-0">
        {shown.length === 0 ? (
          <EmptyState
            icon={<TerminalSquare />}
            title={lines.length ? "Tidak ada yang cocok" : "Konsol masih kosong"}
            description={
              lines.length
                ? "Longgarkan saringan level atau kata kuncinya."
                : // Capture announces itself with one info line the moment it
                  // installs, so a truly empty buffer means it never installed:
                  // this tab was opened on a page load that happened before the
                  // session was recognised as a developer.
                  "Belum ada baris sama sekali, yang berarti perekaman belum terpasang di pemuatan halaman ini. Muat ulang halaman, lalu buka lagi tab ini."
            }
          />
        ) : (
          <div className="max-h-[60vh] overflow-auto p-2 font-mono text-[11px] leading-relaxed">
            {shown.map((l) => (
              <div key={l.id} className="flex gap-2 border-b border-border/40 py-1 last:border-0">
                <span className="shrink-0 text-muted-foreground/70">{time(l.at)}</span>
                <span className={cn("w-11 shrink-0 uppercase", LEVEL_META[l.level].className)}>
                  {LEVEL_META[l.level].label}
                </span>
                <span className={cn("min-w-0 whitespace-pre-wrap break-words", LEVEL_META[l.level].className)}>
                  {l.text}
                </span>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </Card>
    </div>
  );
}

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("id-ID", { hour12: false }) +
  "." +
  String(ms % 1000).padStart(3, "0");
