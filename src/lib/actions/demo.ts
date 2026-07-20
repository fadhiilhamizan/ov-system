"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COOKIE, demoActive } from "@/lib/demo";
import { DEMO_EVENT_ID as EV, demoSeed, angkatanFromNrpNum } from "@/lib/demo-seed-data";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Reset the DEMO sandbox to its initial mockup data. Gated to demo mode — the
 * server Supabase client only points at the demo project when the ov_demo
 * cookie is set, and we double-check `demoActive` so this can never touch
 * production. The event row itself is kept; all its data is wiped and re-seeded.
 */
export async function resetDemoDataAction(): Promise<Result> {
  const store = await cookies();
  if (!demoActive(store.get(DEMO_COOKIE)?.value)) {
    return { ok: false, error: "Reset hanya tersedia di Mode Demo." };
  }
  const sb = await createClient();

  // 1) Wipe every data table (demo DB holds only demo data). Keep the event row.
  const tables = [
    "teams", "job_harih", "rundown", "budget_items", "budget_plans",
    "links", "prospects", "tasks", "members", "divisions",
  ];
  for (const tbl of tables) {
    const { error } = await sb.from(tbl).delete().not("id", "is", null);
    if (error) return { ok: false, error: `Gagal mengosongkan ${tbl}: ${error.message}` };
  }

  // 2) Re-seed.
  await sb.from("divisions").insert(
    demoSeed.divisions.map(([key, name, short, color, order, excl]) => ({
      event_id: EV, key, name, short, color, order, exclude_from_rundown: excl,
    })),
  );
  await sb.from("members").insert(
    demoSeed.members.map(([name, nickname, nrp, type, division]) => ({
      event_id: EV, name, nickname, nrp, type, year: angkatanFromNrpNum(nrp), division,
    })),
  );

  const noByDiv: Record<string, number> = {};
  await sb.from("tasks").insert(
    demoSeed.tasks.map(([division, title, pic, status, start, end]) => {
      noByDiv[division] = (noByDiv[division] ?? 0) + 1;
      return {
        event_id: EV, division, no: String(noByDiv[division]), pic, title,
        start_date: start, end_date: end, status,
      };
    }),
  );

  const { data: plan } = await sb.from("budget_plans")
    .insert({ name: "RAB Ormawa Visit Demo", event_id: EV }).select("id").single();
  if (plan) {
    await sb.from("budget_items").insert(
      demoSeed.budgetItems.map(([category, name, qty, unit, unit_price], i) => ({
        plan_id: plan.id, category, name, qty, unit, unit_price,
        total: qty * unit_price, order: i,
      })),
    );
  }

  await sb.from("rundown").insert(
    demoSeed.rundown.map(([time_start, time_end, activity, keterangan], i) => ({
      event_id: EV, variant: "A", no: i + 1, time_start, time_end,
      activity, keterangan, division_jobs: {},
    })),
  );
  await sb.from("job_harih").insert(
    demoSeed.jobs.map(([job, pic], i) => ({ event_id: EV, no: String(i + 1), job, pic })),
  );
  await sb.from("teams").insert(
    demoSeed.teams.map(([division, fungsionaris, intern]) => ({
      event_id: EV, division, coordinator: "", fungsionaris, intern,
    })),
  );
  await sb.from("prospects").insert(
    demoSeed.prospects.map(([org_name, campus, pic, contact_status, their_response], i) => ({
      event_id: EV, batch: "Demo", no: String(i + 1), org_name, campus, pic,
      contact_status, their_response, source: "demo",
    })),
  );
  await sb.from("links").insert(
    demoSeed.links.map(([section, division, name, url]) => ({
      event_id: EV, section, division, name, url, source: "demo",
    })),
  );

  revalidatePath("/", "layout");
  return { ok: true };
}
