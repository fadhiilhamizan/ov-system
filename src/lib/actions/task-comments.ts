"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createTaskComment, deleteTaskComment, getTask, getTaskComment, setTaskCommentResolved,
} from "@/lib/data/repo";
import { idSchema, parse, replyTaskCommentSchema, startTaskCommentSchema } from "./schemas";
import { archivedGuard, errMsg } from "./lock";

// ============================================================
// Comments on a Work Breakdown task (migration 0049).
//
// The conversation has exactly two shapes and they have DIFFERENT permissions,
// which is the whole reason this is four actions rather than one:
//
//   root  ("komentar inisiasi") - admin / koordinator / staff. It is an
//         instruction attached to a task, and it is what raises the
//         notification badge on the Work Breakdown row.
//   reply - every writing role, interns included. An intern is meant to answer
//         a revision request; they are just not the one who files it.
//
// Both go through `archivedGuard` on the PARENT TASK's edition: a comment has
// no edition of its own, so the task is the only thing that knows whether this
// write lands in an archive. RLS (0049) mirrors all of it as the second layer.
// ============================================================

type Result = { ok: true } | { ok: false; error: string };

/** Start a new thread on a task. */
export async function startTaskCommentAction(input: {
  task_id: string;
  body: string;
}): Promise<Result> {
  const v = parse(startTaskCommentSchema, input);
  if (!v.ok) return v;

  const user = await getCurrentUser();
  if (!can.startTaskComment(user)) {
    return {
      ok: false,
      error: "Hanya admin, koordinator, dan staff yang bisa menambah catatan baru. Kamu tetap bisa membalas catatan yang sudah ada.",
    };
  }
  const task = await getTask(v.data.task_id);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };
  const blocked = await archivedGuard(user, task.event_id);
  if (blocked) return blocked;

  try {
    await createTaskComment({
      task_id: task.id,
      parent_id: null,
      body: v.data.body,
      author_id: user.id,
      author_name: user.name,
      author_role: user.role,
    });
  } catch (e) {
    return errMsg(e, "Gagal menyimpan catatan.");
  }
  revalidateEntities("taskComments");
  return { ok: true };
}

/**
 * Reply inside an existing thread.
 *
 * `parent_id` must be a ROOT. Threads are deliberately one level deep - a
 * "chat kecil" with nested branches is unreadable in a popover the size of
 * this one, and the notification count would have to walk a tree to know
 * whether a task still has something open. A self-referencing CHECK cannot
 * express "my parent has no parent", so the rule lives here; the worst a
 * forged `parent_id` can do is be refused.
 *
 * A resolved thread still accepts replies, on purpose: ticking it closes the
 * notification, it does not close the conversation.
 */
export async function replyTaskCommentAction(input: {
  parent_id: string;
  body: string;
}): Promise<Result> {
  const v = parse(replyTaskCommentSchema, input);
  if (!v.ok) return v;

  const user = await getCurrentUser();
  if (!can.replyTaskComment(user)) {
    return { ok: false, error: "Kamu tidak punya akses membalas catatan tugas." };
  }
  const parent = await getTaskComment(v.data.parent_id);
  if (!parent) return { ok: false, error: "Catatan tidak ditemukan." };
  if (parent.parent_id) {
    return { ok: false, error: "Balasan hanya bisa ditujukan ke catatan utama." };
  }
  const task = await getTask(parent.task_id);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };
  const blocked = await archivedGuard(user, task.event_id);
  if (blocked) return blocked;

  try {
    await createTaskComment({
      task_id: parent.task_id,
      parent_id: parent.id,
      body: v.data.body,
      author_id: user.id,
      author_name: user.name,
      author_role: user.role,
    });
  } catch (e) {
    return errMsg(e, "Gagal mengirim balasan.");
  }
  revalidateEntities("taskComments");
  return { ok: true };
}

/** Tick a thread as finished (closing the task's notification), or re-open it. */
export async function setTaskCommentResolvedAction(
  id: string,
  resolved: boolean,
): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;

  const user = await getCurrentUser();
  if (!can.resolveTaskComment(user)) {
    return { ok: false, error: "Kamu tidak punya akses menutup catatan ini." };
  }
  const comment = await getTaskComment(idv.data);
  if (!comment) return { ok: false, error: "Catatan tidak ditemukan." };
  // A reply has no state of its own to tick - `resolved` describes the thread,
  // and a DB CHECK refuses the write anyway. Saying so beats an RLS-shaped
  // error the user cannot act on.
  if (comment.parent_id) {
    return { ok: false, error: "Hanya catatan utama yang bisa ditandai selesai." };
  }
  const task = await getTask(comment.task_id);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };
  const blocked = await archivedGuard(user, task.event_id);
  if (blocked) return blocked;

  try {
    await setTaskCommentResolved(comment.id, resolved, resolved ? user.name : "");
  } catch (e) {
    return errMsg(e, "Gagal memperbarui catatan.");
  }
  revalidateEntities("taskComments");
  return { ok: true };
}

/** Remove one message. Deleting a thread root takes its replies with it. */
export async function deleteTaskCommentAction(id: string): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;

  const user = await getCurrentUser();
  const comment = await getTaskComment(idv.data);
  if (!comment) return { ok: false, error: "Catatan tidak ditemukan." };
  if (!can.deleteTaskComment(user, comment.author_id)) {
    return { ok: false, error: "Kamu hanya bisa menghapus catatanmu sendiri." };
  }
  const task = await getTask(comment.task_id);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };
  const blocked = await archivedGuard(user, task.event_id);
  if (blocked) return blocked;

  try {
    await deleteTaskComment(comment.id);
  } catch (e) {
    return errMsg(e, "Gagal menghapus catatan.");
  }
  revalidateEntities("taskComments");
  return { ok: true };
}
