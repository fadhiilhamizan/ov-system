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

/** Remove a division, keeping the rest in order. */
export function withDivisionRemoved(
  m: Pick<Member, "division" | "divisions">,
  key: DivisionKey,
): DivisionKey[] {
  return memberDivisions(m).filter((d) => d !== key);
}

/**
 * The coordinator names of a division. Stored on the team row as a
 * comma-joined display name (a division may have none - that's valid).
 */
export function coordinatorNames(team?: Pick<Team, "coordinator">): string[] {
  return (team?.coordinator ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when this member is the coordinator of the given division's team. */
export function isCoordinator(m: Pick<Member, "name" | "nickname">, team?: Pick<Team, "coordinator">): boolean {
  const names = coordinatorNames(team).map((n) => n.toLowerCase());
  if (!names.length) return false;
  return names.includes(memberLabel(m).toLowerCase()) || names.includes((m.name ?? "").toLowerCase());
}
