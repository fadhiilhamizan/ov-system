import "server-only";
import seed from "./seed.json";
import { DEMO_EVENT_ID } from "../demo";
import type {
  BudgetPlan,
  JobHariH,
  LinkItem,
  Member,
  OVEvent,
  Prospect,
  RundownItem,
  Task,
  Team,
} from "../types";

// ------------------------------------------------------------------
// The demo dataset is NOT a second copy — it is simply the subset of the
// canonical seed.json scoped to the demo event. resetDemoData() rebuilds
// the demo edition from exactly these rows.
// ------------------------------------------------------------------

interface DemoSeed {
  event: OVEvent | undefined;
  members: Member[];
  tasks: Task[];
  budgetPlans: BudgetPlan[];
  rundown: RundownItem[];
  jobHariH: JobHariH[];
  teams: Team[];
  prospects: Prospect[];
  links: LinkItem[];
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function getDemoSeed(): DemoSeed {
  const db = seed as unknown as {
    events: OVEvent[];
    members: Member[];
    tasks: Task[];
    budgetPlans: BudgetPlan[];
    rundown: RundownItem[];
    jobHariH: JobHariH[];
    teams: Team[];
    prospects: Prospect[];
    links: LinkItem[];
  };
  const scoped = <T extends { event_id?: string | null }>(rows: T[]) =>
    clone(rows.filter((r) => r.event_id === DEMO_EVENT_ID));
  return {
    event: clone(db.events.find((e) => e.id === DEMO_EVENT_ID)),
    members: scoped(db.members),
    tasks: scoped(db.tasks),
    budgetPlans: clone(db.budgetPlans.filter((b) => b.event_id === DEMO_EVENT_ID)),
    rundown: scoped(db.rundown),
    jobHariH: scoped(db.jobHariH),
    teams: scoped(db.teams),
    prospects: scoped(db.prospects),
    links: scoped(db.links),
  };
}
