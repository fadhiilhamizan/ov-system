import type { Prospect } from "./types";

// ============================================================
// Pure helpers for the Himpunan menu.
//
// Kept out of the components so the one rule that actually gates a feature -
// "Compare only opens when more than one association said yes" - is testable
// rather than an expression buried in JSX.
// ============================================================

/** How Reach & Offer spells an acceptance in `their_response`. */
const ACCEPTED = "DITERIMA";

/**
 * The associations that ACCEPTED our invitation, for this edition.
 *
 * Matched case-insensitively and trimmed: `their_response` is a free-text
 * column that has held legacy values from the spreadsheet import, so an exact
 * `=== "DITERIMA"` would silently drop rows that read "diterima".
 */
export function acceptedProspects(prospects: readonly Prospect[]): Prospect[] {
  return prospects.filter((p) => (p.their_response ?? "").trim().toUpperCase() === ACCEPTED);
}

/**
 * Is there anything to compare?
 *
 * Comparing needs at least two candidates: with one acceptance there is no
 * choice to make, and the feature would be an empty ritual. The page explains
 * this rather than hiding the tab, so nobody wonders where it went.
 */
export function canCompare(prospects: readonly Prospect[]): boolean {
  return acceptedProspects(prospects).length > 1;
}
