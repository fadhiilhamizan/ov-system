import type { Division, Task } from "./types";

// ============================================================
// Pure filtering helpers for the Work Breakdown toolbar.
//
// Kept out of the components so the awkward cases - a task whose division was
// deleted, a PIC field holding two names - are covered by tests rather than by
// hoping the JSX got it right.
// ============================================================

/** Division-focus value meaning "tasks that belong to no division at all". */
export const NO_DIVISION = "__none__";
/** PIC-focus value meaning "tasks with nobody assigned". */
export const NO_PIC = "__none__";

/**
 * The people named in a task's `pic`.
 *
 * The column is free text and has always allowed several names separated by
 * commas (Job Hari-H renders it that way too), so a task assigned to
 * "Ali, Budi" has to match a filter on either of them.
 */
export function taskPicList(pic: string | null | undefined): string[] {
  return (pic ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Every distinct PIC across the given tasks, sorted for a stable menu. */
export function picOptions(tasks: readonly Task[]): string[] {
  const seen = new Map<string, string>();
  for (const t of tasks) {
    for (const name of taskPicList(t.pic)) {
      // Case-insensitive de-dupe, but keep the first spelling seen.
      const k = name.toLowerCase();
      if (!seen.has(k)) seen.set(k, name);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "id"));
}

/**
 * Does this task belong to the focused division?
 *
 * `NO_DIVISION` covers both a blank division and one pointing at a division
 * that no longer exists - otherwise those tasks are unreachable from the
 * toolbar, which is exactly what happens after a division is deleted.
 */
export function matchesDivision(
  task: Task,
  focus: string,
  divisionKeys: ReadonlySet<string>,
): boolean {
  if (focus === "all") return true;
  const orphan = !task.division || !divisionKeys.has(task.division);
  return focus === NO_DIVISION ? orphan : task.division === focus;
}

/** Does this task match the ticked PICs? An empty selection means "no filter". */
export function matchesPics(task: Task, picked: ReadonlySet<string>): boolean {
  if (picked.size === 0) return true;
  const names = taskPicList(task.pic);
  if (names.length === 0) return picked.has(NO_PIC);
  // Compare case-insensitively so "budi" and "Budi" are the same person.
  return names.some((n) => picked.has(n.toLowerCase()));
}

/** Divisions that actually have somewhere to show - used to build the menu. */
export function divisionKeySet(divisions: readonly Division[]): Set<string> {
  return new Set(divisions.map((d) => d.key));
}

/** True when any task has no usable division, so the menu only offers the
 *  "Tanpa divisi" option when it would actually match something. */
export function hasOrphanTasks(
  tasks: readonly Task[],
  divisionKeys: ReadonlySet<string>,
): boolean {
  return tasks.some((t) => !t.division || !divisionKeys.has(t.division));
}
