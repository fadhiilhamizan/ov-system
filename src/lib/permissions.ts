import { REQUESTABLE_ROLES, type AppUser, type OVEvent, type RequestableRole, type Task } from "./types";
import { ACCESS_RANK, MODULE_ACCESS, MODULE_ACCESS_LEVEL, type AccessLevel } from "./constants";

/**
 * Which roles this account may ask an admin for.
 *
 * - Admins get nothing: admin is granted out of band, and an existing admin
 *   must not be able to demote themselves through this flow.
 * - Anonymous "Tamu" sessions (no email) have no account to promote.
 * - Everyone else may request any requestable role EXCEPT the one they already
 *   hold - so a role-less account upgrades, and a staff member can move to
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

/**
 * Does the user's name appear in a task's free-text PIC field?
 *
 * Presentational only - it highlights "your" tasks and must never gate a write.
 * `pic` is a comma-joined display string ("Fadhiil, Dona"), so we match the
 * user's first name as a WHOLE WORD inside it, splitting on both commas and
 * spaces. A substring check used to make "Ali" light up every task assigned to
 * "Alifia"; whole-word matching fixes that. There is no division fallback - an
 * account has no division (see AppUser).
 */
export function isAssignedTo(user: AppUser, task: Task): boolean {
  const name = user.name.toLowerCase().replace(/\(.*?\)/g, "").trim();
  const first = name.split(/\s+/)[0] ?? "";
  if (first.length < 2) return false;
  const picWords = (task.pic ?? "").toLowerCase().split(/[\s,]+/).filter(Boolean);
  return picWords.includes(first);
}

/**
 * May this user change anything belonging to `event`?
 *
 * An archived (locked) Ormawa Visit is read-only for every role except admin,
 * who can still correct it and unlock it. Mirrors `writable_event()` in
 * migration 0028 - that policy is the real control, this is the UX half.
 * A missing event is treated as writable so unscoped legacy rows keep working.
 */
export function canWriteEvent(user: AppUser, event?: Pick<OVEvent, "locked"> | null): boolean {
  if (user.role === "admin") return true;
  return !event?.locked;
}

/** Only an admin may archive an Ormawa Visit or take it out of the archive. */
export function canToggleLock(user: AppUser): boolean {
  return user.role === "admin";
}

/**
 * Narrow an identity to what it may actually do inside `event`.
 *
 * Inside an archived Ormawa Visit every role except admin is read-only. Task,
 * calendar and division views derive all their rights from `can.*(user)` deep in
 * the tree, so handing them an attenuated identity turns the whole surface
 * read-only without threading a `locked` flag through every component.
 *
 * Gating only - never use the result to DISPLAY someone's role: the returned
 * role is deliberately not their real one.
 */
export function attenuate(user: AppUser, event?: Pick<OVEvent, "locked"> | null): AppUser {
  return canWriteEvent(user, event) ? user : { ...user, role: "guest" };
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
  // edit only *some* tasks - the access matrix is the sole authority.
  /** Create / edit tasks. */
  manageTasks(user: AppUser): boolean {
    return atLeast(user, "tasks", "limited");
  },
  editTask(user: AppUser): boolean {
    return can.manageTasks(user);
  },
  /** Delete a task - only "full" access (admin & koordinator). */
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
