import { APP_TIME_ZONE } from "./format";
import type { TaskComment, TaskCommentThread } from "./types";

// ============================================================
// Pure helpers for a task's comment threads (Work Breakdown).
//
// The server hands back ONE flat list per task - roots and replies mixed,
// oldest first - because that is one query instead of two. Everything that
// turns it into a conversation lives here, so the table cell, the popover and
// the edit dialog all group it the same way and there is one place to test.
// ============================================================

/**
 * Group a flat comment list into threads, oldest root first, replies in order.
 *
 * An ORPHANED reply (its root deleted, or simply not in this slice) is dropped
 * rather than promoted to a root. Promoting it would invent a thread nobody
 * started - and since a root is what raises the notification badge, it would
 * light a task up over a message with no question attached to it. The database
 * cascades replies with their root, so in practice this only guards a stale
 * client snapshot.
 */
export function toThreads(comments: TaskComment[] | undefined): TaskCommentThread[] {
  if (!comments?.length) return [];
  const byRoot = new Map<string, TaskCommentThread>();
  for (const c of comments) {
    if (!c.parent_id) byRoot.set(c.id, { root: c, replies: [] });
  }
  for (const c of comments) {
    if (c.parent_id) byRoot.get(c.parent_id)?.replies.push(c);
  }
  return [...byRoot.values()];
}

/**
 * How many threads on this task are still open.
 *
 * This is the notification count on the Work Breakdown row: zero means no
 * badge at all. A thread that has been ticked off is finished business - it
 * stays readable from the Edit dialog, it just stops asking for attention.
 */
export function openThreadCount(comments: TaskComment[] | undefined): number {
  if (!comments?.length) return 0;
  return comments.filter((c) => !c.parent_id && !c.resolved).length;
}

/** Total messages in a thread, root included - what the "N balasan" line counts. */
export function threadSize(thread: TaskCommentThread): number {
  return thread.replies.length + 1;
}

/**
 * Open threads first, then the finished ones; each group newest-first.
 *
 * What is still being asked belongs at the top, and within a group the most
 * recent conversation is the one somebody is actually in the middle of.
 */
export function sortThreads(threads: TaskCommentThread[]): TaskCommentThread[] {
  return [...threads].sort((a, b) => {
    if (a.root.resolved !== b.root.resolved) return a.root.resolved ? 1 : -1;
    return (b.root.created_at ?? "").localeCompare(a.root.created_at ?? "");
  });
}

// A timestamp is rendered on BOTH sides of hydration, so the timezone has to be
// pinned or the server (UTC) and the browser (WIB) disagree by seven hours and
// React throws the subtree away - see lib/no-host-timezone.test.ts. Built once:
// a comment list can be dozens of rows.
const STAMP = new Intl.DateTimeFormat("id-ID", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * "14 Sep 2026, 13.56" - when a message was sent.
 *
 * Absolute, not relative ("2 jam lalu"): a relative label is computed from
 * `Date.now()`, which is a different instant on the server than in the browser,
 * so it is a hydration mismatch waiting to happen and it goes stale on a page
 * that is left open.
 */
export function formatCommentTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return STAMP.format(d);
}
