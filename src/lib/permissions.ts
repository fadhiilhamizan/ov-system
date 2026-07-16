import type { AppUser, Task } from "./types";
import { MODULE_ACCESS } from "./constants";

const MANAGE_DIVISION = new Set(["admin", "coordinator"]);

/** Does the user match the PIC string of a task (by name or nickname)? */
export function isAssignedTo(user: AppUser, task: Task): boolean {
  const pic = task.pic.toLowerCase();
  const name = user.name.toLowerCase().replace(/\(.*?\)/g, "").trim();
  const first = name.split(/\s+/)[0] ?? "";
  return (first.length > 1 && pic.includes(first)) || (!!user.division && task.division === user.division);
}

export const can = {
  /** Full create/delete of tasks within scope. */
  manageTasks(user: AppUser, division?: string): boolean {
    if (user.role === "admin") return true;
    if (user.role === "coordinator") return !division || division === user.division;
    return false;
  },
  /** Edit any field of a task. */
  editTask(user: AppUser, task: Task): boolean {
    if (user.role === "admin") return true;
    if (user.role === "coordinator") return task.division === user.division;
    return false;
  },
  /** Edit only Result & Status (per OV spreadsheet rules). */
  editTaskProgress(user: AppUser, task: Task): boolean {
    if (user.role === "admin" || user.role === "coordinator") return true;
    if (user.role === "staff" || user.role === "intern") return isAssignedTo(user, task);
    return false;
  },
  manageProspects(user: AppUser): boolean {
    return MANAGE_DIVISION.has(user.role) || user.role === "staff";
  },
  manageLinks(user: AppUser): boolean {
    return user.role !== "viewer" && user.role !== "intern";
  },
  manageBudget(user: AppUser): boolean {
    return user.role === "admin" || user.role === "coordinator";
  },
  manageEvents(user: AppUser): boolean {
    return user.role === "admin";
  },
  accessModule(user: AppUser, moduleKey: string): boolean {
    const roles = MODULE_ACCESS[moduleKey];
    return roles ? roles.includes(user.role) : true;
  },
  isReadOnly(user: AppUser): boolean {
    return user.role === "viewer";
  },
};
