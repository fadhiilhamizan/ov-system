import { describe, it, expect } from "vitest";
import { acceptedProspects, canCompare } from "./himpunan";
import { HMSI_DEPARTMENTS, MODULE_ACCESS_LEVEL } from "./constants";
import { can } from "./permissions";
import type { AppUser, Prospect } from "./types";

const prospect = (over: Partial<Prospect> = {}): Prospect => ({
  id: "p1", event_id: "ov1", no: "1", date_text: "", month: "", contact: "",
  org_name: "HIMA X", campus: "ITS", location: "", pic: "", mode: "",
  contact_status: "", their_response: "", our_response: "", done: false,
  is_primary: false, notes: "", source: "manual", ...over,
});

const user = (role: AppUser["role"]): AppUser => ({
  id: "u1", name: "U", email: "u@x.id", role,
});

describe("who accepted", () => {
  it("picks the prospects whose response is DITERIMA", () => {
    const list = [
      prospect({ id: "a", their_response: "DITERIMA" }),
      prospect({ id: "b", their_response: "DITOLAK" }),
      prospect({ id: "c", their_response: "" }),
    ];
    expect(acceptedProspects(list).map((p) => p.id)).toEqual(["a"]);
  });

  it("tolerates the casing and spacing of imported rows", () => {
    // `their_response` is free text and carries values from the original
    // spreadsheet import, so an exact === would quietly drop real acceptances.
    const list = [
      prospect({ id: "a", their_response: "diterima" }),
      prospect({ id: "b", their_response: "  Diterima " }),
    ];
    expect(acceptedProspects(list)).toHaveLength(2);
  });

  it("treats a missing response as not accepted", () => {
    expect(acceptedProspects([prospect({ their_response: undefined as never })])).toHaveLength(0);
  });
});

describe("the Compare gate", () => {
  const accepted = (n: number) =>
    Array.from({ length: n }, (_, i) => prospect({ id: `p${i}`, their_response: "DITERIMA" }));

  it("stays shut with nothing accepted", () => {
    expect(canCompare([])).toBe(false);
  });
  it("stays shut with exactly one acceptance", () => {
    // One acceptance is not a choice, so a comparison screen would be theatre.
    expect(canCompare(accepted(1))).toBe(false);
  });
  it("opens at two", () => {
    expect(canCompare(accepted(2))).toBe(true);
  });
  it("ignores rejections when counting", () => {
    expect(canCompare([...accepted(1), prospect({ id: "z", their_response: "DITOLAK" })])).toBe(false);
  });
});

describe("HMSI departments", () => {
  it("has the ten departments, in order, with no duplicates", () => {
    expect(HMSI_DEPARTMENTS).toHaveLength(10);
    expect(new Set(HMSI_DEPARTMENTS).size).toBe(10);
    expect(HMSI_DEPARTMENTS[0]).toBe("Executive Board");
    expect(HMSI_DEPARTMENTS[1]).toBe("External Affairs");
  });
});

describe("Himpunan access", () => {
  it("is full for admin, coordinator and staff", () => {
    for (const role of ["admin", "coordinator", "staff"] as const) {
      expect(can.manageHimpunan(user(role)), role).toBe(true);
      expect(can.accessModule(user(role), "himpunan"), role).toBe(true);
    }
  });

  it("is view-only for intern and guest", () => {
    for (const role of ["intern", "guest"] as const) {
      expect(can.manageHimpunan(user(role)), role).toBe(false);
      // View-only, NOT hidden: they can still open the menu and read it.
      expect(can.accessModule(user(role), "himpunan"), role).toBe(true);
    }
  });

  it("is in the access matrix, so Pengaturan documents it", () => {
    expect(MODULE_ACCESS_LEVEL.himpunan).toEqual({
      admin: "full", coordinator: "full", staff: "full", intern: "view", guest: "view",
    });
  });
});
