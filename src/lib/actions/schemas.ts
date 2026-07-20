import { z } from "zod";

// ============================================================
// Zod schemas — the single input-validation layer for Server Actions.
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

// ---------------- Budget ----------------
const money = z
  .number()
  .finite("Angka tidak valid.")
  .min(0, "Angka tidak boleh negatif.")
  .max(1_000_000_000_000, "Angka terlalu besar.")
  .nullable()
  .optional();

export const budgetItemSchema = z.object({
  category: nonEmpty("Kategori", 120),
  name: nonEmpty("Nama item", 200),
  qty: money,
  unit: z.string().trim().max(60).optional(),
  unit_price: money,
});

export const updateBudgetItemSchema = z
  .object({
    qty: money,
    unit_price: money,
    name: z.string().trim().min(1, "Nama item wajib diisi.").max(200),
    category: z.string().trim().min(1).max(120),
    unit: z.string().trim().max(60),
  })
  .partial();

export const budgetPlanSchema = z.object({
  name: nonEmpty("Nama rencana anggaran", 200),
  event_id: nonEmpty("Ormawa Visit", 128),
});

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
});

// ---------------- Members ----------------
// Names must not contain a comma: PIC / team rosters are stored as a
// comma-joined string of display names, so a comma in a name would corrupt
// the parse and silently drop the member association (data loss).
const NO_COMMA = "Tidak boleh mengandung tanda koma (,).";
export const memberSchema = z.object({
  name: nonEmpty("Nama anggota", 200).refine((v) => !v.includes(","), NO_COMMA),
  division: nonEmpty("Divisi", 128),
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
  batch: z.string().trim().max(120).optional(),
  no: z.string().trim().max(32).optional(),
  date_text: z.string().trim().max(60).optional(),
  month: z.string().trim().max(40).optional(),
  contact: z.string().trim().max(200).optional(),
  org_name: z.string().trim().max(200).optional(),
  campus: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  pic: z.string().trim().max(200).optional(),
  contact_status: z.string().trim().max(60).optional(),
  their_response: z.string().trim().max(60).optional(),
  our_response: z.string().trim().max(60).optional(),
  done: z.boolean().optional(),
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
