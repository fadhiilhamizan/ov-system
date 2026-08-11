import { describe, it, expect } from "vitest";
import {
  memberDivisions,
  primaryDivision,
  memberInDivision,
  divisionMembers,
  divisionFields,
  coordinatorNames,
  isCoordinator,
  withDivisionAdded,
} from "./members";
import type { Member } from "./types";

const m = (over: Partial<Member>): Member => ({
  id: "m1",
  name: "Budi Santoso",
  nickname: "Budi",
  nrp: "5026221001",
  type: "fungsionaris",
  year: 2022,
  ...over,
});

describe("memberDivisions", () => {
  it("returns the array when present", () => {
    expect(memberDivisions(m({ divisions: ["CREATIVE", "MARKETING"] }))).toEqual(["CREATIVE", "MARKETING"]);
  });

  it("falls back to the legacy single division", () => {
    expect(memberDivisions(m({ division: "EVENT" }))).toEqual(["EVENT"]);
  });

  it("is empty when the member has no division at all", () => {
    expect(memberDivisions(m({}))).toEqual([]);
    expect(memberDivisions(m({ divisions: [], division: "" }))).toEqual([]);
  });

  it("trims and de-duplicates", () => {
    expect(memberDivisions(m({ divisions: [" LO ", "LO", ""] }))).toEqual(["LO"]);
  });
});

describe("primaryDivision", () => {
  it("is the first division", () => {
    expect(primaryDivision(m({ divisions: ["CREATIVE", "MARKETING"] }))).toBe("CREATIVE");
  });
  it("is null when there is none", () => {
    expect(primaryDivision(m({}))).toBeNull();
  });
});

describe("memberInDivision", () => {
  it("matches any of the member's divisions, not just the primary", () => {
    const dewi = m({ divisions: ["CREATIVE", "MARKETING"] });
    expect(memberInDivision(dewi, "CREATIVE")).toBe(true);
    expect(memberInDivision(dewi, "MARKETING")).toBe(true);
    expect(memberInDivision(dewi, "EVENT")).toBe(false);
  });
});

describe("divisionMembers", () => {
  const roster = [
    m({ id: "1", name: "Budi", divisions: ["EVENT"] }),
    m({ id: "2", name: "Maya", type: "intern", divisions: ["EVENT"] }),
    m({ id: "3", name: "Dewi", divisions: ["CREATIVE", "EVENT"] }),
    m({ id: "4", name: "Rizky", divisions: ["MARKETING"] }),
  ];

  it("collects everyone in the division, including multi-division members", () => {
    expect(divisionMembers(roster, "EVENT").map((x) => x.id)).toEqual(["1", "2", "3"]);
  });

  it("can filter by type", () => {
    expect(divisionMembers(roster, "EVENT", "intern").map((x) => x.id)).toEqual(["2"]);
    expect(divisionMembers(roster, "EVENT", "fungsionaris").map((x) => x.id)).toEqual(["1", "3"]);
  });
});

describe("divisionFields", () => {
  it("derives the legacy primary column from the array", () => {
    expect(divisionFields(["LO", "EVENT"])).toEqual({ divisions: ["LO", "EVENT"], division: "LO" });
  });

  it("falls back to the legacy value when the array is empty", () => {
    expect(divisionFields([], "EVENT")).toEqual({ divisions: ["EVENT"], division: "EVENT" });
    expect(divisionFields(undefined, "EVENT")).toEqual({ divisions: ["EVENT"], division: "EVENT" });
  });

  it("yields a null primary when there is nothing at all", () => {
    expect(divisionFields([], null)).toEqual({ divisions: [], division: null });
  });

  it("strips blanks and duplicates", () => {
    expect(divisionFields([" LO ", "", "LO"])).toEqual({ divisions: ["LO"], division: "LO" });
  });
});

describe("coordinator", () => {
  it("reads the comma-joined coordinator names", () => {
    expect(coordinatorNames({ coordinator: "Budi, Maya" })).toEqual(["Budi", "Maya"]);
  });

  it("treats no coordinator as valid (a division may have none)", () => {
    expect(coordinatorNames({ coordinator: "" })).toEqual([]);
    expect(coordinatorNames(undefined)).toEqual([]);
    expect(isCoordinator(m({}), { coordinator: "" })).toBe(false);
  });

  it("matches on the nickname or the full name", () => {
    expect(isCoordinator(m({ nickname: "Budi" }), { coordinator: "Budi" })).toBe(true);
    expect(isCoordinator(m({ nickname: "", name: "Budi Santoso" }), { coordinator: "budi santoso" })).toBe(true);
    expect(isCoordinator(m({ nickname: "Maya" }), { coordinator: "Budi" })).toBe(false);
  });
});

describe("withDivisionAdded", () => {
  it("appends so the PRIMARY division is not silently changed", () => {
    // divisions[0] drives the badge in tables and task scoping; prepending
    // would re-label everyone added to a division.
    expect(withDivisionAdded(m({ divisions: ["EVENT", "LO"] }), "CONSUMPTION"))
      .toEqual(["EVENT", "LO", "CONSUMPTION"]);
  });

  it("is a no-op when the member is already in that division", () => {
    const before = m({ divisions: ["EVENT", "LO"] });
    expect(withDivisionAdded(before, "LO")).toEqual(["EVENT", "LO"]);
  });

  it("makes it the primary when the member had none", () => {
    expect(withDivisionAdded(m({ divisions: [] }), "EVENT")).toEqual(["EVENT"]);
  });

  it("reads the legacy single division as the starting point", () => {
    expect(withDivisionAdded(m({ division: "EVENT", divisions: undefined }), "LO"))
      .toEqual(["EVENT", "LO"]);
  });
});

