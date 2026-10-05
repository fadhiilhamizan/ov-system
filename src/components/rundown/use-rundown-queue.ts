"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  createRundownAction, deleteRundownAction, bulkDeleteRundownAction, duplicateRundownAction,
  saveRundownChangesAction,
} from "@/lib/actions/schedule";
import { checkMove, planMove, planRemoval, type MoveCheck } from "@/lib/rundown-reorder";
import { useT } from "@/lib/i18n/provider";
import { uuidV4 } from "@/lib/utils";
import type { RundownItem } from "@/lib/types";

// ============================================================
// Local-first editing for the rundown table.
//
// The table used to save every cell the moment it lost focus, and every save
// was a server round trip that ended in a revalidation of the whole page. Tab
// through five cells and that was five sequential round trips, a spinner that
// never settled, and inputs that could be reset under the caret when a late
// response arrived. "Tambah baris" and the merge buttons were worse: nothing
// happened on screen until the server had answered.
//
// Now an edit lands in local state first and is visible immediately. Changes
// wait in a queue and are flushed as ONE batch once the person pauses
// (FLUSH_DELAY), when the tab is hidden, or when the page is left. New rows
// get a client-generated uuid so they can be shown - and edited - before the
// insert returns. Every write goes through a single promise chain, so a row's
// edits can never overtake the insert that creates it.
//
// The overlay is pruned when the server copy catches up: an acknowledged value
// is dropped on the next `items` change (a revalidation), an unacknowledged one
// keeps winning over whatever the server says, and a failed one is reverted.
// ============================================================

/** Quiet time after the last edit before the queue is sent. */
export const FLUSH_DELAY = 1200;

type Fields = Partial<Omit<RundownItem, "id" | "division_jobs">>;
interface RowEdit {
  fields: Fields;
  jobs: Record<string, string>;
}
interface RowOverlay extends RowEdit {
  /** Keys ("f:activity", "j:LO") the server has confirmed. */
  acked: string[];
}
type Overlay = Record<string, RowOverlay>;

export type QueueStatus = "idle" | "pending" | "saved" | "error";

const same = (a: unknown, b: unknown) =>
  Object.is(a, b) || (typeof a === "object" && JSON.stringify(a) === JSON.stringify(b));

function pruneAcked(o: Overlay): Overlay {
  let changed = false;
  const next: Overlay = {};
  for (const [id, row] of Object.entries(o)) {
    if (!row.acked.length) { next[id] = row; continue; }
    changed = true;
    const fields = { ...row.fields } as Record<string, unknown>;
    const jobs = { ...row.jobs };
    for (const k of row.acked) {
      if (k.startsWith("f:")) delete fields[k.slice(2)];
      else delete jobs[k.slice(2)];
    }
    if (Object.keys(fields).length || Object.keys(jobs).length) {
      next[id] = { fields: fields as Fields, jobs, acked: [] };
    }
  }
  return changed ? next : o;
}

function apply(row: RundownItem, o?: RowOverlay): RundownItem {
  if (!o) return row;
  return {
    ...row,
    ...o.fields,
    division_jobs: Object.keys(o.jobs).length ? { ...row.division_jobs, ...o.jobs } : row.division_jobs,
  };
}

export function useRundownQueue(items: RundownItem[], eventId: string) {
  const t = useT();
  const [overlay, setOverlay] = React.useState<Overlay>({});
  const [added, setAdded] = React.useState<RundownItem[]>([]);
  const [removed, setRemoved] = React.useState<Set<string>>(() => new Set());
  const [status, setStatus] = React.useState<QueueStatus>("idle");

  const queue = React.useRef(new Map<string, RowEdit>());
  const chain = React.useRef<Promise<void>>(Promise.resolve());
  const inflight = React.useRef(0);
  const failed = React.useRef(false);
  const flushTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // A revalidation brought a fresh server copy: confirmed values can go.
  const [prevItems, setPrevItems] = React.useState(items);
  if (prevItems !== items) {
    setPrevItems(items);
    setOverlay(pruneAcked);
  }

  const settleStatus = React.useCallback(() => {
    if (queue.current.size || inflight.current) { setStatus("pending"); return; }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (failed.current) {
      failed.current = false;
      setStatus("error");
      idleTimer.current = setTimeout(() => setStatus("idle"), 3500);
    } else {
      setStatus("saved");
      idleTimer.current = setTimeout(() => setStatus("idle"), 2000);
    }
  }, []);

  /** Run a write after every write queued before it. */
  const enqueue = React.useCallback((fn: () => Promise<void>) => {
    inflight.current++;
    setStatus("pending");
    chain.current = chain.current
      .then(fn)
      .catch(() => {
        failed.current = true;
        toast.error(t("Gagal menyimpan. Periksa koneksi internet lalu coba lagi."));
      })
      .finally(() => {
        inflight.current--;
        settleStatus();
      });
  }, [settleStatus, t]);

  const flush = React.useCallback(() => {
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    if (!queue.current.size) return;
    const batch = [...queue.current.entries()].map(([id, e]) => ({
      id,
      patch: {
        ...e.fields,
        ...(Object.keys(e.jobs).length ? { division_jobs: e.jobs } : {}),
      } as Partial<RundownItem>,
    }));
    queue.current = new Map();

    /** Mark what was sent as confirmed (ok) or roll it back (failed) - but only
     *  where the value is still the one sent: a newer edit stays pending. */
    const settle = (ok: boolean) =>
      setOverlay((o) => {
        const next = { ...o };
        for (const { id, patch } of batch) {
          const row = next[id];
          if (!row) continue;
          const fields = { ...row.fields } as Record<string, unknown>;
          const jobs = { ...row.jobs };
          const acked = new Set(row.acked);
          const { division_jobs, ...sentFields } = patch;
          for (const [k, v] of Object.entries(sentFields)) {
            if (!same(fields[k], v)) continue;
            if (ok) acked.add(`f:${k}`); else delete fields[k];
          }
          for (const [k, v] of Object.entries(division_jobs ?? {})) {
            if (jobs[k] !== v) continue;
            if (ok) acked.add(`j:${k}`); else delete jobs[k];
          }
          next[id] = { fields: fields as Fields, jobs, acked: [...acked] };
        }
        return next;
      });

    enqueue(async () => {
      let res: { ok: boolean; error?: string };
      try {
        res = await saveRundownChangesAction(batch);
      } catch (e) {
        settle(false);
        throw e;
      }
      if (!res.ok) {
        failed.current = true;
        toast.error(res.error);
      }
      settle(res.ok);
    });
  }, [enqueue]);

  /** Record an edit locally and schedule the batch. */
  const edit = React.useCallback((id: string, fields: Fields, jobs?: Record<string, string>) => {
    setOverlay((o) => {
      const cur = o[id] ?? { fields: {}, jobs: {}, acked: [] };
      const touched = new Set([
        ...Object.keys(fields).map((k) => `f:${k}`),
        ...Object.keys(jobs ?? {}).map((k) => `j:${k}`),
      ]);
      return {
        ...o,
        [id]: {
          fields: { ...cur.fields, ...fields },
          jobs: { ...cur.jobs, ...jobs },
          acked: cur.acked.filter((k) => !touched.has(k)),
        },
      };
    });
    const q = queue.current.get(id) ?? { fields: {}, jobs: {} };
    queue.current.set(id, { fields: { ...q.fields, ...fields }, jobs: { ...q.jobs, ...jobs } });
    setStatus("pending");
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, FLUSH_DELAY);
  }, [flush]);

  // Leaving or hiding the tab sends whatever is waiting; closing it with
  // writes still outstanding asks first.
  React.useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!queue.current.size && !inflight.current) return;
      flush();
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [flush]);

  // Navigating to another menu unmounts the table: send what is left.
  React.useEffect(() => () => {
    flush();
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, [flush]);

  const list = React.useMemo(() => {
    const known = new Set(items.map((i) => i.id));
    return [...items, ...added.filter((a) => !known.has(a.id))]
      .filter((r) => !removed.has(r.id))
      .map((r) => apply(r, overlay[r.id]))
      .sort((a, b) => a.no - b.no);
  }, [items, added, removed, overlay]);

  const nextNo = () => list.reduce((m, r) => Math.max(m, r.no), 0) + 1;

  function addRow() {
    const id = uuidV4();
    // New activity starts where the last one ended (chain the schedule).
    const prevEnd = list.length ? list[list.length - 1].time_end : "";
    setAdded((a) => [...a, {
      id, event_id: eventId, variant: "A", no: nextNo(),
      time_start: prevEnd, time_end: "", duration: "", activity: "", keterangan: "",
      mc: "", operator: "", division_jobs: {}, merges: {},
    }]);
    enqueue(async () => {
      const res = await createRundownAction({ activity: "", time_start: prevEnd }, id);
      if (!res.ok) {
        failed.current = true;
        toast.error(res.error);
        setAdded((a) => a.filter((r) => r.id !== id));
      }
    });
  }

  function duplicate(sourceId: string) {
    const src = list.find((r) => r.id === sourceId);
    if (!src) return;
    // The server copies the STORED row, so anything still waiting goes first.
    flush();
    const id = uuidV4();
    setAdded((a) => [...a, { ...src, id, no: nextNo(), merges: {} }]);
    enqueue(async () => {
      const res = await duplicateRundownAction(sourceId, id);
      if (res.ok) toast.success(t("Agenda diduplikat"));
      else {
        failed.current = true;
        toast.error(res.error);
        setAdded((a) => a.filter((r) => r.id !== id));
      }
    });
  }

  /**
   * Remove one or several rows. A merged run that loses rows is shrunk first
   * (and handed to the next row when its top row goes), and those fixes are
   * sent BEFORE the delete, on the same chain, so the run never swallows the
   * row that slides up into the gap. See planRemoval.
   */
  function remove(ids: string | string[]) {
    const gone = Array.isArray(ids) ? ids : [ids];
    if (!gone.length) return;
    const goneSet = new Set(gone);
    for (const id of gone) queue.current.delete(id);
    for (const p of planRemoval(list, goneSet)) {
      edit(p.id, { ...p.fields, merges: p.merges }, Object.keys(p.jobs).length ? p.jobs : undefined);
    }
    flush();
    setRemoved((s) => { const n = new Set(s); for (const id of gone) n.add(id); return n; });
    enqueue(async () => {
      const res = gone.length === 1 ? await deleteRundownAction(gone[0]) : await bulkDeleteRundownAction(gone);
      if (res.ok) toast.success(gone.length === 1 ? t("Agenda dihapus") : `${gone.length} ${t("agenda dihapus")}`);
      else {
        failed.current = true;
        toast.error(res.error);
        setRemoved((s) => { const n = new Set(s); for (const id of gone) n.delete(id); return n; });
      }
    });
  }

  /**
   * Drag a row to where another row is. Renumbers the list and re-times the
   * stretch between the two places (see planMove), shows it at once and sends
   * it straight away: a drop is one deliberate action, not typing.
   * Returns why a move was refused, so the table can say so.
   */
  function move(activeId: string, overId: string): MoveCheck {
    const from = list.findIndex((r) => r.id === activeId);
    const to = list.findIndex((r) => r.id === overId);
    const check = checkMove(list, from, to);
    if (check !== "ok") return check;
    for (const p of planMove(list, from, to)) edit(p.id, p.fields);
    flush();
    return "ok";
  }

  return { list, status, edit, flush, addRow, duplicate, remove, move };
}
