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
 */
interface TaskLinkCtx {
  links: Record<string, TaskLink[]>;
  refs: Record<string, TaskRef[]>;
  superLink: LinkItem[];
}

const Ctx = React.createContext<TaskLinkCtx>({ links: {}, refs: {}, superLink: [] });

export function TaskLinksProvider({
  value,
  refs = {},
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

/** Reference links for one task. */
export function useTaskRefs(taskId?: string): TaskRef[] {
  const { refs } = React.useContext(Ctx);
  return (taskId ? refs[taskId] : undefined) ?? [];
}

/** The whole Super Link directory, for the reference picker. */
export function useSuperLinks(): LinkItem[] {
  return React.useContext(Ctx).superLink;
}
