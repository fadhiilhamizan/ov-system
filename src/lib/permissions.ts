import type { AppUser, Task } from "./types";
import { MODULE_ACCESS } from "./constants";

/** Does the user match the PIC string of a task (by name or nickname)? */
export function isAssignedTo(user: AppUser, task: Task): boolean {
  const pic = (task.pic ?? "").toLowerCase();
  const name = user.name.toLowerCase().replace(/\(.*?\)/g, "").trim();
  const first = name.split(/\s+/)[0] ?? "";
  return (first.length > 1 && pic.includes(first)) || (!!user.division && task.division === user.division);
}

// Permission model derived from the access matrix.
export const can = {
  // --- structural (Admin only) ---
  manageEvents(user: AppUser): boolean {
    return user.role === "admin";
  },
  manageDivisions(user: AppUser): boolean {
    return user.role === "admin";
  },
  manageMembers(user: AppUser): boolean {
    return user.role === "admin";
  },
  manageFaq(user: AppUser): boolean {
    return user.role === "admin";
  },
  manageBackups(user: AppUser): boolean {
    return user.role === "admin";
  },

  // --- Admin + Koordinator ---
  manageTeams(user: AppUser): boolean {
    return user.role === "admin" || user.role === "coordinator";
  },
  manageRundown(user: AppUser): boolean {
    return user.role === "admin" || user.role === "coordinator";
  },
  manageJobs(user: AppUser): boolean {
    return user.role === "admin" || user.role === "coordinator";
  },
  manageBudget(user: AppUser): boolean {
    return user.role === "admin" || user.role === "coordinator";
  },
  /** Delete/edit an existing Super Link entry. */
  manageLinks(user: AppUser): boolean {
    return user.role === "admin" || user.role === "coordinator";
  },

  /** Create / edit tasks. Koordinator limited to own division. */
  manageTasks(user: AppUser, division?: string): boolean {
    if (user.role === "admin") return true;
    if (user.role === "coordinator") return !division || division === user.division;
    return false;
  },
  editTask(user: AppUser, task: Task): boolean {
    if (user.role === "admin") return true;
    if (user.role === "coordinator") return task.division === user.division;
    return false;
  },

  // --- includes Staff / Intern ---
  /** Update Status & fill Result (per matrix, includes staff & intern on their tasks). */
  editTaskProgress(user: AppUser, task: Task): boolean {
    if (user.role === "admin" || user.role === "coordinator") return true;
    if (user.role === "staff" || user.role === "intern") return isAssignedTo(user, task);
    return false;
  },
  /** Add a link to Super Link (staff & intern allowed). */
  createLink(user: AppUser): boolean {
    return user.role === "admin" || user.role === "coordinator" || user.role === "staff" || user.role === "intern";
  },
  /** Reach & Offer (prospect DB) create/edit. */
  manageProspects(user: AppUser): boolean {
    return user.role === "admin" || user.role === "coordinator" || user.role === "staff";
  },

  // --- helpers ---
  accessModule(user: AppUser, moduleKey: string): boolean {
    const roles = MODULE_ACCESS[moduleKey];
    return roles ? roles.includes(user.role) : true;
  },
  isReadOnly(user: AppUser): boolean {
    return user.role === "guest";
  },
};
