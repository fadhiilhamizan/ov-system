import { describe, it, expect } from "vitest";
import { accessLevel, atLeast, can, canRequestRole, isAssignedTo, requestableRolesFor } from "./permissions";
import type { AppUser, Task } from "./types";

function user(role: AppUser["role"], division: string | null = null): AppUser {
  return { id: role, name: "Test User", email: "", role, division };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    event_id: "e1",
    division: "EVENT",
    no: "1",
    pic: "",
    title: "Task",
    start_date: null,
    start_raw: "",
    end_date: null,
    end_raw: "",
    notes: "",
    result: "",
    status: "todo",
    ...over,
  };
}

describe("structural permissions (admin-only)", () => {
  const admin = user("admin");
  it("grants admin everything structural", () => {
    expect(can.manageEvents(admin)).toBe(true);
    expect(can.manageDivisions(admin)).toBe(true);
    expect(can.manageMembers(admin)).toBe(true);
    expect(can.manageBackups(admin)).toBe(true);
  });
  it("denies non-admins structural changes", () => {
    for (const r of ["coordinator", "staff", "intern", "guest"] as const) {
      expect(can.manageEvents(user(r))).toBe(false);
      expect(can.manageMembers(user(r))).toBe(false);
      expect(can.manageBackups(user(r))).toBe(false);
    }
  });
});

describe("budget (admin only)", () => {
  it("allows admin only — coordinator is view-only since v1.15", () => {
    expect(can.manageBudget(user("admin"))).toBe(true);
    expect(can.manageBudget(user("coordinator"))).toBe(false);
    expect(can.manageBudget(user("staff"))).toBe(false);
    expect(can.manageBudget(user("intern"))).toBe(false);
    expect(can.manageBudget(user("guest"))).toBe(false);
  });
});

describe("access levels", () => {
  it("reports the matrix level per role", () => {
    expect(accessLevel(user("admin"), "tasks")).toBe("full");
    expect(accessLevel(user("coordinator"), "tasks")).toBe("full");
    expect(accessLevel(user("staff"), "tasks")).toBe("limited");
    expect(accessLevel(user("intern"), "rundown")).toBe("limited");
    expect(accessLevel(user("guest"), "links")).toBe("none");
    expect(accessLevel(user("coordinator"), "budget")).toBe("view");
  });
  it("atLeast is ordered none < view < limited < full", () => {
    const staff = user("staff");
    expect(atLeast(staff, "tasks", "view")).toBe(true);
    expect(atLeast(staff, "tasks", "limited")).toBe(true);
    expect(atLeast(staff, "tasks", "full")).toBe(false);
  });
  it("unknown modules fail closed", () => {
    expect(accessLevel(user("admin"), "nope")).toBe("none");
  });
});

describe("manageTasks — limited roles write, only full deletes", () => {
  it("is NOT scoped to the user's division (regression: staff could only edit some tasks)", () => {
    // profiles.division must not narrow task rights — the access matrix is the
    // only authority. A staff member scoped to EVENT can still edit MARKETING.
    for (const r of ["admin", "coordinator", "staff", "intern"] as const) {
      expect(can.manageTasks(user(r, "EVENT"))).toBe(true);
      expect(can.editTask(user(r, "EVENT"))).toBe(true);
      expect(can.editTaskProgress(user(r, "EVENT"))).toBe(true);
    }
  });
  it("guest can never write a task", () => {
    expect(can.manageTasks(user("guest"))).toBe(false);
    expect(can.editTask(user("guest"))).toBe(false);
    expect(can.editTaskProgress(user("guest"))).toBe(false);
  });
  it("staff/intern can never delete a task", () => {
    expect(can.deleteTask(user("admin"))).toBe(true);
    expect(can.deleteTask(user("coordinator", "EVENT"))).toBe(true);
    expect(can.deleteTask(user("staff", "EVENT"))).toBe(false);
    expect(can.deleteTask(user("intern", "EVENT"))).toBe(false);
    expect(can.deleteTask(user("guest"))).toBe(false);
  });
});

describe("limited access — rundown / Hari-H / Super Link", () => {
  it("staff & intern may write but not delete", () => {
    for (const r of ["staff", "intern"] as const) {
      expect(can.manageRundown(user(r))).toBe(true);
      expect(can.deleteRundown(user(r))).toBe(false);
      expect(can.manageJobs(user(r))).toBe(true);
      expect(can.deleteJob(user(r))).toBe(false);
      expect(can.createLink(user(r))).toBe(true);
      expect(can.manageLinks(user(r))).toBe(true);
      expect(can.deleteLink(user(r))).toBe(false);
    }
  });
  it("coordinator keeps full access on those four modules", () => {
    const c = user("coordinator");
    expect(can.deleteRundown(c)).toBe(true);
    expect(can.deleteJob(c)).toBe(true);
    expect(can.deleteLink(c)).toBe(true);
  });
  it("guest writes nothing", () => {
    expect(can.manageRundown(user("guest"))).toBe(false);
    expect(can.manageJobs(user("guest"))).toBe(false);
    expect(can.createLink(user("guest"))).toBe(false);
  });
});

describe("view-only downgrade for coordinator/staff/intern", () => {
  it("prospects are admin-managed only", () => {
    expect(can.manageProspects(user("admin"))).toBe(true);
    for (const r of ["coordinator", "staff", "intern", "guest"] as const) {
      expect(can.manageProspects(user(r))).toBe(false);
    }
  });
  it("teams/divisions/faq are admin-managed only", () => {
    for (const r of ["coordinator", "staff", "intern", "guest"] as const) {
      expect(can.manageTeams(user(r))).toBe(false);
      expect(can.manageDivisions(user(r))).toBe(false);
      expect(can.manageFaq(user(r))).toBe(false);
    }
  });
});

describe("requestableRolesFor", () => {
  const withEmail = (r: AppUser["role"]) => ({ ...user(r), email: "a@b.c" });

  it("a role-less account may ask for any of the three roles", () => {
    expect(requestableRolesFor(withEmail("guest"))).toEqual(["coordinator", "staff", "intern"]);
  });
  it("excludes the role the account already holds", () => {
    expect(requestableRolesFor(withEmail("staff"))).toEqual(["coordinator", "intern"]);
    expect(requestableRolesFor(withEmail("coordinator"))).toEqual(["staff", "intern"]);
  });
  it("admin can never be requested, and an admin cannot be downgraded this way", () => {
    expect(requestableRolesFor(withEmail("admin"))).toEqual([]);
    expect(canRequestRole(withEmail("admin"))).toBe(false);
    for (const r of ["guest", "staff", "coordinator", "intern"] as const) {
      expect(requestableRolesFor(withEmail(r))).not.toContain("admin");
    }
  });
  it("an anonymous Tamu session (no email) has no account to promote", () => {
    expect(requestableRolesFor(user("guest"))).toEqual([]);
    expect(canRequestRole(user("guest"))).toBe(false);
  });
});

describe("role requests", () => {
  it("only admin can approve/ignore", () => {
    expect(can.manageRoleRequests(user("admin"))).toBe(true);
    for (const r of ["coordinator", "staff", "intern", "guest"] as const) {
      expect(can.manageRoleRequests(user(r))).toBe(false);
      expect(can.accessModule(user(r), "roles")).toBe(false);
    }
    expect(can.accessModule(user("admin"), "roles")).toBe(true);
  });
});

describe("editTaskProgress", () => {
  it("every writing role can edit progress on any task", () => {
    for (const r of ["admin", "coordinator", "staff", "intern"] as const) {
      expect(can.editTaskProgress(user(r, "EVENT"))).toBe(true);
    }
  });
  it("guest can never edit progress", () => {
    expect(can.editTaskProgress(user("guest"))).toBe(false);
  });
});

describe("isAssignedTo", () => {
  it("matches by PIC first name", () => {
    const u = user("staff");
    u.name = "Budi Santoso";
    expect(isAssignedTo(u, task({ pic: "budi" }))).toBe(true);
    expect(isAssignedTo(u, task({ pic: "andi" }))).toBe(false);
  });
  it("matches by division when user has a division", () => {
    const u = user("staff", "EVENT");
    u.name = "X";
    expect(isAssignedTo(u, task({ division: "EVENT", pic: "" }))).toBe(true);
  });
});

describe("accessModule / isReadOnly", () => {
  it("budget opens for every role but guest; only admin can write", () => {
    for (const r of ["admin", "coordinator", "staff", "intern"] as const) {
      expect(can.accessModule(user(r), "budget")).toBe(true);
    }
    expect(can.accessModule(user("guest"), "budget")).toBe(false);
    expect(can.manageBudget(user("admin"))).toBe(true);
    expect(can.manageBudget(user("staff"))).toBe(false);
  });
  it("links module excludes guest", () => {
    expect(can.accessModule(user("intern"), "links")).toBe(true);
    expect(can.accessModule(user("guest"), "links")).toBe(false);
  });
  it("settings is readable by every role but guest; backups stay admin-only", () => {
    for (const r of ["admin", "coordinator", "staff", "intern"] as const) {
      expect(can.accessModule(user(r), "settings")).toBe(true);
      expect(can.manageBackups(user(r))).toBe(r === "admin");
    }
    expect(can.accessModule(user("guest"), "settings")).toBe(false);
  });
  it("guest is read-only", () => {
    expect(can.isReadOnly(user("guest"))).toBe(true);
    expect(can.isReadOnly(user("staff"))).toBe(false);
  });
});
