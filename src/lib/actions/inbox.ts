"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  createBroadcast, deleteBroadcast, getAccounts, getBroadcast, markInboxAllRead,
  setInboxRead, syncBroadcastRecipients, updateBroadcast,
} from "@/lib/data/repo";
import { broadcastSchema, idSchema, parse } from "./schemas";
import { errMsg } from "./lock";
import type { Account, BroadcastAudience, Role } from "@/lib/types";

// ============================================================
// Kotak Masuk: broadcasts an admin sends to people's inboxes.
//
// No archive guard anywhere in this file, and that is deliberate. Every other
// write path in this app is scoped to an Ormawa Visit and has to refuse when
// that edition is archived. A broadcast is addressed to ACCOUNTS, and an
// account belongs to no edition (see AGENTS.md), so there is no edition to
// check and archiving one must not silence the inbox.
//
// The recipient list is resolved HERE, once, at send time - not stored as a
// rule and re-evaluated on read. See migration 0050 for why.
// ============================================================

type Result = { ok: true } | { ok: false; error: string };

/**
 * Turn the chosen audience into the actual list of account ids.
 *
 * "all" and "role" are resolved against the live account list rather than
 * trusting anything the browser sent: the composer shows the same list, but
 * the payload it posts is not where the truth about who exists lives.
 */
function resolveRecipients(
  accounts: Account[],
  audience: BroadcastAudience,
  roles: Role[],
  userIds: string[],
): string[] {
  if (audience === "all") return accounts.map((a) => a.id);
  if (audience === "role") {
    const wanted = new Set(roles);
    return accounts.filter((a) => wanted.has(a.role)).map((a) => a.id);
  }
  // "accounts": keep only ids that name a real account, so a stale pick from a
  // form left open does not create a recipient row pointing at nobody.
  const known = new Set(accounts.map((a) => a.id));
  return userIds.filter((id) => known.has(id));
}

export async function createBroadcastAction(input: {
  title: string;
  body: string;
  audience: BroadcastAudience;
  roles?: Role[];
  user_ids?: string[];
}): Promise<Result> {
  const user = await getCurrentUser();
  if (!can.manageBroadcasts(user)) {
    return { ok: false, error: "Hanya admin yang bisa mengirim siaran." };
  }
  const v = parse(broadcastSchema, input);
  if (!v.ok) return v;

  try {
    const accounts = await getAccounts();
    const recipients = resolveRecipients(
      accounts, v.data.audience, v.data.roles as Role[], v.data.user_ids,
    );
    if (!recipients.length) {
      // Refused rather than saved-and-delivered-to-nobody. An empty result
      // here means the chosen roles match no account at all, which the admin
      // cannot see from the composer and would otherwise read as "sent".
      return { ok: false, error: "Tidak ada akun yang cocok dengan tujuan itu, jadi siaran tidak dikirim." };
    }
    const id = await createBroadcast({
      title: v.data.title,
      body: v.data.body,
      audience: v.data.audience,
      roles: v.data.roles,
      created_by: user.id,
      created_by_name: user.name,
    });
    if (id) await syncBroadcastRecipients(id, recipients);
  } catch (e) {
    return errMsg(e, "Gagal mengirim siaran.");
  }
  revalidateEntities("inbox");
  return { ok: true };
}

/**
 * Edit a broadcast, including who it goes to.
 *
 * Re-targeting keeps the rows of people who already had it, so an edit never
 * marks a message unread again for somebody who already read it - see
 * `syncBroadcastRecipients`.
 */
export async function updateBroadcastAction(
  id: string,
  input: {
    title: string;
    body: string;
    audience: BroadcastAudience;
    roles?: Role[];
    user_ids?: string[];
  },
): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const user = await getCurrentUser();
  if (!can.manageBroadcasts(user)) {
    return { ok: false, error: "Hanya admin yang bisa mengubah siaran." };
  }
  const v = parse(broadcastSchema, input);
  if (!v.ok) return v;

  const existing = await getBroadcast(idv.data);
  if (!existing) return { ok: false, error: "Siaran tidak ditemukan." };

  try {
    const accounts = await getAccounts();
    const recipients = resolveRecipients(
      accounts, v.data.audience, v.data.roles as Role[], v.data.user_ids,
    );
    if (!recipients.length) {
      return { ok: false, error: "Tidak ada akun yang cocok dengan tujuan itu, jadi siaran tidak diubah." };
    }
    await updateBroadcast(idv.data, {
      title: v.data.title,
      body: v.data.body,
      audience: v.data.audience,
      roles: v.data.roles,
    });
    await syncBroadcastRecipients(idv.data, recipients);
  } catch (e) {
    return errMsg(e, "Gagal mengubah siaran.");
  }
  revalidateEntities("inbox");
  return { ok: true };
}

export async function deleteBroadcastAction(id: string): Promise<Result> {
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const user = await getCurrentUser();
  if (!can.manageBroadcasts(user)) {
    return { ok: false, error: "Hanya admin yang bisa menghapus siaran." };
  }
  const existing = await getBroadcast(idv.data);
  if (!existing) return { ok: false, error: "Siaran tidak ditemukan." };
  try {
    await deleteBroadcast(idv.data);
  } catch (e) {
    return errMsg(e, "Gagal menghapus siaran.");
  }
  revalidateEntities("inbox");
  return { ok: true };
}

/**
 * Mark one of MY messages read or unread.
 *
 * Deliberately takes no user id: it always acts on the caller's own row, so
 * there is no parameter anyone could point at somebody else's inbox. The
 * database agrees separately - `broadcast_recipients` only grants UPDATE on
 * `read_at`, and only for rows whose `user_id` is the caller.
 */
export async function setInboxReadAction(broadcastId: string, read: boolean): Promise<Result> {
  const idv = parse(idSchema, broadcastId);
  if (!idv.ok) return idv;
  const user = await getCurrentUser();
  // A guest shares one anonymous identity, so "my inbox" is not a thing that
  // means anything for them.
  if (user.role === "guest") {
    return { ok: false, error: "Masuk dengan akunmu dulu untuk memakai Kotak Masuk." };
  }
  try {
    await setInboxRead(idv.data, user.id, read);
  } catch (e) {
    return errMsg(e, "Gagal memperbarui status pesan.");
  }
  revalidateEntities("inbox");
  return { ok: true };
}

export async function markAllInboxReadAction(): Promise<Result> {
  const user = await getCurrentUser();
  if (user.role === "guest") {
    return { ok: false, error: "Masuk dengan akunmu dulu untuk memakai Kotak Masuk." };
  }
  try {
    await markInboxAllRead(user.id);
  } catch (e) {
    return errMsg(e, "Gagal menandai semua pesan.");
  }
  revalidateEntities("inbox");
  return { ok: true };
}
