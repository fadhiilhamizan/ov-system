"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isDeveloper } from "@/lib/developers";
import {
  deleteError, pruneActivity, pruneErrors, reportError, setErrorResolved, touchPresence,
} from "@/lib/data/developer-repo";
import { parse, presenceSchema, errorReportSchema, pruneSchema, idNumberSchema } from "./schemas";

// ============================================================
// Actions behind the hidden /developer route, plus the two beacons that feed it.
//
// The beacons (presence, error reports) are called by EVERY signed-in account,
// not only developers - a "who is online" list that only lists developers, or an
// error log that only records the developer's own crashes, would be useless.
// The reads are the part that is developer-only, and that is enforced by RLS
// rather than here.
// ============================================================

type Result = { ok: true } | { ok: false; error: string };
type CountResult = { ok: true; count: number } | { ok: false; error: string };

/** Gate for everything that READS or manages developer data. */
async function guard(): Promise<Result> {
  const user = await getCurrentUser();
  // Same wording as any other refusal. Never "you are not a developer": that
  // confirms the concept exists to anyone who pokes at the action.
  if (!isDeveloper(user)) return { ok: false, error: "Aksi tidak tersedia." };
  return { ok: true };
}

/**
 * Heartbeat from an open tab.
 *
 * Deliberately silent about failure: it runs on a timer in everybody's browser,
 * and a toast saying "presence failed" would be noise about a feature they
 * cannot see. Guests are skipped - the anonymous identity is shared, so every
 * Tamu in the world would collapse into one row that means nothing.
 */
export async function heartbeatAction(path: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role === "guest" || !user.email) return;
  const v = parse(presenceSchema, { path });
  if (!v.ok) return;
  try {
    await touchPresence(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      v.data.path,
    );
  } catch {
    // Never surface: see above.
  }
}

/**
 * File an error seen in a browser.
 *
 * Open to every signed-in account on purpose, because the errors worth knowing
 * about are the ones OTHER people hit. The database caps it at 20 per account
 * per minute so an open tab in a crash loop cannot fill the table.
 */
export async function reportErrorAction(input: {
  kind?: "client" | "boundary";
  message: string;
  stack?: string;
  path?: string;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role === "guest") return;
  const v = parse(errorReportSchema, input);
  if (!v.ok) return;
  try {
    const h = await headers();
    await reportError({
      kind: v.data.kind ?? "client",
      message: v.data.message,
      stack: v.data.stack,
      path: v.data.path,
      // Read server-side rather than trusted from the payload: the client has
      // no reason to be the authority on which browser it is.
      userAgent: h.get("user-agent") ?? "",
    });
  } catch {
    // A failed error report must never itself become an error.
  }
}

export async function resolveErrorAction(id: number, resolved: boolean): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const v = parse(idNumberSchema, id);
  if (!v.ok) return v;
  try {
    await setErrorResolved(v.data, resolved);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
  revalidatePath("/developer");
  return { ok: true };
}

export async function deleteErrorAction(id: number): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  const v = parse(idNumberSchema, id);
  if (!v.ok) return v;
  try {
    await deleteError(v.data);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghapus." };
  }
  revalidatePath("/developer");
  return { ok: true };
}

export async function pruneActivityAction(days: number): Promise<CountResult> {
  const g = await guard();
  if (!g.ok) return g;
  const v = parse(pruneSchema, { days });
  if (!v.ok) return v;
  try {
    const count = await pruneActivity(v.data.days);
    revalidatePath("/developer");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memangkas." };
  }
}

export async function pruneErrorsAction(days: number): Promise<CountResult> {
  const g = await guard();
  if (!g.ok) return g;
  const v = parse(pruneSchema, { days });
  if (!v.ok) return v;
  try {
    const count = await pruneErrors(v.data.days);
    revalidatePath("/developer");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memangkas." };
  }
}
