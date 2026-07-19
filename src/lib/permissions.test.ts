import { describe, it, expect } from "vitest";
import { can, isAssignedTo } from "./permissions";
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

describe("budget (admin + coordinator)", () => {
  it("allows admin and coordinator only", () => {
    expect(can.manageBudget(user("admin"))).toBe(true);
    expect(can.manageBudget(user("coordinator"))).toBe(true);
    expect(can.manageBudget(user("staff"))).toBe(false);
    expect(can.manageBudget(user("intern"))).toBe(false);
    expect(can.manageBudget(user("guest"))).toBe(false);
  });
});

describe("manageTasks — coordinator scoped to own division", () => {
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
  it("staff/intern/guest cannot manage tasks", () => {
    expect(can.manageTasks(user("staff", "EVENT"), "EVENT")).toBe(false);
    expect(can.manageTasks(user("intern", "EVENT"), "EVENT")).toBe(false);
    expect(can.manageTasks(user("guest"), "EVENT")).toBe(false);
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
  it("budget module is admin+coordinator only", () => {
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
