"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createRoleRequest, decideRoleRequest, getRoleRequestsFor } from "@/lib/data/repo";
import type { RequestableRole } from "@/lib/types";
import { roleRequestSchema, idSchema, parse } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };

const errMsg = (e: unknown) =>
  e instanceof Error ? `Gagal memproses: ${e.message}` : "Gagal memproses permintaan peran.";

export interface RoleRequestInput {
  requested_role: RequestableRole;
  division?: string;
  event_id?: string;
  message?: string;
}

/**
 * Submit a role request. Only for real, signed-up accounts that currently have
 * no role: an anonymous "Tamu" session has nothing to promote, and someone who
 * already holds a role should ask an admin to change it directly.
 */
export async function requestRoleAction(input: RoleRequestInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user.email || user.id === "guest") {
    return { ok: false, error: "Masuk dengan akun (email atau Google) dulu untuk mengajukan peran." };
  }
  if (user.role !== "guest") {
    return { ok: false, error: "Akun kamu sudah punya peran. Hubungi admin untuk mengubahnya." };
  }

  const v = parse(roleRequestSchema, input);
  if (!v.ok) return v;

  // One open request at a time (the DB enforces this too with a partial
  // unique index — check here so the user gets a readable message).
  const mine = await getRoleRequestsFor(user.id);
  if (mine.some((r) => r.status === "pending")) {
    return { ok: false, error: "Pengajuan kamu masih menunggu keputusan admin." };
  }

  try {
    await createRoleRequest({
      user_id: user.id,
      name: user.name,
      email: user.email,
      requested_role: v.data.requested_role,
      division: v.data.division || null,
      event_id: v.data.event_id || null,
      message: v.data.message ?? "",
    });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Approve a request (grants the role) — admin only. */
export async function approveRoleRequestAction(id: string): Promise<Result> {
  return decide(id, true);
}

/** Ignore a request (leaves the account as a guest) — admin only. */
export async function ignoreRoleRequestAction(id: string): Promise<Result> {
  return decide(id, false);
}

async function decide(id: string, approve: boolean): Promise<Result> {
  if (!can.manageRoleRequests(await getCurrentUser())) {
    return { ok: false, error: "Kamu tidak punya akses untuk ini." };
  }
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  try {
    await decideRoleRequest(idv.data, approve);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
