// ============================================================
// Application version — scheme: v1.x.y
//
//   1  MAJOR  → LOCKED. Do not change (product convention).
//   x  MINOR  → bump for a big/feature update  (reset y to 0).
//   y  PATCH  → bump for a small fix/tweak.
//
// AI / maintainer note: whenever you ship a change, bump this version,
// add a matching entry at the TOP of src/lib/changelog.ts, and keep the
// footer (src/components/layout/app-shell.tsx reads APP_VERSION) in sync.
// The version is a NUMBER only — no codename.
// See AGENTS.md → "Versioning".
// ============================================================
export const APP_VERSION = "1.13.0";
