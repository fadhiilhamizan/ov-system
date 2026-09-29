"use client";
import * as React from "react";
import type { LocalFirst } from "@/lib/use-local-first";
import type { Task } from "@/lib/types";

/**
 * The Work Breakdown's local-first task list (see use-local-first.ts), shared
 * by the table, the kanban, the status pill, the row menu and the bulk bar so
 * a change made in any of them shows up in all of them at once.
 *
 * Null outside TasksView (the calendar's task dialog, for instance): those
 * callers fall back to waiting for the server, as before.
 */
export const TaskStoreContext = React.createContext<LocalFirst<Task> | null>(null);

export function useTaskStore() {
  return React.useContext(TaskStoreContext);
}
