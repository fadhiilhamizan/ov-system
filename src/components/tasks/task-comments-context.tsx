"use client";
import * as React from "react";
import { useLocalFirst, type LocalFirst } from "@/lib/use-local-first";
import type { TaskComment } from "@/lib/types";

/**
 * Per-page comment data for tasks, fetched once by the page and read by both
 * the notification badge in the table and the panel inside the edit dialog.
 *
 * `undefined` when a page did not fetch comments at all, NOT an empty object -
 * the same distinction `TaskLinksProvider` draws for references, and for the
 * same reason: "this task has no comments" and "this page never asked" look
 * identical to a reader, and the second one must not render a badge-less,
 * composer-less panel that suggests the conversation was lost. A page that
 * mounts the task dialog should provide this; one that does not simply hides
 * the whole feature.
 *
 * The comments are local-first (use-local-first.ts): a note you send, a reply,
 * a tick and a delete all show at once and save in the background, the way a
 * chat is expected to behave.
 */
const Ctx = React.createContext<Record<string, TaskComment[]> | undefined>(undefined);
const StoreCtx = React.createContext<LocalFirst<TaskComment> | null>(null);

export function TaskCommentsProvider({
  value,
  children,
}: {
  value?: Record<string, TaskComment[]>;
  children: React.ReactNode;
}) {
  const flat = React.useMemo(() => (value ? Object.values(value).flat() : []), [value]);
  const store = useLocalFirst(flat);
  const grouped = React.useMemo(() => {
    if (!value) return undefined;
    const map: Record<string, TaskComment[]> = {};
    for (const c of store.rows) (map[c.task_id] ??= []).push(c);
    return map;
  }, [value, store.rows]);
  return (
    <StoreCtx.Provider value={value ? store : null}>
      <Ctx.Provider value={grouped}>{children}</Ctx.Provider>
    </StoreCtx.Provider>
  );
}

/** The local-first comment list, or null outside a provider that has data. */
export function useTaskCommentStore(): LocalFirst<TaskComment> | null {
  return React.useContext(StoreCtx);
}

/**
 * Comments on one task, or `undefined` when this page provided none at all.
 * An empty array really does mean "no comments yet".
 */
export function useTaskComments(taskId?: string): TaskComment[] | undefined {
  const all = React.useContext(Ctx);
  if (!all) return undefined;
  return (taskId ? all[taskId] : undefined) ?? [];
}

/**
 * The whole map at once, for a caller that needs MANY tasks in one render.
 *
 * The task table flags every row that has an open thread, and it cannot use
 * `useTaskComments` to do it: the rows are produced by `.map()` over a list
 * whose length changes with the search and filters, so a hook called per row
 * would change in count between renders and break the rules of hooks. Reading
 * the map once at the top of the component sidesteps that entirely.
 */
export function useAllTaskComments(): Record<string, TaskComment[]> | undefined {
  return React.useContext(Ctx);
}
