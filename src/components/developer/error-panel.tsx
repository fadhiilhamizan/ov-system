"use client";
import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronDown, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { deleteErrorAction, pruneErrorsAction, resolveErrorAction } from "@/lib/actions/developer";
import { ago, full } from "./developer-view";
import { cn } from "@/lib/utils";
import type { ErrorEntry } from "@/lib/types";

// ============================================================
// Errors real users hit.
//
// Filed by a listener in everybody's browser (SessionBeacons), not only the
// developer's, because the crashes worth knowing about are the ones you cannot
// reproduce. The identity on each row comes from the session token via a column
// default, never from the payload, so a report cannot be filed under somebody
// else's name.
//
// Grouped by MESSAGE. The same broken component fires the same error on every
// render and in every affected browser; one line per distinct message with a
// count is the difference between a list you read and a list you scroll past.
// ============================================================

const KIND_LABEL: Record<string, string> = {
  client: "Browser",
  boundary: "Error boundary",
  server: "Server",
};

export function ErrorPanel({ errors }: { errors: ErrorEntry[] }) {
  const [kinds, setKinds] = React.useState<Set<string>>(new Set());
  const [showResolved, setShowResolved] = React.useState(false);
  const [pending, start] = React.useTransition();

  const visible = errors.filter(
    (e) => (showResolved || !e.resolved) && (kinds.size === 0 || kinds.has(e.kind)),
  );

  const groups = React.useMemo(() => {
    const map = new Map<string, ErrorEntry[]>();
    for (const e of visible) {
      const list = map.get(e.message) ?? [];
      list.push(e);
      map.set(e.message, list);
    }
    return [...map.values()].sort(
      (a, b) => new Date(b[0].at).getTime() - new Date(a[0].at).getTime(),
    );
  }, [visible]);

  function prune() {
    if (!confirm("Hapus catatan error yang lebih tua dari 30 hari?")) return;
    start(async () => {
      const res = await pruneErrorsAction(30);
      if (res.ok) toast.success(`${res.count} catatan error dihapus`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterMultiSelect
          label="Sumber" allLabel="Semua sumber" unit="sumber"
          options={["client", "boundary", "server"].map((k) => ({
            value: k,
            label: KIND_LABEL[k],
            count: errors.filter((e) => e.kind === k).length,
          }))}
          picked={kinds} onChange={setKinds}
        />
        <Button
          variant={showResolved ? "default" : "outline"}
          size="sm"
          onClick={() => setShowResolved((v) => !v)}
        >
          <Check className="size-4" /> Tampilkan yang sudah ditangani
        </Button>
        <Button variant="outline" size="sm" className="ml-auto" onClick={prune} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Pangkas 30 hari
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Check />}
          title="Tidak ada error"
          description={
            showResolved
              ? "Belum ada error yang tercatat."
              : "Tidak ada error yang belum ditangani. Semua yang masuk akan muncul di sini otomatis."
          }
        />
      ) : (
        <div className="space-y-1.5">
          {groups.map((group) => <ErrorGroup key={group[0].message} group={group} />)}
        </div>
      )}
    </div>
  );
}

function ErrorGroup({ group }: { group: ErrorEntry[] }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const latest = group[0];
  const people = new Set(group.map((e) => e.user_email).filter(Boolean));
  const paths = new Set(group.map((e) => e.path).filter(Boolean));
  const allResolved = group.every((e) => e.resolved);

  function toggleResolved() {
    start(async () => {
      // Resolving the group means resolving every occurrence: one message is
      // one bug, and leaving the older copies "open" would keep the badge lit
      // for something already fixed.
      for (const e of group) {
        if (e.resolved === !allResolved) continue;
        const res = await resolveErrorAction(e.id, !allResolved);
        if (!res.ok) { toast.error(res.error); return; }
      }
      toast.success(allResolved ? "Ditandai belum ditangani" : "Ditandai sudah ditangani");
    });
  }

  function remove() {
    start(async () => {
      for (const e of group) {
        const res = await deleteErrorAction(e.id);
        if (!res.ok) { toast.error(res.error); return; }
      }
      toast.success("Catatan error dihapus");
    });
  }

  return (
    <Card className={cn("overflow-hidden p-0", allResolved && "opacity-60")}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", allResolved ? "text-muted-foreground" : "text-danger")} />
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="break-words text-sm font-medium">{latest.message}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="px-1 py-0 text-[10px]">{KIND_LABEL[latest.kind] ?? latest.kind}</Badge>
            <span>{group.length}x</span>
            <time dateTime={latest.at} title={full(latest.at)}>{ago(latest.at)}</time>
            {people.size > 0 && <span>{people.size} akun</span>}
            {paths.size > 0 && <code className="font-mono">{[...paths].slice(0, 2).join(", ")}</code>}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={toggleResolved} disabled={pending} title={allResolved ? "Buka lagi" : "Tandai sudah ditangani"}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : allResolved ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={remove} disabled={pending} title="Hapus">
            <Trash2 className="size-4 text-danger" />
          </Button>
          <button type="button" onClick={() => setOpen((v) => !v)} className="p-1 text-muted-foreground">
            <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border bg-muted/30 px-3 py-2.5">
          {group.slice(0, 10).map((e) => (
            <div key={e.id} className="space-y-1">
              <p className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                <span>{full(e.at)}</span>
                <span>{e.user_email || "(tanpa email)"}</span>
                {e.path && <code className="font-mono">{e.path}</code>}
              </p>
              {e.user_agent && (
                <p className="truncate font-mono text-[10px] text-muted-foreground/80">{e.user_agent}</p>
              )}
              {e.stack && (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 font-mono text-[10px] leading-relaxed">
                  {e.stack}
                </pre>
              )}
            </div>
          ))}
          {group.length > 10 && (
            <p className="text-[11px] text-muted-foreground">…dan {group.length - 10} kejadian lain.</p>
          )}
        </div>
      )}
    </Card>
  );
}
