import type { AppUser, Task } from "./types";
import { ACCESS_RANK, MODULE_ACCESS, MODULE_ACCESS_LEVEL, type AccessLevel } from "./constants";

/** Does the user match the PIC string of a task (by name or nickname)? */
export function isAssignedTo(user: AppUser, task: Task): boolean {
  const pic = (task.pic ?? "").toLowerCase();
  const name = user.name.toLowerCase().replace(/\(.*?\)/g, "").trim();
  const first = name.split(/\s+/)[0] ?? "";
  return (first.length > 1 && pic.includes(first)) || (!!user.division && task.division === user.division);
}

/** The user's access level for a module key (see MODULE_ACCESS_LEVEL). */
export function accessLevel(user: AppUser, moduleKey: string): AccessLevel {
  return MODULE_ACCESS_LEVEL[moduleKey]?.[user.role] ?? "none";
}

/** Does the user hold at least `level` on `moduleKey`? */
export function atLeast(user: AppUser, moduleKey: string, level: AccessLevel): boolean {
  return ACCESS_RANK[accessLevel(user, moduleKey)] >= ACCESS_RANK[level];
}

/** Non-admins with a division are confined to it; an unscoped profile isn't. */
function inScope(user: AppUser, division?: string): boolean {
  if (user.role === "admin") return true;
  return !division || !user.division || division === user.division;
}

// Permission model derived from the access matrix in constants.ts. Every helper
// reads MODULE_ACCESS_LEVEL so the settings matrix and the real rules can never
// drift apart: "full" adds delete on top of what "limited" allows.
export const can = {
  // --- structural (module level "full") ---
  manageEvents(user: AppUser): boolean {
    return atLeast(user, "events", "full");
  },
  manageDivisions(user: AppUser): boolean {
    return atLeast(user, "divisions", "full");
  },
  manageMembers(user: AppUser): boolean {
    return atLeast(user, "members", "full");
  },
  manageTeams(user: AppUser): boolean {
    return atLeast(user, "members", "full");
  },
  manageFaq(user: AppUser): boolean {
    return atLeast(user, "faq", "full");
  },
  manageBackups(user: AppUser): boolean {
    return atLeast(user, "settings", "full");
  },
  manageBudget(user: AppUser): boolean {
    return atLeast(user, "budget", "full");
  },
  /** Approve / ignore role requests (Role Request menu). */
  manageRoleRequests(user: AppUser): boolean {
    return atLeast(user, "roles", "full");
  },

  // --- rundown / Hari-H: "limited" writes, "full" deletes ---
  manageRundown(user: AppUser): boolean {
    return atLeast(user, "rundown", "limited");
  },
  deleteRundown(user: AppUser): boolean {
    return atLeast(user, "rundown", "full");
  },
  manageJobs(user: AppUser): boolean {
    return atLeast(user, "jobs", "limited");
  },
  deleteJob(user: AppUser): boolean {
    return atLeast(user, "jobs", "full");
  },

  // --- Super Link ---
  /** Add a link to Super Link. */
  createLink(user: AppUser): boolean {
    return atLeast(user, "links", "limited");
  },
  /** Edit an existing Super Link entry. */
  manageLinks(user: AppUser): boolean {
    return atLeast(user, "links", "limited");
  },
  deleteLink(user: AppUser): boolean {
    return atLeast(user, "links", "full");
  },

  /** Reach & Offer (prospect DB) create/edit. */
  manageProspects(user: AppUser): boolean {
    return atLeast(user, "prospects", "limited");
  },
  deleteProspect(user: AppUser): boolean {
    return atLeast(user, "prospects", "full");
  },

  // --- Work Breakdown ---
  /** Create / edit tasks. Scoped roles are limited to their own division. */
  manageTasks(user: AppUser, division?: string): boolean {
    return atLeast(user, "tasks", "limited") && inScope(user, division);
  },
  editTask(user: AppUser, task: Task): boolean {
    return can.manageTasks(user, task.division);
  },
  /** Delete a task — only "full" access (admin & koordinator). */
  deleteTask(user: AppUser, division?: string): boolean {
    return atLeast(user, "tasks", "full") && inScope(user, division);
  },
  /** Update Status & fill Result — also allowed on tasks assigned to the user. */
  editTaskProgress(user: AppUser, task: Task): boolean {
    if (can.manageTasks(user, task.division)) return true;
    return atLeast(user, "tasks", "limited") && isAssignedTo(user, task);
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
