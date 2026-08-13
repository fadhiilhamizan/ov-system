import { z } from "zod";
import { CLONE_MODULES, type CloneModule } from "@/lib/types";

// ============================================================
// Zod schemas - the single input-validation layer for Server Actions.
//
// Server Actions receive arbitrary client input over the wire, so every
// action validates through one of these before touching the data layer.
// Rules here mirror (and are stricter than) the DB CHECK constraints and
// RLS policies: trimming, length caps, enum whitelists, URL shape.
//
// Helpers below turn a schema + input into the `{ ok:false, error }` shape
// the actions already return, so callers stay a one-liner.
// ============================================================

/** Trimmed, non-empty string with a max length. */
const nonEmpty = (label: string, max = 500) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .min(1, `${label} wajib diisi.`)
    .max(max, `${label} terlalu panjang (maks. ${max} karakter).`);

/** Optional free-text: undefined/null tolerated, trimmed, length-capped.
 *  Collapses null → undefined so it stays assignable to non-nullable
 *  `string` fields on the domain types. */
const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Teks terlalu panjang (maks. ${max} karakter).`)
    .nullish()
    .transform((v) => v ?? undefined);

/** An id passed back from the client (row identifiers). */
export const idSchema = nonEmpty("ID", 128);

/** Nullable ISO-ish date (yyyy-mm-dd) or empty. */
const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD.")
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

/** Absolute http(s) URL. */
export const urlSchema = z
  .string()
  .trim()
  .min(1, "URL wajib diisi.")
  .regex(/^https?:\/\/\S+$/i, "URL harus berupa tautan http(s) yang valid.");

/** Optional http(s) URL - empty string and null both mean "belum diisi". */
const optionalUrl = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v ?? "")
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Tautan harus berupa URL http(s) yang valid.")
  .transform((v) => (v === "" ? null : v));

/** A non-negative whole number, or null when the field is left blank. */
const countField = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => (v === null || v === undefined || v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && Number.isInteger(v) && v >= 0), "Harus berupa angka bulat 0 atau lebih.");

/** A 0–5 star rating with up to two decimals, or null when left blank. */
const ratingField = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => (v === null || v === undefined || v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 5), "Nilai harus antara 0 dan 5.")
  .transform((v) => (v === null ? null : Math.round(v * 100) / 100));

const taskStatus = z.enum(["todo", "ongoing", "done", "overtime"]);

// ---------------- Tasks ----------------
export const createTaskSchema = z.object({
  event_id: nonEmpty("Ormawa Visit", 128),
  division: nonEmpty("Divisi", 128),
  no: z.string().trim().max(32).optional(),
  pic: optionalText(255),
  title: nonEmpty("Judul tugas", 300),
  start_date: optionalDate,
  end_date: optionalDate,
  notes: optionalText(),
  result: optionalText(),
  status: taskStatus.optional(),
});

export const updateTaskSchema = z
  .object({
    event_id: z.string().trim().min(1).max(128),
    division: z.string().trim().min(1).max(128),
    no: z.string().trim().max(32),
    pic: z.string().trim().max(255),
    title: z.string().trim().min(1, "Judul tugas wajib diisi.").max(300),
    start_date: optionalDate,
    end_date: optionalDate,
    notes: z.string().trim().max(2000),
    result: z.string().trim().max(2000),
    status: taskStatus,
  })
  .partial();

export const taskStatusSchema = taskStatus;

/**
 * The only fields the Work Breakdown bulk editor may set on many tasks at once.
 *
 * Deliberately its own schema rather than a slice of `updateTaskSchema`: a bulk
 * write touches rows the user never opened, so the blast radius is capped here
 * instead of relying on the caller to hand-pick keys. Title and result are
 * per-task by nature and are absent on purpose.
 */
export const bulkTaskFieldsSchema = z
  .object({
    division: z.string().trim().min(1).max(128),
    pic: z.string().trim().max(255),
    end_date: optionalDate,
  })
  .partial();

/** One result link on a task. `url` must be a real http(s) link; `label` is the
 *  name used for its Super Link entry when published. */
export const taskLinkSchema = z.object({
  id: z.string().trim().max(128).optional(),
  url: urlSchema,
  label: z.string().trim().max(200).optional().transform((v) => v ?? ""),
  in_super_link: z.boolean().optional().transform((v) => !!v),
});
export const taskLinksSchema = z
  .array(taskLinkSchema)
  .max(20, "Maksimal 20 tautan hasil per tugas.")
  .superRefine((links, ctx) => {
    // Guard against the same URL being attached twice to one task (which would
    // also publish it to Super Link twice).
    const seen = new Set<string>();
    for (const l of links) {
      const key = l.url.trim().toLowerCase().replace(/\/+$/, "");
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: "Ada tautan hasil yang sama lebih dari sekali." });
        return;
      }
      seen.add(key);
    }
  });

/**
 * One reference link on a task.
 *
 * `link_id` IS accepted here, unlike on prospects: it only records that the URL
 * was picked from Super Link, and the row it names is read-only from a task's
 * point of view. Nothing about a Super Link entry is written through this path,
 * so a forged id can at worst mislabel a task's own reference.
 */
export const taskRefSchema = z.object({
  id: z.string().trim().max(128).optional(),
  url: urlSchema,
  label: z.string().trim().max(200).optional().transform((v) => v ?? ""),
  link_id: z.string().trim().max(128).nullish().transform((v) => v || null),
});
export const taskRefsSchema = z
  .array(taskRefSchema)
  .max(20, "Maksimal 20 referensi per tugas.")
  .superRefine((refs, ctx) => {
    // The same URL twice on one task is always a mistake, and it makes the
    // "open" shortcuts ambiguous.
    const seen = new Set<string>();
    for (const r of refs) {
      const key = r.url.trim().toLowerCase().replace(/\/+$/, "");
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: "Ada referensi yang sama lebih dari sekali." });
        return;
      }
      seen.add(key);
    }
  });

// ---------------- Violet (chatbot) ----------------
/**
 * What the chat box may send. Caps exist because every field is forwarded to a
 * paid API: an unbounded question or a thousand-turn history is somebody
 * running up a bill through a form nobody validated.
 */
export const violetAskSchema = z.object({
  question: nonEmpty("Pertanyaan", 1000),
  history: z
    .array(z.object({
      role: z.enum(["user", "model"]),
      text: z.string().trim().max(4000),
    }))
    // Only the recent turns matter for a follow-up, and the cap bounds the
    // prompt size no matter how long the conversation runs.
    .max(20, "Riwayat percakapan terlalu panjang.")
    .optional()
    .transform((v) => (v ?? []).slice(-8)),
});

// ---------------- Budget ----------------
const money = z
  .number()
  .finite("Angka tidak valid.")
  .min(0, "Angka tidak boleh negatif.")
  .max(1_000_000_000_000, "Angka terlalu besar.")
  .nullable()
  .optional();

/** Hex colour (#rgb or #rrggbb) - shared by divisions and budget categories. */
const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Warna harus kode hex (mis. #3b82f6).");

export const budgetItemSchema = z.object({
  category: nonEmpty("Kategori", 120),
  name: nonEmpty("Nama item", 200),
  qty: money,
  unit: z.string().trim().max(60).optional(),
  unit_price: money,
  category_color: hexColor.nullable().optional(),
});

export const updateBudgetItemSchema = z
  .object({
    qty: money,
    unit_price: money,
    name: z.string().trim().min(1, "Nama item wajib diisi.").max(200),
    category: z.string().trim().min(1).max(120),
    unit: z.string().trim().max(60),
    category_color: hexColor.nullable(),
  })
  .partial();

// No `event_id`: a budget plan always belongs to the Ormawa Visit currently
// being viewed, which the action reads from the session. Leaving it out of the
// schema also means a client cannot file a plan against a different edition -
// Zod strips the key before it ever reaches the repo.
export const budgetPlanSchema = z.object({
  name: nonEmpty("Nama rencana anggaran", 200),
});

/**
 * Which Ormawa Visit each copyable menu is taken from.
 *
 * Every value is an edition id, so each menu can point at a DIFFERENT source
 * (divisions from OV A, rundown from OV B). Unknown keys are stripped, which is
 * what keeps a hand-crafted payload from naming a table that was never meant to
 * be clonable. An empty string means "don't copy this menu".
 */
export const cloneSourcesSchema = z.object(
  Object.fromEntries(
    CLONE_MODULES.map((m) => [m, z.string().trim().max(128).optional()]),
  ) as Record<CloneModule, z.ZodOptional<z.ZodString>>,
);

// ---------------- Events ----------------
// title is required; every other field is optional.
export const eventSchema = z.object({
  code: z.string().trim().max(60).optional(),
  title: nonEmpty("Nama Ormawa Visit", 200),
  partner: z.string().trim().max(200).optional(),
  campus: z.string().trim().max(200).optional(),
  type: z.enum(["internal", "external"]).optional(),
  mode: z.enum(["offline", "online"]).optional(),
  cabinet: z.string().trim().max(120).optional(),
  event_date: optionalDate,
  plan_start: optionalDate,
  plan_end: optionalDate,
  location: z.string().trim().max(200).optional(),
  status: z.enum(["planning", "active", "done"]).optional(),

  // --- Performance Measurement ---
  // Mirrors the CHECK constraints in migration 0029, so a bad value is rejected
  // with a readable message here instead of a raw Postgres constraint error.
  attendance_hmsi: countField,
  feedback_hmsi_count: countField,
  feedback_hmsi_rating: ratingField,
  feedback_partner_count: countField,
  feedback_partner_rating: ratingField,
  report_url: optionalUrl,
});

// ---------------- Members ----------------
// Names must not contain a comma: PIC / team rosters are stored as a
// comma-joined string of display names, so a comma in a name would corrupt
// the parse and silently drop the member association (data loss).
const NO_COMMA = "Tidak boleh mengandung tanda koma (,).";
export const memberSchema = z.object({
  name: nonEmpty("Nama anggota", 200).refine((v) => !v.includes(","), NO_COMMA),
  // A member may sit in more than one division; `division` is the derived
  // primary (divisions[0]) and is filled in by the action, not the client.
  divisions: z
    .array(z.string().trim().min(1).max(128))
    .min(1, "Pilih minimal satu divisi.")
    .max(20, "Terlalu banyak divisi."),
  division: z.string().trim().max(128).optional().nullable(),
  event_id: z.string().trim().max(128).optional().nullable(),
  nickname: z.string().trim().max(120).refine((v) => !v.includes(","), NO_COMMA).optional(),
  nrp: z.string().trim().max(40).optional(),
  type: z.enum(["fungsionaris", "intern"]).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
});

// ---------------- Divisions ----------------
export const divisionSchema = z.object({
  key: z.string().trim().max(60).optional(),
  name: nonEmpty("Nama divisi", 200),
  short: z
    .string()
    .trim()
    .max(4, "Singkatan maksimal 4 huruf.")
    .transform((v) => v.toUpperCase())
    .optional(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Warna harus kode hex (mis. #3b82f6).")
    .optional(),
  exclude_from_rundown: z.boolean().optional(),
});

// ---------------- Prospects ----------------
// Freeform pipeline table: enumerate every known field with a length cap so the
// action can pass the *validated* data (trimmed, unknown keys stripped) to the
// repo instead of the raw client payload (mass-assignment protection).
const prospectBase = z.object({
  event_id: z.string().trim().max(128).optional().nullable(),
  no: z.string().trim().max(32).optional(),
  date_text: z.string().trim().max(60).optional(),
  month: z.string().trim().max(40).optional(),
  contact: z.string().trim().max(200).optional(),
  org_name: z.string().trim().max(200).optional(),
  campus: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  mode: z.string().trim().max(40).optional(),
  pic: z.string().trim().max(200).optional(),
  contact_status: z.string().trim().max(60).optional(),
  their_response: z.string().trim().max(60).optional(),
  our_response: z.string().trim().max(60).optional(),
  done: z.boolean().optional(),
  // A prospect's own link (handbook, org profile). Optional, but when filled it
  // must be a real http(s) URL, same rule as Super Link entries.
  // Empty stays an empty STRING here, not null: the whole Prospect model uses
  // "" for "not filled in", and a stray null would have to be null-checked in
  // every table cell that renders it.
  link: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v ?? "")
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Tautan harus berupa URL http(s) yang valid."),
  link_label: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  link_in_super_link: z.boolean().optional(),
  // `link_id` is deliberately absent: it points at a Super Link row and is
  // owned by the repo. Accepting it from a client would let anyone re-point a
  // prospect at someone else's Super Link entry and then overwrite it.
  source: z.string().trim().max(120).optional(),
});
/** Create: require at least an org name or a contact. */
export const prospectSchema = prospectBase.refine(
  (v) => !!(v.org_name?.trim() || v.contact?.trim()),
  { error: "Isi minimal nama ormawa atau kontak.", path: ["org_name"] },
);
/** Update: any subset of fields (no minimum-one-field rule). */
export const prospectUpdateSchema = prospectBase.partial();

// ---------------- Links ----------------
export const createLinkSchema = z.object({
  event_id: z.string().trim().max(128).optional().nullable(),
  section: z.string().trim().max(200).optional(),
  division: z.string().trim().max(128).optional(),
  name: nonEmpty("Nama tautan", 200),
  url: urlSchema,
  note: optionalText(1000),
  source: z.string().trim().max(120).optional(),
});
/** Update: any subset; `url` (when present) still validated as an http(s) URL. */
export const linkUpdateSchema = createLinkSchema.partial();

// ---------------- Rundown ----------------
// Empty rows are allowed (the table lets you add a blank row and fill inline),
// so every field is optional. division_jobs is a division-key → text map.
export const rundownSchema = z.object({
  event_id: z.string().trim().max(128).optional(),
  variant: z.string().trim().max(40).optional(),
  no: z.number().int().min(0).optional(),
  time_start: z.string().trim().max(20).optional(),
  time_end: z.string().trim().max(20).optional(),
  duration: z.string().trim().max(40).optional(),
  activity: z.string().trim().max(500).optional(),
  keterangan: z.string().trim().max(1000).optional(),
  mc: z.string().trim().max(300).optional(),
  operator: z.string().trim().max(500).optional(),
  division_jobs: z.record(z.string().max(128), z.string().max(1000)).optional(),
  // Rowspan per column, capped so a hostile payload can't ask the browser to
  // span a thousand rows. columnRoles() clamps to the real list length anyway.
  merges: z.record(z.string().max(128), z.number().int().min(1).max(200)).optional(),
});

// ---------------- Jobs (Hari-H) ----------------
export const jobSchema = z.object({
  event_id: z.string().trim().max(128).optional(),
  no: z.string().trim().max(32).optional(),
  pic: z.string().trim().max(300).optional(),
  job: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

// ---------------- Teams (division structure) ----------------
export const teamSchema = z.object({
  event_id: z.string().trim().max(128).optional().nullable(),
  division: z.string().trim().max(128).optional(),
  coordinator: z.string().trim().max(200).optional(),
  fungsionaris: z.string().trim().max(2000).optional(),
  intern: z.string().trim().max(2000).optional(),
});

// ---------------- FAQ ----------------
export const faqSchema = z.object({
  question: nonEmpty("Pertanyaan", 300),
  answer: nonEmpty("Jawaban", 3000),
});

// ---------------- Role requests ----------------
// Only these three roles are requestable: admin is granted out of band, and
// "guest" is the no-role starting state. The DB mirrors this with a CHECK
// constraint (migration 0023). A role applies across ALL Ormawa Visits, so
// there is deliberately no event scope on a request.
export const roleRequestSchema = z.object({
  requested_role: z.enum(["coordinator", "staff", "intern"], {
    error: "Pilih peran yang diminta (Koordinator, Staff, atau Intern).",
  }),
  message: optionalText(1000),
});

// ============================================================
// Helper: validate and coerce, returning a discriminated result.
// ============================================================
export type Parsed<T> = { ok: true; data: T } | { ok: false; error: string };

/** Parse `input` with `schema`, flattening the first error to a message. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): Parsed<T> {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  return { ok: false, error: first?.message ?? "Input tidak valid." };
}
