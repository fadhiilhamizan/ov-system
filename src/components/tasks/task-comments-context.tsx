"use client";
import * as React from "react";
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
 */
const Ctx = React.createContext<Record<string, TaskComment[]> | undefined>(undefined);

export function TaskCommentsProvider({
  value,
  children,
}: {
  value?: Record<string, TaskComment[]>;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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
