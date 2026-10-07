"use client";
import { withOneRetry, isStaleBuildError } from "./stale-build";
import * as React from "react";
import { toast } from "sonner";

// ============================================================
// Local-first writes for any list of rows.
//
// The rundown table showed what this is worth: a change appears the moment it
// is made, the save happens in the background, and nothing on screen waits
// for the server. This is that behaviour for every other list, in one place:
//
//   const store = useLocalFirst(tasks);
//   store.patch(task.id, { status: "done" }, () => setTaskStatusAction(task.id, "done"));
//
// The rows the page renders are `store.rows`: the server's rows with every
// unconfirmed change laid over them (edited fields, removed rows, added rows,
// a new order). Each write is queued on ONE promise chain, so two quick
// changes to the same row reach the server in the order they were made, and
// an edit to a new row can never overtake the insert that creates it (new
// rows get a client uuid for exactly that reason, see `uuidV4`).
//
// When a write FAILS, only that change is rolled back (a newer change to the
// same field is left alone) and the error is shown as a toast. When it
// SUCCEEDS, the change is marked confirmed and dropped the next time the
// server's rows arrive (the revalidation the action triggers), so the overlay
// never outlives its purpose and never hides someone else's later edit.
// ============================================================

export type SaveResult = { ok: boolean; error?: string };
export type Save<R extends SaveResult = SaveResult> = () => Promise<R>;
export type LocalStatus = "idle" | "pending" | "saved" | "error";

interface WriteOpts<R extends SaveResult> {
  /** Toast shown when the server confirms (omit for silent inline edits). */
  success?: string | ((r: R) => string | null);
  /** Extra handling of the result (e.g. a "skipped" count). */
  onResult?: (r: R) => void;
}

interface Patch<T> {
  fields: Partial<T>;
  /** Token of the latest write per field: a stale reply must not undo a newer edit. */
  tokens: Record<string, number>;
  acked: string[];
}

type Track = "pending" | "acked";

export interface RowChange<T> {
  id: string;
  fields: Partial<T>;
}

export interface LocalFirst<T extends { id: string }> {
  /** Server rows with every unconfirmed change applied. */
  rows: T[];
  status: LocalStatus;
  /** True while any write is still on its way. */
  busy: boolean;
  patch<R extends SaveResult>(id: string, fields: Partial<T>, save: Save<R>, opts?: WriteOpts<R>): Promise<boolean>;
  patchMany<R extends SaveResult>(ids: string[], fields: Partial<T>, save: Save<R>, opts?: WriteOpts<R>): Promise<boolean>;
  remove<R extends SaveResult>(ids: string[], save: Save<R>, opts?: WriteOpts<R>): Promise<boolean>;
  /** Show a new row now. `after` places it below an existing row. */
  add<R extends SaveResult>(row: T, save: Save<R>, opts?: WriteOpts<R> & { after?: string }): Promise<boolean>;
  /** Show a new order now (ids in the new order; missing ids keep their place at the end). */
  /** Different fields on different rows, as ONE write (e.g. moving the
   *  "main plan" star: one row on, the others off). */
  change<R extends SaveResult>(changes: RowChange<T>[], save: Save<R>, opts?: WriteOpts<R>): Promise<boolean>;
  /** Show a new order now (ids in the new order; missing ids keep their place
   *  at the end). `changes` are field edits that belong to the same write,
   *  e.g. the category of a budget item dragged into another category. */
  reorder<R extends SaveResult>(
    ids: string[], save: Save<R>, opts?: WriteOpts<R> & { changes?: RowChange<T>[] },
  ): Promise<boolean>;
  /** Queue a write with no local change of its own, keeping the order of writes. */
  run<R extends SaveResult>(save: Save<R>, opts?: WriteOpts<R>): Promise<R | null>;
}

/** Whether a queued write succeeded. */
const toOk = (p: Promise<SaveResult | null>) => p.then((r) => !!r?.ok);

/** Two rows with the same top-level values (a row rebuilt by a spread). */
function sameRow(x: unknown, y: unknown): boolean {
  if (x === y) return true;
  if (!x || !y || typeof x !== "object" || typeof y !== "object") return false;
  const kx = Object.keys(x), ky = Object.keys(y);
  return kx.length === ky.length &&
    kx.every((k) => (x as Record<string, unknown>)[k] === (y as Record<string, unknown>)[k]);
}

/** Same rows in the same order: identical objects, or shallow-equal ones. */
function sameRows<T>(a: T[], b: T[]): boolean {
  return a === b || (a.length === b.length && a.every((x, i) => sameRow(x, b[i])));
}

const NETWORK_ERROR = "Gagal menyimpan. Periksa koneksi internet lalu coba lagi.";

export function useLocalFirst<T extends { id: string }>(serverRows: T[]): LocalFirst<T> {
  const [overlay, setOverlay] = React.useState<Record<string, Patch<T>>>({});
  const [removed, setRemoved] = React.useState<Record<string, Track>>({});
  const [added, setAdded] = React.useState<{ row: T; after?: string; track: Track }[]>([]);
  const [order, setOrder] = React.useState<{ ids: string[]; track: Track } | null>(null);
  const [status, setStatus] = React.useState<LocalStatus>("idle");
  const [inflight, setInflight] = React.useState(0);

  const chain = React.useRef<Promise<unknown>>(Promise.resolve());
  const seq = React.useRef(0);
  const count = React.useRef(0);
  const failed = React.useRef(false);
  const idle = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fresh server rows: everything the server has confirmed can go.
  const [prev, setPrev] = React.useState(serverRows);
  // Compared row by row, not by array: a caller that filters or maps its rows
  // inline hands over a new array on every render, and treating that as "the
  // server sent something new" would re-render forever.
  if (!sameRows(prev, serverRows)) {
    setPrev(serverRows);
    const present = new Set(serverRows.map((r) => r.id));
    setOverlay((o) => {
      let changed = false;
      const next: Record<string, Patch<T>> = {};
      for (const [id, p] of Object.entries(o)) {
        if (!p.acked.length) { next[id] = p; continue; }
        changed = true;
        const fields = { ...p.fields } as Record<string, unknown>;
        const tokens = { ...p.tokens };
        for (const k of p.acked) { delete fields[k]; delete tokens[k]; }
        if (Object.keys(fields).length) next[id] = { fields: fields as Partial<T>, tokens, acked: [] };
      }
      return changed ? next : o;
    });
    setRemoved((r) => {
      const entries = Object.entries(r).filter(([id, s]) => s === "pending" || present.has(id));
      return entries.length === Object.keys(r).length ? r : Object.fromEntries(entries);
    });
    setAdded((a) => {
      const keep = a.filter((x) => !present.has(x.row.id));
      return keep.length === a.length ? a : keep;
    });
    setOrder((o) => (o?.track === "acked" ? null : o));
  }

  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (count.current > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (idle.current) clearTimeout(idle.current);
    };
  }, []);

  /** Queue one write; `settle(ok, result)` applies the local consequence. */
  const enqueue = React.useCallback(
    <R extends SaveResult>(save: Save<R>, settle: (ok: boolean) => void, opts?: WriteOpts<R>): Promise<R | null> => {
      count.current++;
      setInflight(count.current);
      setStatus("pending");
      const job = chain.current.then(async () => {
        let res: R | null = null;
        try {
          // A save that THROWS never reached a verdict (a network blip, a
          // cold function timing out): try once more before rolling back. An
          // outdated tab after a deploy is announced instead (stale-build.ts).
          res = await withOneRetry(save);
        } catch (e) {
          res = null;
          if (isStaleBuildError(e)) {
            settle(false);
            failed.current = true;
            return res;
          }
        }
        const ok = !!res?.ok;
        settle(ok);
        if (!ok) {
          failed.current = true;
          toast.error(res?.error || NETWORK_ERROR);
        } else if (res) {
          const msg = typeof opts?.success === "function" ? opts.success(res) : opts?.success;
          if (msg) toast.success(msg);
        }
        if (res) opts?.onResult?.(res);
        return res;
      });
      chain.current = job.catch(() => {});
      void job.finally(() => {
        count.current--;
        setInflight(count.current);
        if (count.current > 0) return;
        if (idle.current) clearTimeout(idle.current);
        const bad = failed.current;
        failed.current = false;
        setStatus(bad ? "error" : "saved");
        idle.current = setTimeout(() => setStatus("idle"), bad ? 3500 : 2000);
      });
      return job;
    },
    [],
  );

  /** Lay field edits over the rows under one token; returns the settle step. */
  const applyChanges = React.useCallback((changes: RowChange<T>[]) => {
    const token = ++seq.current;
    setOverlay((o) => {
      const next = { ...o };
      for (const { id, fields } of changes) {
        const keys = Object.keys(fields);
        const cur = next[id] ?? { fields: {}, tokens: {}, acked: [] };
        const tokens = { ...cur.tokens };
        for (const k of keys) tokens[k] = token;
        next[id] = {
          fields: { ...cur.fields, ...fields },
          tokens,
          acked: cur.acked.filter((k) => !keys.includes(k)),
        };
      }
      return next;
    });
    // Confirm (ok) or roll back (failed) exactly what this write set, and only
    // where no newer write has since taken the same field.
    return (ok: boolean) => setOverlay((o) => {
      const next = { ...o };
      for (const { id, fields } of changes) {
        const cur = next[id];
        if (!cur) continue;
        const mine = Object.keys(fields).filter((k) => cur.tokens[k] === token);
        if (!mine.length) continue;
        if (ok) {
          next[id] = { ...cur, acked: [...new Set([...cur.acked, ...mine])] };
        } else {
          const f = { ...cur.fields } as Record<string, unknown>;
          const tk = { ...cur.tokens };
          for (const k of mine) { delete f[k]; delete tk[k]; }
          if (Object.keys(f).length) next[id] = { fields: f as Partial<T>, tokens: tk, acked: cur.acked.filter((k) => !mine.includes(k)) };
          else delete next[id];
        }
      }
      return next;
    });
  }, []);

  const change = React.useCallback(
    <R extends SaveResult>(changes: RowChange<T>[], save: Save<R>, opts?: WriteOpts<R>) => {
      const settle = applyChanges(changes);
      return toOk(enqueue(save, settle, opts));
    },
    [applyChanges, enqueue],
  );

  const patchMany = React.useCallback(
    <R extends SaveResult>(ids: string[], fields: Partial<T>, save: Save<R>, opts?: WriteOpts<R>) =>
      change(ids.map((id) => ({ id, fields })), save, opts),
    [change],
  );

  const patch = React.useCallback(
    <R extends SaveResult>(id: string, fields: Partial<T>, save: Save<R>, opts?: WriteOpts<R>) =>
      patchMany([id], fields, save, opts),
    [patchMany],
  );

  const remove = React.useCallback(
    <R extends SaveResult>(ids: string[], save: Save<R>, opts?: WriteOpts<R>) => {
      setRemoved((r) => ({ ...r, ...Object.fromEntries(ids.map((id) => [id, "pending" as Track])) }));
      // A row added locally and removed before its insert returned: the
      // insert still runs first (same chain), then this delete.
      return toOk(enqueue(save, (ok) => {
        setRemoved((r) => {
          const next = { ...r };
          for (const id of ids) {
            if (ok) next[id] = "acked";
            else delete next[id];
          }
          return next;
        });
        if (ok) setAdded((a) => a.filter((x) => !ids.includes(x.row.id)));
      }, opts));
    },
    [enqueue],
  );

  const add = React.useCallback(
    <R extends SaveResult>(row: T, save: Save<R>, opts?: WriteOpts<R> & { after?: string }) => {
      setAdded((a) => [...a, { row, after: opts?.after, track: "pending" }]);
      return toOk(enqueue(save, (ok) => {
        setAdded((a) => (ok
          ? a.map((x) => (x.row.id === row.id ? { ...x, track: "acked" as Track } : x))
          : a.filter((x) => x.row.id !== row.id)));
      }, opts));
    },
    [enqueue],
  );

  const reorder = React.useCallback(
    <R extends SaveResult>(ids: string[], save: Save<R>, opts?: WriteOpts<R> & { changes?: RowChange<T>[] }) => {
      setOrder({ ids, track: "pending" });
      const settleFields = opts?.changes?.length ? applyChanges(opts.changes) : null;
      return toOk(enqueue(save, (ok) => {
        settleFields?.(ok);
        // Only the latest reorder decides: a reply for an older one finds a
        // different array in state and leaves it alone.
        setOrder((o) => (o && o.ids === ids ? (ok ? { ids, track: "acked" } : null) : o));
      }, opts));
    },
    [applyChanges, enqueue],
  );

  const run = React.useCallback(
    <R extends SaveResult>(save: Save<R>, opts?: WriteOpts<R>) => enqueue(save, () => {}, opts),
    [enqueue],
  );

  const rows = React.useMemo(() => {
    const present = new Set(serverRows.map((r) => r.id));
    let list: T[] = serverRows.filter((r) => !removed[r.id]);
    for (const a of added) {
      if (present.has(a.row.id) || removed[a.row.id]) continue;
      const at = a.after ? list.findIndex((r) => r.id === a.after) : -1;
      if (at >= 0) list = [...list.slice(0, at + 1), a.row, ...list.slice(at + 1)];
      else list = [...list, a.row];
    }
    list = list.map((r) => (overlay[r.id] ? { ...r, ...overlay[r.id].fields } : r));
    if (order) {
      const pos = new Map(order.ids.map((id, i) => [id, i]));
      const last = order.ids.length;
      list = [...list].sort((a, b) => (pos.get(a.id) ?? last) - (pos.get(b.id) ?? last));
    }
    return list;
  }, [serverRows, overlay, removed, added, order]);

  return {
    rows, status, busy: inflight > 0,
    patch, patchMany, change, remove, add, reorder, run,
  };
}
