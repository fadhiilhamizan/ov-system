// ============================================================
// Domain model for the Ormawa Visit management system.
// Single source of truth shared by the local store and Supabase.
// ============================================================

export type Role = "admin" | "coordinator" | "staff" | "intern" | "guest";

export type TaskStatus = "todo" | "ongoing" | "done" | "overtime";

export type EventType = "internal" | "external";
export type EventMode = "offline" | "online";
export type EventStatus = "planning" | "active" | "done";

/** Division keys are dynamic (each Ormawa Visit may define its own). The
 *  canonical HMSI divisions are PIC, COORDINATOR, SECRETARY, TREASURER, LO,
 *  EVENT, CONSUMPTION, OPERATIONAL, CREATIVE, MARKETING, OUTSOURCE. */
export type DivisionKey = string;

export interface Division {
  /** Surrogate id (Supabase). Optional so the local store can address by key. */
  id?: string;
  /** Divisions are per-Ormawa-Visit; `key` is unique WITHIN an event, not
   *  globally. Legacy/local rows may leave this null (treated as global). */
  event_id?: string | null;
  key: DivisionKey;
  name: string;
  short: string;
  color: string;
  order: number;
  /** When true, this division is NOT shown as a column in the rundown table. */
  exclude_from_rundown?: boolean;
}

export interface OVEvent {
  id: string;
  code: string;
  title: string;
  partner: string;
  campus: string;
  type: EventType;
  mode: EventMode;
  cabinet: string;
  event_date: string | null;
  plan_start?: string | null;
  plan_end?: string | null;
  location: string;
  status: EventStatus;
  order: number;
  /** Archived: nobody but an admin may change anything belonging to this
   *  Ormawa Visit. Enforced in the database (migration 0028) as well as here. */
  locked?: boolean;

  // --- Performance Measurement (migration 0029) -----------------------------
  // Entered on the Ormawa Visit form after the event, shown on the Dashboard.
  // Every field is optional: null means "belum diisi", and the dashboard says so
  // rather than rendering a misleading zero.
  /** Jumlah fungsionaris HMSI yang hadir. */
  attendance_hmsi?: number | null;
  /** Total feedback yang diberikan oleh HMSI. */
  feedback_hmsi_count?: number | null;
  /** Rata-rata penilaian feedback oleh HMSI, skala 0-5. */
  feedback_hmsi_rating?: number | null;
  /** Total feedback yang diberikan oleh himpunan partner. */
  feedback_partner_count?: number | null;
  /** Rata-rata penilaian feedback oleh himpunan partner, skala 0-5. */
  feedback_partner_rating?: number | null;
  /** Tautan Laporan Pertanggung Jawaban (LPJ). */
  report_url?: string | null;
}

export interface Member {
  id: string;
  event_id?: string | null;
  name: string;
  nickname: string;
  nrp: string;
  type: "fungsionaris" | "intern";
  year: number;
  /** Primary division - kept in sync with `divisions[0]` for older readers
   *  (badges, task PIC scoping, seeds). Read it via `primaryDivision()`. */
  division?: DivisionKey | null;
  /** Every division this member is part of. Most people have exactly one, but
   *  the model deliberately allows more. Read it via `memberDivisions()`. */
  divisions?: DivisionKey[];
}

export interface Task {
  id: string;
  event_id: string;
  division: DivisionKey;
  no: string;
  pic: string;
  title: string;
  start_date: string | null;
  start_raw: string;
  end_date: string | null;
  end_raw: string;
  notes: string;
  result: string;
  status: TaskStatus;
}

/** A link attached to a task's result. When `in_super_link` is true it owns a
 *  row in `links` (Super Link), tracked by `link_id` so re-saving updates that
 *  row instead of creating a duplicate. */
export interface TaskLink {
  id: string;
  task_id: string;
  url: string;
  label: string;
  in_super_link: boolean;
  link_id?: string | null;
  order: number;
}

/**
 * A link a task REFERENCES (handbook, template, past proposal).
 *
 * The mirror image of TaskLink: that one is a RESULT published TO Super Link
 * and owned by exactly one task. A reference points AT Super Link, and one
 * Super Link entry may be referenced by many tasks. `link_id` is null when the
 * URL was typed by hand.
 */
export interface TaskRef {
  id: string;
  task_id: string;
  url: string;
  label: string;
  link_id?: string | null;
  order: number;
}

/** Shape the references editor sends back; `id` is absent for new rows. */
export interface TaskRefInput {
  id?: string;
  url: string;
  label: string;
  link_id?: string | null;
}

/** Shape the task form sends back; `id` is absent for newly-added rows. */
export interface TaskLinkInput {
  id?: string;
  url: string;
  label: string;
  in_super_link: boolean;
}

export interface Prospect {
  id: string;
  event_id?: string | null;
  // NOTE: the `prospects.batch` DB column still exists (seed generation uses it
  // to derive event_id), but it is no longer part of the app model - the
  // Ormawa Visit an item belongs to is already `event_id`, which made batch
  // redundant clutter. Nothing in the UI reads or writes it any more.
  no: string;
  date_text: string;
  month: string;
  contact: string;
  org_name: string;
  campus: string;
  location: string;
  pic: string;
  mode: string; // 'offline' | 'online' | ''
  contact_status: string; // MENGHUBUNGI | DIHUBUNGI | ''
  their_response: string; // DITERIMA | DITOLAK | DITUNGGU | ''
  our_response: string; // TERIMA | TOLAK | TUNGGU | ''
  done: boolean;
  /** The confirmed partner for this OV - the OV pulls its partner/campus/
   *  location/mode from this prospect. At most one per event. */
  is_primary: boolean;
  /** Free-text notes about this prospect. */
  notes: string;
  // --- legacy single-link columns (0036), superseded by ProspectLink (0038) --
  // A prospect may attach several files (handbook, org profile, the proposal
  // they sent back), so the one-link model could only be kept by overwriting.
  // Nothing reads these any more; migration 0038 copied them into
  // `prospect_links` and released their Super Link ownership.
  /** @deprecated use `prospect_links` (see ProspectLink). */
  link?: string;
  /** @deprecated use `prospect_links`. */
  link_label?: string;
  /** @deprecated use `prospect_links`. */
  link_in_super_link?: boolean;
  /** @deprecated use `prospect_links`. */
  link_id?: string | null;
  source: string;
}

/**
 * One link belonging to the organisation a prospect represents: their handbook,
 * their org profile, the proposal they sent back.
 *
 * Same contract as TaskLink, deliberately: when `in_super_link` is true the row
 * owns an entry in `links` (Super Link), tracked by `link_id` so re-saving
 * updates that entry instead of creating a duplicate, and unticking the box
 * deletes it rather than leaving an orphan nobody can trace back.
 */
export interface ProspectLink {
  id: string;
  prospect_id: string;
  url: string;
  label: string;
  in_super_link: boolean;
  link_id?: string | null;
  order: number;
}

/** Shape the prospect form sends back; `id` is absent for newly-added rows. */
export interface ProspectLinkInput {
  id?: string;
  url: string;
  label: string;
  in_super_link: boolean;
}

export interface LinkItem {
  id: string;
  event_id?: string | null;
  section: string;
  division: string;
  name: string;
  url: string;
  note: string;
  source: string;
}

export interface BudgetItem {
  id: string;
  category: string;
  no: number;
  name: string;
  qty: number | null;
  unit: string;
  unit_price: number | null;
  total: number | null;
  /** Dot colour of the item's category. Stored per item but applied to the
   *  whole category (every item in it is updated together), so a plan can
   *  colour-code its own categories. Null = fall back to the preset palette. */
  category_color?: string | null;
}

export interface BudgetPlan {
  id: string;
  name: string;
  event_id: string;
  items: BudgetItem[];
}

export interface RundownItem {
  id: string;
  event_id: string;
  variant: string;
  no: number;
  time_start: string;
  time_end: string;
  duration: string;
  activity: string;
  keterangan: string; // "Catatan" column in the rundown table
  mc: string;
  operator: string; // "Kebutuhan Operator" column
  /** Per-division activity during the event, keyed by division key. Dynamic
   *  columns in the rundown table. */
  division_jobs: Record<string, string>;
  /** Rowspan per column, stored on the TOP row of a merged run:
   *  `{ mc: 3 }` = this row's MC cell spans itself plus the two rows below.
   *  Keys are "mc", "operator", or a division key. See lib/rundown-merge.ts. */
  merges?: Record<string, number>;
  // --- legacy columns (kept for backward-compat with older rows) ---
  host?: string;
  opr_link?: string;
  job_lo?: string;
  job_event?: string;
  job_consump?: string;
  job_creative?: string;
  job_opr?: string;
}

export interface JobHariH {
  id: string;
  event_id: string;
  no: string;
  pic: string;
  job: string;
  notes: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export interface Team {
  id: string;
  event_id: string | null;
  division: DivisionKey;
  /** The division's coordinator (atasan) - a role, not a division. One per
   *  division per Ormawa Visit. Stored as a display name (usually also present
   *  in `fungsionaris`). */
  coordinator: string;
  fungsionaris: string;
  intern: string;
}

/** Roles an account may ask for - an upgrade OR a downgrade. Admin is never
 *  requestable (it is granted out of band, and an admin can't be demoted this
 *  way); "guest" is the no-role starting state, so it isn't requestable either. */
export type RequestableRole = Extract<Role, "coordinator" | "staff" | "intern">;

export const REQUESTABLE_ROLES: RequestableRole[] = ["coordinator", "staff", "intern"];

export type RoleRequestStatus = "pending" | "approved" | "ignored";

/** A signed-up (role-less) account asking to be given a real role. Admins
 *  approve or ignore these from the "Role Request" menu. */
export interface RoleRequest {
  id: string;
  user_id: string;
  /** Denormalised at submit time so the admin list needs no profile join. */
  name: string;
  email: string;
  requested_role: RequestableRole;
  division?: DivisionKey | null;
  event_id?: string | null;
  message: string;
  status: RoleRequestStatus;
  created_at: string;
  decided_at?: string | null;
  decided_by?: string | null;
}

// ============================================================
// Developer tooling (migration 0039). Read by exactly one route, /developer,
// which is not registered in the nav, the access matrix, the guide, or
// Violet's link table. See src/lib/developers.ts for why this is an email
// layer and not a sixth Role.
// ============================================================

/** One audited write, recorded by a database trigger rather than by the app. */
export interface ActivityEntry {
  id: number;
  at: string;
  actor_id: string | null;
  actor_email: string;
  actor_role: string;
  /** The table written to, e.g. "tasks". */
  table_name: string;
  row_id: string;
  /** The row's title/name AS IT WAS, so the feed reads even after a delete. */
  label: string;
  action: 'insert' | 'update' | 'delete';
  event_id: string | null;
  /** Only the columns that changed: { kolom: { dari, jadi } }. Updates only. */
  changed: Record<string, { dari: unknown; jadi: unknown }> | null;
  /** The whole row. Inserts and deletes only (an update is already a diff). */
  snapshot: Record<string, unknown> | null;
}

/** Per-account edit counts, aggregated in the database. */
export interface ActorStat {
  actor_id: string | null;
  actor_email: string;
  actor_role: string;
  edits: number;
  inserts: number;
  updates: number;
  deletes: number;
  last_edit: string | null;
}

/** A heartbeat from an open tab. Readable by developers only. */
export interface PresenceEntry {
  user_id: string;
  email: string;
  name: string;
  role: string;
  path: string;
  last_seen: string;
}

/** An error reported from a browser (or an error boundary). */
export interface ErrorEntry {
  id: number;
  at: string;
  kind: 'client' | 'boundary' | 'server';
  message: string;
  stack: string;
  path: string;
  user_agent: string;
  user_id: string | null;
  user_email: string;
  resolved: boolean;
}

/** Row count per table, for the database health panel. */
export interface TableCount {
  table_name: string;
  rows: number;
}

// ============================================================
// Menu Himpunan (migration 0040).
// ============================================================

/**
 * One FGD plotting table: HMSI departments paired with their counterparts at
 * the partner association. An Ormawa Visit may have several.
 */
export interface FgdPlan {
  id: string;
  event_id: string;
  /** Optional label, e.g. "Sesi pagi". */
  title: string;
  /** Heading of the right-hand column. Free text rather than a foreign key to
   *  prospects: plotting is usually drafted before the partner is confirmed. */
  partner_name: string;
  order: number;
}

/** One department pairing inside an FgdPlan. */
export interface FgdRow {
  id: string;
  plan_id: string;
  /** The HMSI ITS department. */
  ours: string;
  /** Its counterpart at the partner association. */
  theirs: string;
  order: number;
}

/**
 * One assessment row used to compare the associations that ACCEPTED.
 *
 * `org_name` is copied from the prospect rather than only referenced: the
 * assessment must stay readable if the prospect is deleted, for the same
 * reason ActivityEntry keeps a `label`.
 */
export interface CompareEntry {
  id: string;
  event_id: string;
  prospect_id: string | null;
  org_name: string;
  aspect: string;
  indicator: string;
  plus: string;
  minus: string;
  order: number;
}

/** Daily counter for the two sign-in buttons that need no account. */
export interface AccessCount {
  day: string;
  kind: "guest" | "demo";
  hits: number;
}

export interface Database {
  divisions: Division[];
  events: OVEvent[];
  members: Member[];
  tasks: Task[];
  taskLinks?: TaskLink[];
  taskRefs?: TaskRef[];
  prospects: Prospect[];
  prospectLinks?: ProspectLink[];
  links: LinkItem[];
  budgetPlans: BudgetPlan[];
  rundown: RundownItem[];
  jobHariH: JobHariH[];
  faqs: Faq[];
  teams: Team[];
  roleRequests?: RoleRequest[];
}

/**
 * An account. Deliberately carries NO division and NO Ormawa Visit scope: an
 * account represents a level of access, not a person or a team. A role is
 * global - a coordinator is a coordinator for every edition in the database -
 * and one account may be shared by several people. Anything that needs to know
 * *who* did something belongs on the data (e.g. a task's `pic`), not here.
 */
export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor?: string;
}

/**
 * Menus that can be copied from one Ormawa Visit into another.
 *
 * The array order is load-bearing: divisions must be written before tasks and
 * rundown, which resolve their division by key within the target edition.
 * It lives here rather than in repo.ts so the local (JSON) backend can share it
 * without importing its own caller.
 */
export const CLONE_MODULES = [
  "divisions", "members", "prospects", "tasks", "rundown", "jobs", "budget",
] as const;
export type CloneModule = (typeof CLONE_MODULES)[number];

/** Which edition each menu is copied FROM. A menu that is absent (or maps to an
 *  empty string) is not copied at all, so divisions can come from OV A while
 *  the rundown comes from OV B. */
export type CloneSources = Partial<Record<CloneModule, string>>;
