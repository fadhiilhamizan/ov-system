"use client";
import * as React from "react";
import type { TaskLink } from "@/lib/types";

/** Result links for the current page's tasks, keyed by task id. Provided once
 *  per page so the task dialog and result cells don't each have to fetch. */
const Ctx = React.createContext<Record<string, TaskLink[]>>({});

export function TaskLinksProvider({
  value,
  children,
}: {
  value: Record<string, TaskLink[]>;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Links for one task (empty array when the task is new or has none). */
export function useTaskLinks(taskId?: string): TaskLink[] {
  const map = React.useContext(Ctx);
  return (taskId ? map[taskId] : undefined) ?? [];
}
