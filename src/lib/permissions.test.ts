import { describe, it, expect } from "vitest";
import { accessLevel, atLeast, can, isAssignedTo } from "./permissions";
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
  it("admin can manage any division", () => {
    expect(can.manageTasks(user("admin"), "EVENT")).toBe(true);
    expect(can.manageTasks(user("admin"), "MARKETING")).toBe(true);
  });
  it("coordinator only within own division", () => {
    const coord = user("coordinator", "EVENT");
    expect(can.manageTasks(coord, "EVENT")).toBe(true);
    expect(can.manageTasks(coord, "MARKETING")).toBe(false);
    expect(can.manageTasks(coord)).toBe(true); // no division given
  });
  it("staff/intern can create & edit tasks in their division", () => {
    expect(can.manageTasks(user("staff", "EVENT"), "EVENT")).toBe(true);
    expect(can.manageTasks(user("intern", "EVENT"), "EVENT")).toBe(true);
    expect(can.manageTasks(user("staff", "EVENT"), "MARKETING")).toBe(false);
    expect(can.manageTasks(user("guest"), "EVENT")).toBe(false);
  });
  it("staff/intern can never delete a task", () => {
    expect(can.deleteTask(user("admin"), "EVENT")).toBe(true);
    expect(can.deleteTask(user("coordinator", "EVENT"), "EVENT")).toBe(true);
    expect(can.deleteTask(user("staff", "EVENT"), "EVENT")).toBe(false);
    expect(can.deleteTask(user("intern", "EVENT"), "EVENT")).toBe(false);
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

describe("editTaskProgress — assignee-based for staff/intern", () => {
  it("admin & coordinator can always edit progress", () => {
    expect(can.editTaskProgress(user("admin"), task())).toBe(true);
    expect(can.editTaskProgress(user("coordinator"), task())).toBe(true);
  });
  it("staff can edit only own division's task", () => {
    const staff = user("staff", "EVENT");
    expect(can.editTaskProgress(staff, task({ division: "EVENT" }))).toBe(true);
    expect(can.editTaskProgress(staff, task({ division: "MARKETING" }))).toBe(false);
  });
  it("staff assigned by name can edit a task outside their division", () => {
    const staff = user("staff", "EVENT");
    staff.name = "Budi Santoso";
    expect(can.editTaskProgress(staff, task({ division: "MARKETING", pic: "budi" }))).toBe(true);
  });
  it("guest can never edit progress", () => {
    expect(can.editTaskProgress(user("guest"), task())).toBe(false);
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
  it("budget module opens for admin+coordinator (coordinator read-only)", () => {
    expect(can.accessModule(user("admin"), "budget")).toBe(true);
    expect(can.accessModule(user("coordinator"), "budget")).toBe(true);
    expect(can.accessModule(user("staff"), "budget")).toBe(false);
    expect(can.accessModule(user("guest"), "budget")).toBe(false);
  });
  it("links module excludes guest", () => {
    expect(can.accessModule(user("intern"), "links")).toBe(true);
    expect(can.accessModule(user("guest"), "links")).toBe(false);
  });
  it("settings is admin-only", () => {
    expect(can.accessModule(user("admin"), "settings")).toBe(true);
    expect(can.accessModule(user("coordinator"), "settings")).toBe(false);
  });
  it("guest is read-only", () => {
    expect(can.isReadOnly(user("guest"))).toBe(true);
    expect(can.isReadOnly(user("staff"))).toBe(false);
  });
});
