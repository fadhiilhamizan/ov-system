// ============================================================
// Super Link entries as the reference picker shows them.
//
// `links.division` stores a division KEY, and a division created in the app
// gets a generated key such as "DIV-MSNZZKHR-5C1LAH". The picker used to print
// that key verbatim, so a result published from a task in such a division
// reached every other task as unreadable text. The name has to be looked up,
// and it has to be looked up in the RIGHT edition: since 0018 a key is only
// unique per Ormawa Visit.
//
// Plain module (no "use client"): the task pages build the options on the
// server and the picker only filters and sorts them.
// ============================================================
import type { Division, LinkItem, OVEvent } from "./types";

/** A Super Link entry plus what the picker needs to label, filter and sort it. */
export interface SuperLinkOption extends LinkItem {
  /** Readable division name, or "" when it cannot be resolved. Never a raw generated key. */
  division_name: string;
  /** Title of the Ormawa Visit the entry belongs to, "" for an unscoped entry. */
  event_title: string;
  /** Sort key for "newest Ormawa Visit first" (see `eventRecencyKey`). */
  event_rank: string;
}

/** A key the app generated, as opposed to a short code a person typed. */
const GENERATED_KEY = /^div-[a-z0-9]+-[a-z0-9]+$/i;

/**
 * The division name for a Super Link entry.
 *
 * Tries the entry's own edition first, then any edition (older rows and the
 * cross-edition imports stored the key without caring which one), then a
 * name match (legacy free text such as "Liaison Officer"). What is left is
 * shown as typed, unless it is a generated key: that means the division was
 * deleted, and an unreadable code is worse than no label at all.
 */
export function divisionLabel(
  link: Pick<LinkItem, "division" | "event_id">,
  divisions: Division[],
): string {
  const raw = (link.division ?? "").trim();
  if (!raw) return "";
  const norm = raw.toLowerCase();
  const byKey = (d: Division) => d.key.toLowerCase() === norm;
  const hit =
    divisions.find((d) => byKey(d) && d.event_id === link.event_id) ??
    divisions.find(byKey) ??
    divisions.find((d) => d.name.trim().toLowerCase() === norm);
  if (hit) return hit.name;
  return GENERATED_KEY.test(raw) ? "" : raw;
}

/**
 * A string that sorts editions oldest -> newest.
 *
 * The date is the event date, else the planned start or end. An edition with
 * no date yet is one still being planned, so it counts as the newest. Ties
 * (and the undated group) fall back to the manual `order`, zero-padded so the
 * whole key compares as a plain string. A single string rather than a
 * comparator with fallbacks, because a comparator that compares dates when
 * both have one and `order` otherwise is not transitive, and Array.sort
 * returns garbage for those.
 */
export function eventRecencyKey(event: Pick<OVEvent, "event_date" | "plan_start" | "plan_end" | "order"> | undefined): string {
  if (!event) return "";
  const date = event.event_date || event.plan_start || event.plan_end || "9999-12-31";
  return `${date}#${String(Math.max(0, event.order ?? 0)).padStart(6, "0")}`;
}

/** Attach the readable division, the edition title and its recency to each entry. */
export function describeSuperLinks(
  links: LinkItem[],
  events: OVEvent[],
  divisions: Division[],
): SuperLinkOption[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  return links
    .filter((l) => l.url)
    .map((l) => {
      const ev = l.event_id ? byId.get(l.event_id) : undefined;
      return {
        ...l,
        division_name: divisionLabel(l, divisions),
        event_title: ev?.title ?? "",
        event_rank: eventRecencyKey(ev),
      };
    });
}

export const SUPER_LINK_SORTS = ["event-desc", "event-asc", "name-asc", "name-desc"] as const;
export type SuperLinkSort = (typeof SUPER_LINK_SORTS)[number];

const byName = (a: SuperLinkOption, b: SuperLinkOption) =>
  a.name.localeCompare(b.name, "id", { sensitivity: "base" }) || a.id.localeCompare(b.id);

/**
 * Sort a copy of the options. Edition sorts keep entries of one edition
 * together (alphabetical inside it) so the picker can print a header per
 * edition; unscoped entries go last either way.
 */
export function sortSuperLinks(options: SuperLinkOption[], sort: SuperLinkSort): SuperLinkOption[] {
  const out = [...options];
  if (sort === "name-asc") return out.sort(byName);
  if (sort === "name-desc") return out.sort((a, b) => byName(b, a));
  const dir = sort === "event-desc" ? -1 : 1;
  return out.sort((a, b) => {
    if (!a.event_rank !== !b.event_rank) return a.event_rank ? -1 : 1;
    if (a.event_rank !== b.event_rank) return a.event_rank < b.event_rank ? -dir : dir;
    // Same rank but different editions (only possible for two undated ones
    // with the same order): keep each edition in one block.
    const ev = (a.event_id ?? "").localeCompare(b.event_id ?? "");
    return ev || byName(a, b);
  });
}

/** Free-text match over everything the picker shows for an entry. */
export function matchesSuperLink(option: SuperLinkOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [option.name, option.section, option.division_name, option.note, option.event_title]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
