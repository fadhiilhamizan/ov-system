import { REQUESTABLE_ROLES, type AppUser, type RequestableRole, type Task } from "./types";
import { ACCESS_RANK, MODULE_ACCESS, MODULE_ACCESS_LEVEL, type AccessLevel } from "./constants";

/**
 * Which roles this account may ask an admin for.
 *
 * - Admins get nothing: admin is granted out of band, and an existing admin
 *   must not be able to demote themselves through this flow.
 * - Anonymous "Tamu" sessions (no email) have no account to promote.
 * - Everyone else may request any requestable role EXCEPT the one they already
 *   hold — so a role-less account upgrades, and a staff member can move to
 *   coordinator or down to intern.
 */
export function requestableRolesFor(user: AppUser): RequestableRole[] {
  if (user.role === "admin" || !user.email) return [];
  return REQUESTABLE_ROLES.filter((r) => r !== user.role);
}

/** Can this account use the role-request flow at all? */
export function canRequestRole(user: AppUser): boolean {
  return requestableRolesFor(user).length > 0;
}

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
  // NOTE: task rights are NOT scoped to the user's division. An earlier cut
  // confined non-admins to `profiles.division`, which made staff/intern able to
  // edit only *some* tasks — the access matrix is the sole authority.
  /** Create / edit tasks. */
  manageTasks(user: AppUser): boolean {
    return atLeast(user, "tasks", "limited");
  },
  editTask(user: AppUser): boolean {
    return can.manageTasks(user);
  },
  /** Delete a task — only "full" access (admin & koordinator). */
  deleteTask(user: AppUser): boolean {
    return atLeast(user, "tasks", "full");
  },
  /** Update Status & fill Result. */
  editTaskProgress(user: AppUser): boolean {
    return atLeast(user, "tasks", "limited");
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
