"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can, requestableRolesFor } from "@/lib/permissions";
import {
  createRoleRequest, decideRoleRequest, getRoleRequestsFor, updateRoleRequest,
} from "@/lib/data/repo";
import type { RequestableRole } from "@/lib/types";
import { roleRequestSchema, idSchema, parse } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };

const errMsg = (e: unknown) =>
  e instanceof Error ? `Gagal memproses: ${e.message}` : "Gagal memproses permintaan peran.";

export interface RoleRequestInput {
  requested_role: RequestableRole;
  message?: string;
}

/**
 * Submit a role request. Open to any real account except an admin — a role-less
 * account asks for its first role, and an account that already has one can ask
 * to be moved up or down. Nobody can request `admin`, and nobody can request
 * the role they already hold (see `requestableRolesFor`).
 */
export async function requestRoleAction(input: RoleRequestInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user.email || user.id === "guest") {
    return { ok: false, error: "Masuk dengan akun (email atau Google) dulu untuk mengajukan peran." };
  }

  const v = parse(roleRequestSchema, input);
  if (!v.ok) return v;

  const allowed = requestableRolesFor(user);
  if (!allowed.length) {
    return { ok: false, error: "Peran akun ini tidak bisa diubah lewat pengajuan." };
  }
  if (!allowed.includes(v.data.requested_role)) {
    return { ok: false, error: "Kamu sudah punya peran itu. Pilih peran yang berbeda." };
  }

  // One open request at a time (the DB enforces this too with a partial unique
  // index) — an existing one should be EDITED, not duplicated.
  const mine = await getRoleRequestsFor(user.id);
  if (mine.some((r) => r.status === "pending")) {
    return { ok: false, error: "Pengajuan kamu masih menunggu keputusan admin. Ubah pengajuan itu saja." };
  }

  try {
    await createRoleRequest({
      user_id: user.id,
      name: user.name,
      email: user.email,
      requested_role: v.data.requested_role,
      message: v.data.message ?? "",
    });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Edit your own still-pending request — for fixing a wrong role choice or a
 * typo before an admin decides. Decided requests are immutable; to change an
 * approved role you file a new request.
 */
export async function updateRoleRequestAction(id: string, input: RoleRequestInput): Promise<Result> {
  const user = await getCurrentUser();
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(roleRequestSchema, input);
  if (!v.ok) return v;

  const allowed = requestableRolesFor(user);
  if (!allowed.includes(v.data.requested_role)) {
    return { ok: false, error: "Kamu sudah punya peran itu. Pilih peran yang berbeda." };
  }

  // Ownership + still-pending are re-checked here (and again by RLS) so one
  // account can never rewrite another's request.
  const mine = await getRoleRequestsFor(user.id);
  const target = mine.find((r) => r.id === idv.data);
  if (!target) return { ok: false, error: "Pengajuan tidak ditemukan." };
  if (target.status !== "pending") {
    return { ok: false, error: "Pengajuan ini sudah diputuskan dan tidak bisa diubah." };
  }

  try {
    await updateRoleRequest(idv.data, {
      requested_role: v.data.requested_role,
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

/** Ignore a request (leaves the current role untouched) — admin only. */
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
