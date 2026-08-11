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

/** Routes that read each entity. */
const CONSUMERS = {
  tasks: ["/tasks", "/calendar", "/divisions", "/dashboard", "/events"],
  taskLinks: ["/tasks", "/calendar", "/divisions", "/links"],
  divisions: ["/tasks", "/calendar", "/rundown", "/members", "/divisions", "/links", "/dashboard"],
  members: ["/members", "/divisions", "/tasks", "/calendar", "/jobs", "/prospects", "/dashboard"],
  teams: ["/members", "/divisions", "/tasks", "/calendar", "/links"],
  prospects: ["/prospects", "/dashboard", "/events"],
  links: ["/links"],
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
  for (const p of paths) revalidatePath(p);
}
