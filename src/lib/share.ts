// ============================================================
// Share links: /s/<edition>/<menu>
//
// Opening one needs no account and no visit to /login. The landing page
// (app/s/[event]/[module]) starts a read-only Tamu session the same way the
// "Masuk sebagai Tamu" button does (an anonymous Supabase session, so reads
// still pass RLS), selects the edition in the link, and lands on the menu.
// Someone who is already signed in keeps their own account; only the edition
// switches.
//
// Only menus that are worth showing to someone outside AND that a Tamu can
// actually open are shareable. Anggota (names + NRP), Anggaran, Super Link and
// Reach & Offer (other associations' contact people) are deliberately not on
// the list; `share.test.ts` pins that every entry is viewable by a guest.
//
// Pure (no React, no Next) so the server landing, the share dialog and the
// tests read the same list.
// ============================================================

export const SHAREABLE_MODULES = [
  "dashboard",
  "tasks",
  "calendar",
  "rundown",
  "jobs",
  "himpunan",
] as const;

export type ShareModule = (typeof SHAREABLE_MODULES)[number];

export function isShareModule(v: unknown): v is ShareModule {
  return typeof v === "string" && (SHAREABLE_MODULES as readonly string[]).includes(v);
}

/** Where a shared menu lands inside the app. */
export const SHARE_TARGET: Record<ShareModule, string> = {
  dashboard: "/dashboard",
  tasks: "/tasks",
  calendar: "/calendar",
  rundown: "/rundown",
  jobs: "/jobs",
  himpunan: "/himpunan",
};

/** The menu a path belongs to, if it is shareable. */
export function shareModuleForPath(pathname: string): ShareModule | null {
  const seg = "/" + (pathname.split("/")[1] ?? "");
  const hit = (Object.entries(SHARE_TARGET) as [ShareModule, string][]).find(([, href]) => href === seg);
  return hit ? hit[0] : null;
}

/**
 * The share URL. `demo` makes it open the demo database instead of the real
 * one (a link copied while exploring the demo must not lead into production).
 * `query` carries view state worth keeping, e.g. the calendar's view and date.
 */
export function shareUrl(
  origin: string,
  eventId: string,
  module: ShareModule,
  opts: { demo?: boolean; query?: Record<string, string> } = {},
): string {
  const url = new URL(`/s/${encodeURIComponent(eventId)}/${module}`, origin);
  if (opts.demo) url.searchParams.set("demo", "1");
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v) url.searchParams.set(k, v);
  return url.toString();
}

/** Only these query keys are passed on to the target page (no open redirect). */
export const SHARE_QUERY_KEYS = ["view", "date"] as const;

/** The in-app path a share link lands on, with only the allowed query keys. */
export function shareLanding(module: ShareModule, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const k of SHARE_QUERY_KEYS) {
    const v = query[k];
    if (v && /^[\w-]{1,32}$/.test(v)) params.set(k, v);
  }
  const qs = params.toString();
  return `${SHARE_TARGET[module]}${qs ? `?${qs}` : ""}`;
}
