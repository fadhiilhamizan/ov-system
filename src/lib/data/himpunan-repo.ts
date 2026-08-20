import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import { HMSI_DEPARTMENTS } from "../constants";
import type { CompareEntry, CompareSubject, FgdPlan, FgdRow } from "../types";

// ============================================================
// Data layer for the Himpunan menu (FGD plotting + Compare).
//
// Its own module rather than more lines in repo.ts, same reasoning as
// developer-repo.ts: repo.ts is already 1000+ lines carrying the whole product,
// and these tables arrive with migration 0040 so they have no local-JSON
// counterpart. Reads degrade to an empty list when the migration has not been
// applied, which is what keeps the page rendering instead of throwing.
//
// Every write goes through `must()`-style error surfacing: a silent write
// failure is the single most expensive bug this project has had.
// ============================================================

const sb = () => createClient();

/** The table does not exist yet: 0040 has not been run. */
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

function must<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// ---------------- FGD ----------------

export const getFgdPlans = cache(async (eventId: string): Promise<FgdPlan[]> => {
  const { data, error } = await (await sb())
    .from("fgd_plans").select("*").eq("event_id", eventId).order("order");
  if (error && !isMissing(error)) console.warn("[himpunan] fgd plans:", error.message);
  return (data ?? []) as FgdPlan[];
});

/** Every row for an edition's plans, keyed by plan id (one round trip). */
export const getFgdRows = cache(async (eventId: string): Promise<Record<string, FgdRow[]>> => {
  const client = await sb();
  const { data: plans } = await client.from("fgd_plans").select("id").eq("event_id", eventId);
  const ids = (plans ?? []).map((p: { id: string }) => p.id);
  if (!ids.length) return {};
  const { data, error } = await client
    .from("fgd_rows").select("*").in("plan_id", ids).order("order");
  if (error && !isMissing(error)) console.warn("[himpunan] fgd rows:", error.message);
  const byPlan: Record<string, FgdRow[]> = {};
  for (const r of (data ?? []) as FgdRow[]) (byPlan[r.plan_id] ??= []).push(r);
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
  const { data: existing } = await client
    .from("fgd_plans").select("order").eq("event_id", input.event_id);
  const nextOrder = Math.max(0, ...(existing ?? []).map((p: { order: number }) => p.order + 1));

  const plan = must(
    await client.from("fgd_plans").insert({
      event_id: input.event_id,
      title: input.title ?? "",
      partner_name: input.partner_name ?? "",
      order: nextOrder,
    }).select("id").single(),
  ) as { id: string } | null;
  if (!plan) return null;

  must(
    await client.from("fgd_rows").insert(
      HMSI_DEPARTMENTS.map((dept, i) => ({
        plan_id: plan.id, ours: dept, theirs: "", order: i,
      })),
    ).select("id"),
  );
  return plan.id;
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
  const { data: rows } = await client.from("fgd_rows").select("order").eq("plan_id", planId);
  const nextOrder = Math.max(0, ...(rows ?? []).map((r: { order: number }) => r.order + 1));
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

// ---------------- Compare ----------------
// A subject is one association being weighed up (created deliberately from the
// button); its assessments (compare_entries) hang off it via subject_id.

export const getCompareSubjects = cache(async (eventId: string): Promise<CompareSubject[]> => {
  const { data, error } = await (await sb())
    .from("compare_subjects").select("*").eq("event_id", eventId).order("order");
  if (error && !isMissing(error)) console.warn("[himpunan] compare subjects:", error.message);
  return (data ?? []) as CompareSubject[];
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
  const { data: rows } = await client
    .from("compare_subjects").select("order").eq("event_id", input.event_id);
  const nextOrder = Math.max(0, ...(rows ?? []).map((r: { order: number }) => r.order + 1));
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
  const { data, error } = await (await sb())
    .from("compare_entries").select("*").eq("event_id", eventId).order("order");
  if (error && !isMissing(error)) console.warn("[himpunan] compare:", error.message);
  return (data ?? []) as CompareEntry[];
});

export async function createCompareEntry(input: Omit<CompareEntry, "id" | "order">) {
  const client = await sb();
  const { data: rows } = await client
    .from("compare_entries").select("order").eq("subject_id", input.subject_id ?? "");
  const nextOrder = Math.max(0, ...(rows ?? []).map((r: { order: number }) => r.order + 1));
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
