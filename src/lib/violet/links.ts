// ============================================================
// Where Violet is allowed to send someone.
//
// This exists because Violet sent a user to /violet, a page that has never
// existed. The corpus derived a link from the guide section's key, and the
// guide has a section ABOUT Violet, which is not a menu. A dead shortcut is
// worse than no shortcut: it reads as an authoritative answer and ends in a
// 404, so the user concludes the assistant is making things up.
//
// So every shortcut, whether it comes from the corpus or from a markdown link
// the model wrote itself, goes through `resolveHref` first. Anything not in
// this table is dropped and rendered as plain text.
//
// A plain module (no "server-only", no directive): the server builds links
// with it and the browser validates them again before rendering.
// ============================================================

/**
 * Every path this app actually serves, mapped to the in-page anchors it
 * carries. The anchors are what make a shortcut land ON the section instead of
 * at the top of a long page, which is the other half of the same complaint.
 *
 * Anchors are the `id` attributes rendered by the page. `links.test.ts` keeps
 * the guide anchors in step with `GUIDE`, and the routes in step with `NAV`.
 */
export const APP_ROUTES: Record<string, readonly string[]> = {
  "/dashboard": [],
  "/tasks": [],
  "/calendar": [],
  "/rundown": [],
  "/jobs": [],
  "/prospects": [],
  "/links": [],
  "/budget": [],
  "/members": [],
  "/events": [],
  "/roles": [],
  "/faq": [],
  "/privacy": [],
  "/terms": [],
  "/panduan": [
    "alur",
    "panduan-lengkap",
    // One per GUIDE section, so "how do I use Violet" can land on the Violet
    // section of the guide rather than on a menu that does not exist.
    "guide-dashboard",
    "guide-tasks",
    "guide-members",
    "guide-calendar",
    "guide-rundown",
    "guide-jobs",
    "guide-prospects",
    "guide-links",
    "guide-budget",
    "guide-events",
    "guide-roles",
    "guide-violet",
    "guide-settings",
  ],
  "/settings": [
    "akun",
    "backend",
    "arsip",
    "demo",
    "backup",
    "akses",
    "changelog",
    "sumber",
  ],
};

/** The guide section keys that have a real menu of their own. */
const GUIDE_KEY_TO_ROUTE: Record<string, string> = {
  dashboard: "/dashboard",
  tasks: "/tasks",
  members: "/members",
  calendar: "/calendar",
  rundown: "/rundown",
  jobs: "/jobs",
  prospects: "/prospects",
  links: "/links",
  budget: "/budget",
  events: "/events",
  roles: "/roles",
  settings: "/settings",
  // NOTE: "violet" is deliberately absent. Violet is a floating button, not a
  // page, and pretending otherwise is the exact bug this module fixes.
};

/** Split "/settings#changelog" into its parts, tolerating junk. */
function splitHref(href: string): { path: string; hash: string } | null {
  const raw = (href ?? "").trim();
  // Absolute URLs, protocol-relative URLs and mailto: are all out of scope:
  // Violet only ever points inside this app.
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  const [pathAndQuery, ...rest] = raw.split("#");
  const path = pathAndQuery.split("?")[0].replace(/\/+$/, "") || "/";
  return { path, hash: rest.join("#").trim() };
}

/**
 * Return a link that is safe to show, or `undefined` when there is none.
 *
 * A known path with an unknown anchor degrades to the bare path rather than
 * being thrown away: landing at the top of the right page still helps, and the
 * model does invent plausible-looking anchors.
 */
export function resolveHref(href: string | undefined | null): string | undefined {
  if (!href) return undefined;
  const parts = splitHref(href);
  if (!parts) return undefined;
  const anchors = APP_ROUTES[parts.path];
  if (!anchors) return undefined;
  return parts.hash && anchors.includes(parts.hash)
    ? `${parts.path}#${parts.hash}`
    : parts.path;
}

/** True when a path (with or without an anchor) is somewhere real. */
export const isKnownHref = (href: string | undefined | null): boolean =>
  resolveHref(href) !== undefined;

/**
 * The best link for a guide section: its own menu when it has one, otherwise
 * the section inside Panduan. Never a made-up path.
 */
export function guideHref(key: string): string {
  const menu = GUIDE_KEY_TO_ROUTE[key];
  if (menu) return menu;
  const anchor = `guide-${key}`;
  return APP_ROUTES["/panduan"].includes(anchor) ? `/panduan#${anchor}` : "/panduan";
}

/**
 * The list handed to the model so it stops inventing paths.
 *
 * Only the anchor-bearing ones are spelled out with their anchors: for the
 * rest the bare path is the whole answer.
 */
export function routeCatalogue(): string {
  // One line, not one per route. Every character here is paid for on every
  // question, and the free tiers Violet runs on are metered by the minute in
  // tokens, so the prompt earns its length or it goes.
  const plain = Object.entries(APP_ROUTES)
    .filter(([, anchors]) => !anchors.length)
    .map(([path]) => path)
    .join(", ");
  // Anchored routes are written out IN FULL, even though "#a #b" would be
  // shorter. The model has to reproduce the whole path, and handing it the
  // anchors detached from their page is an invitation to emit a bare "#akses".
  const anchored = Object.entries(APP_ROUTES)
    .filter(([, anchors]) => anchors.length)
    .map(([path, anchors]) => anchors.map((a) => `${path}#${a}`).join(" "))
    .join("\n");
  return `${plain}\n${anchored}`;
}
