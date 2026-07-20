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
  contact_status: string; // MENGHUBUNGI | DIHUBUNGI | ''
  their_response: string; // DITERIMA | DITOLAK | DITUNGGU | ''
  our_response: string; // TERIMA | TOLAK | TUNGGU | ''
  done: boolean;
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
  fungsionaris: string;
  intern: string;
}

export interface Database {
  divisions: Division[];
  events: OVEvent[];
  members: Member[];
  tasks: Task[];
  prospects: Prospect[];
  links: LinkItem[];
  budgetPlans: BudgetPlan[];
  rundown: RundownItem[];
  jobHariH: JobHariH[];
  faqs: Faq[];
  teams: Team[];
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  division?: DivisionKey | null;
  avatarColor?: string;
}
