import { describe, it, expect } from "vitest";
import { LEGAL_CONTACTS, LEGAL_DOCS, LEGAL_UPDATED, PRIVACY, TERMS } from "./legal";
import { pick, type Bi } from "./guide";

/** Every translatable string in a document, flattened. */
function allStrings(doc: (typeof LEGAL_DOCS)[keyof typeof LEGAL_DOCS]): Bi[] {
  return [
    doc.title,
    doc.summary,
    ...doc.sections.flatMap((s) => [s.heading, ...(s.body ?? []), ...(s.bullets ?? [])]),
  ];
}

describe.each([
  ["privacy", PRIVACY],
  ["terms", TERMS],
] as const)("%s document", (slug, doc) => {
  it("has the expected slug and is registered in LEGAL_DOCS", () => {
    expect(doc.slug).toBe(slug);
    expect(LEGAL_DOCS[slug]).toBe(doc);
  });

  it("has sections, each with a heading and some content", () => {
    expect(doc.sections.length).toBeGreaterThan(0);
    for (const s of doc.sections) {
      expect(s.heading.id.trim()).not.toBe("");
      // A section must say something - paragraphs, bullets, or both.
      expect((s.body?.length ?? 0) + (s.bullets?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  // The pages follow the language toggle, so a missing `en` would silently
  // render Indonesian to an English reader.
  it("translates every string into both languages", () => {
    for (const b of allStrings(doc)) {
      expect(b.id.trim(), `missing id for: ${JSON.stringify(b)}`).not.toBe("");
      expect(b.en.trim(), `missing en for: ${b.id}`).not.toBe("");
      expect(pick(b, "id")).toBe(b.id);
      expect(pick(b, "en")).toBe(b.en);
    }
  });
});

describe("legal metadata", () => {
  it("every published contact is a real address, labelled in both languages", () => {
    // These are printed on a PUBLIC page that calls itself binding, and they are
    // rendered as mailto links. An empty string used to be the normal state
    // here (a TODO waiting on the department), and an empty or unlabelled entry
    // renders as a link to nowhere next to a promise that someone will answer.
    // Two addresses is deliberate: one belongs to the cabinet and changes with
    // it, one to the maintainer, and a reader needs to know which is which.
    expect(LEGAL_CONTACTS.length).toBeGreaterThan(0);
    for (const c of LEGAL_CONTACTS) {
      expect(c.address, "alamat kosong").toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
      expect(c.role.id.trim(), `peran ID kosong untuk ${c.address}`).not.toBe("");
      expect(c.role.en.trim(), `peran EN kosong untuk ${c.address}`).not.toBe("");
    }
    const unique = new Set(LEGAL_CONTACTS.map((c) => c.address));
    expect(unique.size).toBe(LEGAL_CONTACTS.length);
  });

  it("LEGAL_UPDATED is a parseable ISO date", () => {
    expect(LEGAL_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(new Date(LEGAL_UPDATED).getTime())).toBe(false);
  });

  it("the privacy policy names every cookie the app actually sets", () => {
    // Keep this in step with the cookies in lib/ui-prefs, lib/demo, lib/auth,
    // lib/session and lib/i18n/config - an unlisted cookie is an inaccurate
    // policy, which is worse than no policy.
    const text = allStrings(PRIVACY).map((b) => b.id).join(" ");
    for (const cookie of [
      "ov_guest",
      "ov_lang",
      "ov_sidebar",
      "ov_active_event",
      "ov_active_division",
      "ov_demo",
      "ov_demo_user",
    ]) {
      expect(text, `cookie ${cookie} is not disclosed`).toContain(cookie);
    }
  });

  it("the privacy policy names every third-party processor", () => {
    const text = allStrings(PRIVACY).map((b) => b.id).join(" ");
    for (const vendor of ["Supabase", "Vercel", "Google", "Gemini", "Groq"]) {
      expect(text, `${vendor} is not disclosed`).toContain(vendor);
    }
  });
});
