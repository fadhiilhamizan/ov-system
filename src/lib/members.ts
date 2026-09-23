// ============================================================
// Member ↔ division helpers.
//
// A member may belong to MORE THAN ONE division (`Member.divisions`). The
// legacy single `Member.division` column is kept in sync as the "primary"
// division (= divisions[0]) so older readers - the division badge in tables,
// task PIC scoping, seeds - keep working.
//
// Plain module (no "use client"): imported from both Server and Client
// Components.
// ============================================================
import type { DivisionKey, Member, Team } from "./types";

/** Every division a member belongs to, newest model first, legacy as fallback. */
export function memberDivisions(m: Pick<Member, "division" | "divisions">): DivisionKey[] {
  const list = (m.divisions ?? []).map((d) => (d ?? "").trim()).filter(Boolean);
  if (list.length) return [...new Set(list)];
  const legacy = (m.division ?? "").trim();
  return legacy ? [legacy] : [];
}

/** The division shown when only one fits (badge in a table row, task scoping). */
export function primaryDivision(m: Pick<Member, "division" | "divisions">): DivisionKey | null {
  return memberDivisions(m)[0] ?? null;
}

export function memberInDivision(m: Pick<Member, "division" | "divisions">, key: DivisionKey): boolean {
  return memberDivisions(m).includes(key);
}

/** Members of one division, in roster order, optionally filtered by type. */
export function divisionMembers(
  members: Member[],
  key: DivisionKey,
  type?: Member["type"],
): Member[] {
  return members.filter((m) => memberInDivision(m, key) && (!type || m.type === type));
}

/** Display label used everywhere a member appears as a chip / comma token. */
export const memberLabel = (m: Pick<Member, "name" | "nickname">) => m.nickname || m.name;

/**
 * Normalise what a form sends into the pair the store persists: the array plus
 * the legacy primary column. Keeps the two from drifting apart.
 */
export function divisionFields(divisions: DivisionKey[] | undefined, fallback?: DivisionKey | null) {
  const list = [...new Set((divisions ?? []).map((d) => (d ?? "").trim()).filter(Boolean))];
  if (!list.length && fallback) list.push(fallback);
  return { divisions: list, division: list[0] ?? null };
}

/**
 * Add a division to a member without disturbing the ones they already have.
 *
 * Appended, never prepended: `divisions[0]` is the PRIMARY division (the badge
 * in tables, task scoping), so putting the new key first would silently
 * re-label everyone you added. A member with no divisions yet gets this one as
 * their primary, which is the only sensible answer.
 *
 * Returns the same array when nothing changes, so callers can skip the write.
 */
export function withDivisionAdded(
  m: Pick<Member, "division" | "divisions">,
  key: DivisionKey,
): DivisionKey[] {
  const current = memberDivisions(m);
  return current.includes(key) ? current : [...current, key];
}

/**
 * Split a stored roster string into display names.
 *
 * The separator is not just a comma. These strings were typed by hand long
 * before member assignment existed, and the ones in the database separate names
 * with a comma, a middle dot, or two spaces, in any combination. Three call
 * sites had each grown their own copy of this regex, and `coordinatorNames` was
 * the odd one out: it split on the comma alone, so a pair joined by a middle
 * dot came back as ONE name that matched nobody on the roster.
 */
export function splitRoster(s: string | null | undefined): string[] {
  return (s ?? "")
    .split(/\s{2,}|,|·/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * The coordinator names of a division. Stored on the team row as a joined
 * display name (a division may have none - that's valid).
 */
export function coordinatorNames(team?: Pick<Team, "coordinator">): string[] {
  return splitRoster(team?.coordinator);
}

/** True when this member is the coordinator of the given division's team. */
export function isCoordinator(m: Pick<Member, "name" | "nickname">, team?: Pick<Team, "coordinator">): boolean {
  const names = coordinatorNames(team).map((n) => n.toLowerCase());
  if (!names.length) return false;
  return names.includes(memberLabel(m).toLowerCase()) || names.includes((m.name ?? "").toLowerCase());
}

// ------------------------------------------------------------------
// People are stored BY NAME in four places: a task's PIC, a Hari-H job's PIC,
// a prospect's PIC and a team's coordinator. There is no member id behind any
// of them (the comma-joined format predates the roster, and the pickers keep
// it so hand-typed names survive). So a change on the roster has to be carried
// into those strings explicitly, or they silently stop matching anybody: the
// picker shows the old spelling as a stray free-text chip, and the division
// card stops recognising its own coordinator. See docs/INTEGRATION.md.
// ------------------------------------------------------------------

const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Rewrite the tokens of a stored roster string that name `from` so they name
 * `to` instead. Returns the new string, or null when nothing was renamed (so
 * the caller can skip the write, and never rewrites a row just to normalise its
 * separators).
 */
export function renameInRoster(
  value: string | null | undefined,
  from: string[],
  to: string,
): string | null {
  const olds = new Set(from.map(lower).filter(Boolean));
  const target = to.trim();
  if (!olds.size || !target) return null;
  let renamed = false;
  const out: string[] = [];
  for (const tok of splitRoster(value)) {
    const next = olds.has(tok.toLowerCase()) ? target : tok;
    if (next !== tok) renamed = true;
    // Renaming "Budi" to "Andi" in "Andi, Budi" must not leave "Andi, Andi".
    if (!out.some((x) => x.toLowerCase() === next.toLowerCase())) out.push(next);
  }
  return renamed ? out.join(", ") : null;
}

/** Drop the tokens naming any of `names`. Null when nothing was removed. */
export function removeFromRoster(value: string | null | undefined, names: string[]): string | null {
  const drop = new Set(names.map(lower).filter(Boolean));
  const tokens = splitRoster(value);
  const kept = tokens.filter((tok) => !drop.has(tok.toLowerCase()));
  return kept.length === tokens.length ? null : kept.join(", ");
}

/** What a roster change means for the by-name references elsewhere. */
export interface MemberRipple {
  /** Rewrite these tokens to `to` in every PIC and coordinator of the edition. */
  rename: { from: string[]; to: string } | null;
  /** Take this person off the coordinator line of these divisions ("all" =
   *  every division of the edition, used when the member is deleted). */
  unseat: { divisions: DivisionKey[] | "all"; names: string[] } | null;
}

/**
 * Plan the knock-on writes of editing (`after`) or deleting (`after === null`)
 * one member.
 *
 * A name that another member of the same edition also answers to is left
 * alone, in both directions: rewriting "Budi" everywhere because ONE of two
 * Budis changed his nickname would reassign the other one's tasks. Ambiguous
 * tokens were ambiguous before the edit too; the picker already shows them as
 * matching both people.
 *
 * PIC fields are deliberately NOT cleared on delete. A finished task still
 * names who did it; the picker keeps an unknown name as a free-text chip, so
 * nothing is lost and nothing is reassigned behind anyone's back. The
 * coordinator line is different: it claims a CURRENT role, and the division
 * card prints it under "Koordinator".
 */
export function memberRipple(before: Member, after: Member | null, roster: Member[]): MemberRipple {
  const others = roster.filter((m) => m.id !== before.id);
  const taken = (n: string) =>
    others.some((m) => lower(memberLabel(m)) === lower(n) || lower(m.name) === lower(n));
  const names = (list: (string | null | undefined)[]) =>
    [...new Set(list.map((s) => (s ?? "").trim()).filter(Boolean))].filter((n) => !taken(n));

  if (!after) {
    const all = names([memberLabel(before), before.name]);
    return { rename: null, unseat: all.length ? { divisions: "all", names: all } : null };
  }

  const to = memberLabel(after).trim();
  // Only a real name change ripples. Editing an NRP must not quietly rewrite
  // every task that still spells this person by their full name.
  const nameChanged =
    lower(memberLabel(before)) !== lower(to) || lower(before.name) !== lower(after.name);
  const from = nameChanged
    ? names([memberLabel(before), before.name]).filter((n) => lower(n) !== lower(to))
    : [];
  const rename = to && from.length && !taken(to) ? { from, to } : null;

  // Leaving a division, or stepping down to intern, ends a coordinator seat:
  // the coordinator is always a FUNGSIONARIS OF THAT division. Divisions they
  // never belonged to are left alone - legacy rosters name coordinators who
  // were never assigned on their roster row, and that is not this edit's call.
  const kept = new Set(memberDivisions(after));
  const lost = after.type === "intern" && before.type !== "intern"
    ? memberDivisions(before)
    : memberDivisions(before).filter((d) => !kept.has(d));
  const who = names([memberLabel(before), before.name, memberLabel(after), after.name]);
  const unseat = lost.length && who.length ? { divisions: lost, names: who } : null;

  return { rename, unseat };
}

/**
 * Who the PIC picker offers for a task in `key`, in two parts.
 *
 * `inDivision` is the answer to the question the picker is actually asking, and
 * it is what the division card shows: everyone whose roster row carries this
 * division, plus its coordinator. The coordinator is there because the card
 * prints them under "Koordinator" whether or not their roster row was ever
 * assigned to the division, and a name you can see listed under a division but
 * cannot pick as its PIC reads as the feature being broken.
 *
 * `others` is the rest of the edition's roster. Scoping the list to one
 * division is a convenience, not a rule: a member with no division filled in
 * yet, or someone genuinely helping another division, must still be
 * assignable - refusing to is how "not all members appear" happens, whatever
 * put the roster in that state.
 */
export function splitForDivision(
  members: Member[],
  key: DivisionKey,
  team?: Pick<Team, "coordinator">,
): { inDivision: Member[]; others: Member[] } {
  const inDivision: Member[] = [];
  const others: Member[] = [];
  for (const m of members) {
    if (memberInDivision(m, key) || isCoordinator(m, team)) inDivision.push(m);
    else others.push(m);
  }
  return { inDivision, others };
}
