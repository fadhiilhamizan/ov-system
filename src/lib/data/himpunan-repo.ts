import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import { readRows } from "./read";
import { reorderVia } from "./repo";
import { HMSI_DEPARTMENTS } from "../constants";
import type { CompareEntry, CompareSubject, FgdPlan, FgdRow } from "../types";

// ============================================================
// Data layer for the Himpunan menu (FGD plotting + Compare).
//
// Its own module rather than more lines in repo.ts, same reasoning as
// developer-repo.ts: repo.ts is already 1000+ lines carrying the whole product,
// and these tables arrive with migration 0040 so they have no local-JSON
// counterpart. Reads go through `readRows` (data/read.ts), which degrades to an
// empty list when the migration has not been applied - the demo project is
// pinned well below 0040 - and throws for anything else. It used to swallow
// EVERY error, so a lost connection and an edition with no plotting yet looked
// exactly alike on screen.
//
// Every write goes through `must()`-style error surfacing: a silent write
// failure is the single most expensive bug this project has had.
// ============================================================

const sb = () => createClient();

function must<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// ---------------- FGD ----------------

export const getFgdPlans = cache(async (eventId: string): Promise<FgdPlan[]> => {
  return readRows<FgdPlan[]>(
    "fgd plans",
    (await sb()).from("fgd_plans").select("*").eq("event_id", eventId).order("order"),
    [],
  );
});

/** Every row for an edition's plans, keyed by plan id (one round trip). */
export const getFgdRows = cache(async (eventId: string): Promise<Record<string, FgdRow[]>> => {
  const client = await sb();
  const plans = await readRows<{ id: string }[]>(
    "fgd plan ids",
    client.from("fgd_plans").select("id").eq("event_id", eventId),
    [],
  );
  const ids = plans.map((p) => p.id);
  if (!ids.length) return {};
  const rows = await readRows<FgdRow[]>(
    "fgd rows",
    client.from("fgd_rows").select("*").in("plan_id", ids).order("order"),
    [],
  );
  const byPlan: Record<string, FgdRow[]> = {};
  for (const r of rows) (byPlan[r.plan_id] ??= []).push(r);
  return byPlan;
});

/**
 * Create a table, pre-filled with the ten HMSI departments.
 *
 * The seeding is the point: a blank two-column grid means typing the same ten
 * department names every time, and the left column is the one part of this
 * table that is the same for every Ormawa Visit. They stay editable afterwards.
 */
export async function createFgdPlan(input: {
  event_id: string; title?: string; partner_name?: string;
}): Promise<string | null> {
  const client = await sb();
  // ONE transaction, in the database (migration 0045). It used to be two round
  // trips - insert the plan, then insert its ten rows - each its own
  // transaction, so a failure on the second left an empty FGD card behind with
  // nothing to roll it back. Same reasoning as restore_snapshot in 0043.
  //
  // The department names travel as an argument rather than living in the SQL,
  // so HMSI_DEPARTMENTS stays the only place they are written down.
  const id = must(
    await client.rpc("create_fgd_plan", {
      p_event_id: input.event_id,
      p_title: input.title ?? "",
      p_partner: input.partner_name ?? "",
      p_rows: HMSI_DEPARTMENTS,
    }),
  ) as string | null;
  return id ?? null;
}

export async function updateFgdPlan(id: string, patch: Partial<FgdPlan>) {
  const { id: _drop, ...rest } = patch;
  void _drop;
  const { error } = await (await sb()).from("fgd_plans").update(rest).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFgdPlan(id: string) {
  // fgd_rows follow via ON DELETE CASCADE.
  const { error } = await (await sb()).from("fgd_plans").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createFgdRow(planId: string) {
  const client = await sb();
  const rows = await readRows<{ order: number }[]>(
    "fgd row order",
    client.from("fgd_rows").select("order").eq("plan_id", planId),
    [],
  );
  const nextOrder = Math.max(0, ...rows.map((r) => r.order + 1));
  const { error } = await client
    .from("fgd_rows").insert({ plan_id: planId, ours: "", theirs: "", order: nextOrder });
  if (error) throw new Error(error.message);
}

export async function updateFgdRow(id: string, patch: { ours?: string; theirs?: string }) {
  const { error } = await (await sb()).from("fgd_rows").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFgdRow(id: string) {
  const { error } = await (await sb()).from("fgd_rows").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Persist a drag-and-drop reorder of one table's rows.
 *
 * Goes through the same `reorder_rows` RPC as the RAB and the FAQ (0044, with
 * the `fgd_rows` branch added in 0047): one statement, so a ten-row table is
 * one round trip instead of ten UPDATEs that can each fail on their own and
 * leave the table half-renumbered.
 */
export async function reorderFgdRows(orderedIds: string[]) {
  if (!orderedIds.length) return;
  await reorderVia("fgd_rows", orderedIds);
}

// ---------------- Compare ----------------
// A subject is one association being weighed up (created deliberately from the
// button); its assessments (compare_entries) hang off it via subject_id.

export const getCompareSubjects = cache(async (eventId: string): Promise<CompareSubject[]> => {
  return readRows<CompareSubject[]>(
    "compare subjects",
    (await sb()).from("compare_subjects").select("*").eq("event_id", eventId).order("order"),
    [],
  );
});

/**
 * Add a subject.
 *
 * The unique indexes in 0041 forbid a duplicate (same prospect, or same name)
 * per edition, so a double-click or a stale button can't create two cards for
 * one association - the second insert is rejected at the database.
 */
export async function createCompareSubject(input: {
  event_id: string; prospect_id: string | null; org_name: string;
}): Promise<string | null> {
  const client = await sb();
  const rows = await readRows<{ order: number }[]>(
    "compare subject order",
    client.from("compare_subjects").select("order").eq("event_id", input.event_id),
    [],
  );
  const nextOrder = Math.max(0, ...rows.map((r) => r.order + 1));
  const data = await must(
    await client.from("compare_subjects")
      .insert({ ...input, order: nextOrder }).select("id").single(),
  ) as { id: string } | null;
  return data?.id ?? null;
}

export async function deleteCompareSubject(id: string) {
  // compare_entries follow via ON DELETE CASCADE.
  const { error } = await (await sb()).from("compare_subjects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export const getCompareEntries = cache(async (eventId: string): Promise<CompareEntry[]> => {
  return readRows<CompareEntry[]>(
    "compare entries",
    (await sb()).from("compare_entries").select("*").eq("event_id", eventId).order("order"),
    [],
  );
});

/**
 * Add an assessment to a subject.
 *
 * `subject_id` is required in the signature, not merely non-null in practice.
 * It used to be `Omit<CompareEntry, ...>`, whose `subject_id` is nullable for
 * pre-0041 rows, and the query defended itself with `?? ""` - an empty string
 * compared against a uuid column, which Postgres rejects outright. The error
 * was dropped along with the rest of the result, so the ordering read came back
 * empty and every assessment quietly landed at position zero.
 */
export async function createCompareEntry(
  input: Omit<CompareEntry, "id" | "order"> & { subject_id: string },
) {
  const client = await sb();
  const rows = await readRows<{ order: number }[]>(
    "compare entry order",
    client.from("compare_entries").select("order").eq("subject_id", input.subject_id),
    [],
  );
  const nextOrder = Math.max(0, ...rows.map((r) => r.order + 1));
  const { error } = await client.from("compare_entries").insert({ ...input, order: nextOrder });
  if (error) throw new Error(error.message);
}

export async function updateCompareEntry(id: string, patch: Partial<CompareEntry>) {
  const { id: _drop, ...rest } = patch;
  void _drop;
  const { error } = await (await sb()).from("compare_entries").update(rest).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCompareEntry(id: string) {
  const { error } = await (await sb()).from("compare_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
