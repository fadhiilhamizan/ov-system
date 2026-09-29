// ============================================================
// Super Link ownership.
//
// A Super Link entry is either typed in by hand ("manual", or an older import
// source) or PUBLISHED by a task result / prospect link, which then owns it:
// the owner rebuilds it on every save and deletes it when unpublished. See
// AGENTS.md ("A link that can be published to Super Link…") and
// docs/INTEGRATION.md.
//
// Plain module (no "use client"): the Super Link page renders the owner badge
// and the actions enforce what an owned entry may change.
// ============================================================
import type { LinkItem } from "./types";

/** `links.source` values written by an owner, with the menu that owns them. */
export const LINK_OWNERS = {
  task: "Work Breakdown",
  prospect: "Reach & Offer",
} as const;

export type LinkOwner = keyof typeof LINK_OWNERS;

/** True when a task result or a prospect owns this entry. */
export function isOwnedLink(link: Pick<LinkItem, "source">): boolean {
  return link.source === "task" || link.source === "prospect";
}

/** The menu that owns an entry, or null for a hand-made one. */
export function linkOwnerMenu(link: Pick<LinkItem, "source">): string | null {
  return isOwnedLink(link) ? LINK_OWNERS[link.source as LinkOwner] : null;
}
