"use client";
import * as React from "react";
import type { LinkItem, TaskLink, TaskRef } from "@/lib/types";

/**
 * Per-page link data for tasks, provided once so the dialog and the table cells
 * don't each have to fetch.
 *
 * Three separate things, easy to confuse:
 *   links     - a task's RESULT links, published TO Super Link.
 *   refs      - a task's REFERENCES, pointing AT Super Link or anywhere else.
 *   superLink - the Super Link directory itself, used by the reference picker.
 *
 * `refs` is deliberately `undefined` when a page does not fetch it, NOT an
 * empty object. "This task has no references" and "this page never asked for
 * them" look identical to a reader, and the form treats the first as an
 * instruction to delete: Papan Divisi and Kalender mounted this provider
 * without refs, so every edit made there wiped the task's references that had
 * been added from Work Breakdown. Anything reading refs must handle the
 * undefined case rather than defaulting it away.
 */
interface TaskLinkCtx {
  links: Record<string, TaskLink[]>;
  refs?: Record<string, TaskRef[]>;
  superLink: LinkItem[];
}

const Ctx = React.createContext<TaskLinkCtx>({ links: {}, superLink: [] });

export function TaskLinksProvider({
  value,
  refs,
  superLink = [],
  children,
}: {
  value: Record<string, TaskLink[]>;
  refs?: Record<string, TaskRef[]>;
  superLink?: LinkItem[];
  children: React.ReactNode;
}) {
  const ctx = React.useMemo(
    () => ({ links: value, refs, superLink }),
    [value, refs, superLink],
  );
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

/** Result links for one task (empty array when the task is new or has none). */
export function useTaskLinks(taskId?: string): TaskLink[] {
  const { links } = React.useContext(Ctx);
  return (taskId ? links[taskId] : undefined) ?? [];
}

/**
 * Reference links for one task, or `undefined` when this page did not provide
 * any reference data at all. An empty array really does mean "no references".
 */
export function useTaskRefs(taskId?: string): TaskRef[] | undefined {
  const { refs } = React.useContext(Ctx);
  if (!refs) return undefined;
  return (taskId ? refs[taskId] : undefined) ?? [];
}

/** The whole Super Link directory, for the reference picker. */
export function useSuperLinks(): LinkItem[] {
  return React.useContext(Ctx).superLink;
}
