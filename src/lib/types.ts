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
}

export interface Member {
  id: string;
  event_id?: string | null;
  name: string;
  nickname: string;
  nrp: string;
  type: "fungsionaris" | "intern";
  year: number;
  division?: DivisionKey | null;
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
  batch: string;
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
  /** The confirmed partner for this OV — the OV pulls its partner/campus/
   *  location/mode from this prospect. At most one per event. */
  is_primary: boolean;
  source: string;
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
  /** The division's coordinator (atasan) — a role, not a division. One per
   *  division per Ormawa Visit. Stored as a display name (usually also present
   *  in `fungsionaris`). */
  coordinator: string;
  fungsionaris: string;
  intern: string;
}

/** Roles an account may ask for — an upgrade OR a downgrade. Admin is never
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

export interface Database {
  divisions: Division[];
  events: OVEvent[];
  members: Member[];
  tasks: Task[];
  taskLinks?: TaskLink[];
  prospects: Prospect[];
  links: LinkItem[];
  budgetPlans: BudgetPlan[];
  rundown: RundownItem[];
  jobHariH: JobHariH[];
  faqs: Faq[];
  teams: Team[];
  roleRequests?: RoleRequest[];
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  division?: DivisionKey | null;
  avatarColor?: string;
}
