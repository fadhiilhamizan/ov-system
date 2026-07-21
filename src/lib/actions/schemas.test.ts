import { describe, it, expect } from "vitest";
import {
  parse,
  createTaskSchema,
  updateTaskSchema,
  budgetItemSchema,
  budgetPlanSchema,
  eventSchema,
  memberSchema,
  divisionSchema,
  prospectSchema,
  prospectUpdateSchema,
  createLinkSchema,
  linkUpdateSchema,
  rundownSchema,
  jobSchema,
  teamSchema,
  taskLinksSchema,
  urlSchema,
  idSchema,
} from "./schemas";

describe("createTaskSchema", () => {
  it("accepts a valid task and trims the title", () => {
    const r = parse(createTaskSchema, {
      event_id: "e1",
      division: "EVENT",
      title: "  Kirim proposal  ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.title).toBe("Kirim proposal");
      expect(r.data.event_id).toBe("e1");
    }
  });
  it("rejects an empty title", () => {
    const r = parse(createTaskSchema, { event_id: "e1", division: "EVENT", title: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Judul tugas/i);
  });
  it("rejects a missing event_id", () => {
    const r = parse(createTaskSchema, { division: "EVENT", title: "x" });
    expect(r.ok).toBe(false);
  });
  it("rejects an invalid status enum", () => {
    const r = parse(createTaskSchema, {
      event_id: "e1",
      division: "EVENT",
      title: "x",
      status: "hacked",
    });
    expect(r.ok).toBe(false);
  });
  it("strips unknown keys (mass-assignment protection)", () => {
    const r = parse(createTaskSchema, {
      event_id: "e1",
      division: "EVENT",
      title: "x",
      id: "attacker-supplied",
      is_admin: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("id" in r.data).toBe(false);
      expect("is_admin" in r.data).toBe(false);
    }
  });
  it("rejects malformed dates", () => {
    const r = parse(createTaskSchema, {
      event_id: "e1",
      division: "EVENT",
      title: "x",
      start_date: "12-31-2025",
    });
    expect(r.ok).toBe(false);
  });
  it("coerces empty date string to null", () => {
    const r = parse(createTaskSchema, {
      event_id: "e1",
      division: "EVENT",
      title: "x",
      start_date: "",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.start_date).toBeNull();
  });
});

describe("updateTaskSchema (partial)", () => {
  it("accepts a status-only patch", () => {
    const r = parse(updateTaskSchema, { status: "done" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.data)).toEqual(["status"]);
  });
  it("rejects an empty patched title", () => {
    const r = parse(updateTaskSchema, { title: "" });
    expect(r.ok).toBe(false);
  });
});

describe("budget schemas", () => {
  it("rejects a negative price", () => {
    const r = parse(budgetItemSchema, { category: "Konsumsi", name: "Nasi", unit_price: -5 });
    expect(r.ok).toBe(false);
  });
  it("accepts a valid budget item", () => {
    const r = parse(budgetItemSchema, { category: "Konsumsi", name: "Nasi", qty: 10, unit_price: 15000 });
    expect(r.ok).toBe(true);
  });
  it("requires plan name and event_id", () => {
    expect(parse(budgetPlanSchema, { name: "RAB", event_id: "e1" }).ok).toBe(true);
    expect(parse(budgetPlanSchema, { name: "", event_id: "e1" }).ok).toBe(false);
    expect(parse(budgetPlanSchema, { name: "RAB" }).ok).toBe(false);
  });
});

describe("eventSchema", () => {
  it("requires a title", () => {
    expect(parse(eventSchema, { title: "OV Internal" }).ok).toBe(true);
    expect(parse(eventSchema, {}).ok).toBe(false);
  });
  it("rejects an invalid type enum", () => {
    expect(parse(eventSchema, { title: "x", type: "sideways" }).ok).toBe(false);
  });
});

describe("memberSchema", () => {
  it("requires name and division", () => {
    expect(parse(memberSchema, { name: "Budi", division: "EVENT" }).ok).toBe(true);
    expect(parse(memberSchema, { name: "Budi" }).ok).toBe(false);
    expect(parse(memberSchema, { division: "EVENT" }).ok).toBe(false);
  });
});

describe("divisionSchema", () => {
  it("validates a hex color", () => {
    expect(parse(divisionSchema, { name: "LO", color: "#3b82f6" }).ok).toBe(true);
    expect(parse(divisionSchema, { name: "LO", color: "blue" }).ok).toBe(false);
  });
});

describe("prospectSchema", () => {
  it("requires at least an org name or a contact", () => {
    expect(parse(prospectSchema, { org_name: "HMTI" }).ok).toBe(true);
    expect(parse(prospectSchema, { contact: "0812" }).ok).toBe(true);
    expect(parse(prospectSchema, { org_name: "", contact: "" }).ok).toBe(false);
  });
});

describe("link + url schemas", () => {
  it("requires a valid http(s) url", () => {
    expect(parse(createLinkSchema, { name: "Drive", url: "https://a.com/x" }).ok).toBe(true);
    expect(parse(createLinkSchema, { name: "Drive", url: "javascript:alert(1)" }).ok).toBe(false);
    expect(parse(createLinkSchema, { name: "Drive", url: "not a url" }).ok).toBe(false);
  });
  it("urlSchema trims and validates", () => {
    expect(parse(urlSchema, "  https://ok.com  ").ok).toBe(true);
    expect(parse(urlSchema, "ftp://x").ok).toBe(false);
  });
});

describe("idSchema", () => {
  it("rejects empty ids", () => {
    expect(parse(idSchema, "").ok).toBe(false);
    expect(parse(idSchema, "abc-123").ok).toBe(true);
  });
});

describe("taskLinksSchema (result links)", () => {
  it("accepts valid links and defaults the publish flag", () => {
    const r = parse(taskLinksSchema, [{ url: "https://a.com/x", label: " Proposal " }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].in_super_link).toBe(false);
      expect(r.data[0].label).toBe("Proposal");
    }
  });
  it("rejects a non-http(s) link", () => {
    expect(parse(taskLinksSchema, [{ url: "javascript:alert(1)" }]).ok).toBe(false);
    expect(parse(taskLinksSchema, [{ url: "bukan-link" }]).ok).toBe(false);
  });
  it("rejects the same URL twice (would duplicate it in Super Link)", () => {
    const dup = parse(taskLinksSchema, [
      { url: "https://a.com/x" },
      { url: "https://a.com/x/" }, // trailing slash still counts as the same
    ]);
    expect(dup.ok).toBe(false);
  });
  it("allows an empty list", () => {
    expect(parse(taskLinksSchema, []).ok).toBe(true);
  });
});

describe("member name comma guard", () => {
  it("rejects commas in name / nickname (they'd corrupt PIC parsing)", () => {
    expect(parse(memberSchema, { name: "Budi, S.T.", division: "EVENT" }).ok).toBe(false);
    expect(parse(memberSchema, { name: "Budi", nickname: "Bu,di", division: "EVENT" }).ok).toBe(false);
    expect(parse(memberSchema, { name: "Budi", nickname: "Budi", division: "EVENT" }).ok).toBe(true);
  });
});

describe("prospect schemas", () => {
  it("create validates, trims, and strips unknown keys", () => {
    const r = parse(prospectSchema, { org_name: "  HIMA X  ", evil: "<script>" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.org_name).toBe("HIMA X");
      expect((r.data as Record<string, unknown>).evil).toBeUndefined();
    }
  });
  it("update allows a lone field with no minimum-one rule", () => {
    expect(parse(prospectUpdateSchema, { done: true }).ok).toBe(true);
    expect(parse(prospectUpdateSchema, {}).ok).toBe(true);
  });
});

describe("link update schema", () => {
  it("carries the full field set on create and validates url on partial update", () => {
    const c = parse(createLinkSchema, { name: "Drive", url: "https://a.com", section: "Docs", division: "EVENT" });
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.data.section).toBe("Docs");
    expect(parse(linkUpdateSchema, { note: "catatan" }).ok).toBe(true);
    expect(parse(linkUpdateSchema, { url: "not-a-url" }).ok).toBe(false);
  });
});

describe("rundown / job / team schemas", () => {
  it("rundown accepts empty rows and trims text", () => {
    expect(parse(rundownSchema, {}).ok).toBe(true);
    const r = parse(rundownSchema, { activity: "  Sambutan  ", division_jobs: { EVENT: "setup" } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.activity).toBe("Sambutan");
  });
  it("job & team strip unknown keys", () => {
    const j = parse(jobSchema, { job: "Angkut kursi", hacker: 1 });
    expect(j.ok).toBe(true);
    if (j.ok) expect((j.data as Record<string, unknown>).hacker).toBeUndefined();
    expect(parse(teamSchema, { division: "EVENT", fungsionaris: "A, B" }).ok).toBe(true);
  });
});
