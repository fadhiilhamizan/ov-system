import "server-only";
import { revalidatePath } from "next/cache";

// ============================================================
// Scoped cache invalidation.
//
// Every mutation used to call revalidatePath("/", "layout"), which throws away
// the whole route tree - one FAQ edit re-rendered the budget page. This maps
// each entity to the routes that actually read it, so a write only busts those.
//
// WHY NOT revalidateTag: tags only invalidate data in Next's Data Cache, i.e.
// `fetch(..., { next: { tags } })` or a `'use cache'` function calling
// cacheTag(). Our reads go through the Supabase client (not fetch) and are
// wrapped in React `cache()`, which is per-request memoisation only - nothing
// for a tag to invalidate. They also can't move into `'use cache'`, because
// createClient() reads cookies() for the caller's session; caching that
// server-side would serve one user's rows to another. ('use cache: private'
// is experimental, flag-gated, and not stored server-side anyway.)
// So path scoping is the correct tool here - just a much narrower scope.
//
// Derived from the getters each route calls. When a page starts reading a new
// entity, add its route here.
// ============================================================

/**
 * The one dynamic route in the app.
 *
 * `revalidatePath("/divisions")` busts the LIST page and nothing else: Next
 * matches paths literally, so a division's detail page was never invalidated by
 * any write. Editing a task from Work Breakdown left the same task stale on
 * Papan Divisi until a hard reload. A dynamic route has to be named by its
 * literal ROUTE PATTERN, brackets and all, plus the "page" type - passing the
 * filled-in path ("/divisions/EVENT") matches nothing either.
 *
 * It reads the same entities as the list page plus the task dialog's data, so
 * it appears everywhere "/divisions" does.
 */
const DIVISION_DETAIL = "/divisions/[key]";

/** Routes that read each entity. */
const CONSUMERS = {
  tasks: ["/tasks", "/calendar", "/divisions", DIVISION_DETAIL, "/dashboard", "/events"],
  taskLinks: ["/tasks", "/calendar", "/divisions", DIVISION_DETAIL, "/links"],
  divisions: ["/tasks", "/calendar", "/rundown", "/members", "/divisions", DIVISION_DETAIL, "/links", "/dashboard"],
  members: ["/members", "/divisions", DIVISION_DETAIL, "/tasks", "/calendar", "/jobs", "/prospects", "/dashboard"],
  teams: ["/members", "/divisions", DIVISION_DETAIL, "/tasks", "/calendar", "/links"],
  // /himpunan is here because its Compare tab is GATED on how many prospects
  // have DITERIMA: editing a response in Reach & Offer is what opens or closes
  // that feature, and without this the gate stays stale until a hard reload.
  prospects: ["/prospects", "/dashboard", "/events", "/himpunan"],
  // Not just /links: the task dialog's reference picker reads the whole Super
  // Link directory, and that dialog is mounted by all three task pages.
  links: ["/links", "/tasks", "/calendar", "/divisions", DIVISION_DETAIL],
  budget: ["/budget", "/dashboard", "/events"],
  rundown: ["/rundown"],
  jobs: ["/jobs"],
  faq: ["/faq"],
  // The event list drives the topbar switcher in the shared layout, so an
  // event write legitimately affects every route.
  events: ["LAYOUT"],
  backups: ["/settings"],
  roles: ["/settings", "LAYOUT"],
} as const;

export type Entity = keyof typeof CONSUMERS;

/**
 * Invalidate only the routes that read `entities`.
 * Pass "LAYOUT" cases through as a full-tree bust (event/role changes).
 */
export function revalidateEntities(...entities: Entity[]) {
  const paths = new Set<string>();
  for (const e of entities) for (const p of CONSUMERS[e]) paths.add(p);

  if (paths.has("LAYOUT")) {
    // Something layout-wide changed; one full-tree pass covers everything.
    revalidatePath("/", "layout");
    return;
  }
  for (const p of paths) {
    // A route pattern (brackets) needs the "page" type; a literal path does
    // not take one. See DIVISION_DETAIL above.
    if (p.includes("[")) revalidatePath(p, "page");
    else revalidatePath(p);
  }
}
