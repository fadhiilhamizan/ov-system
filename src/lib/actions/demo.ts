"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { DEMO_COOKIE, demoActive } from "@/lib/demo";
import { DEMO_EVENT_ID as EV, DEMO_EVENT, demoSeed, angkatanFromNrpNum } from "@/lib/demo-seed-data";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Reset the DEMO sandbox to its initial mockup data. Gated to demo mode - the
 * server Supabase client only points at the demo project when the ov_demo
 * cookie is set, and we double-check `demoActive` so this can never touch
 * production. Everything - including any OVs the user created - is wiped, then
 * the single demo Ormawa Visit and its data are re-created.
 */
export async function resetDemoDataAction(): Promise<Result> {
  const store = await cookies();
  if (!demoActive(store.get(DEMO_COOKIE)?.value)) {
    return { ok: false, error: "Reset hanya tersedia di Mode Demo." };
  }
  // Pengaturan is now readable by coordinator/staff/intern, so this destructive
  // action needs its own admin check - opening the page is not permission to
  // wipe it.
  if (!can.manageBackups(await getCurrentUser())) {
    return { ok: false, error: "Kamu tidak punya akses untuk ini." };
  }
  const sb = await createClient();

  // 1) Wipe every data table (demo DB holds only demo data). task_links go with
  //    tasks via ON DELETE CASCADE.
  const tables = [
    "teams", "job_harih", "rundown", "budget_items", "budget_plans",
    "links", "prospects", "tasks", "members", "divisions",
  ];
  for (const tbl of tables) {
    const { error } = await sb.from(tbl).delete().not("id", "is", null);
    if (error) return { ok: false, error: `Gagal mengosongkan ${tbl}: ${error.message}` };
  }
  // Also remove any OVs the user created; keep only the demo edition, and
  // upsert it back so the re-seed below always has an event to attach to.
  {
    const { error } = await sb.from("events").delete().neq("id", EV);
    if (error) return { ok: false, error: `Gagal mengosongkan events: ${error.message}` };
    const { error: upErr } = await sb.from("events").upsert(DEMO_EVENT, { onConflict: "id" });
    if (upErr) return { ok: false, error: `Gagal menyiapkan edisi demo: ${upErr.message}` };
  }

  // 2) Re-seed. Every insert is checked: an ignored error (a column the demo
  //    project's schema hasn't caught up on, for instance) used to report a
  //    successful reset while quietly leaving the table empty.
  let failure: string | null = null;
  const seed = async (table: string, rows: Record<string, unknown>[]) => {
    if (failure) return;
    const { error } = await sb.from(table).insert(rows);
    if (error) failure = `Gagal mengisi ${table}: ${error.message}`;
  };

  await seed("divisions",
    demoSeed.divisions.map(([key, name, short, color, order, excl]) => ({
      event_id: EV, key, name, short, color, order, exclude_from_rundown: excl,
    })),
  );
  await seed("members",
    demoSeed.members.map(([name, nickname, nrp, type, divisions]) => ({
      event_id: EV, name, nickname, nrp, type, year: angkatanFromNrpNum(nrp),
      divisions: [...divisions], division: divisions[0],
    })),
  );

  const noByDiv: Record<string, number> = {};
  await seed("tasks",
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
    await seed("budget_items",
      demoSeed.budgetItems.map(([category, name, qty, unit, unit_price], i) => ({
        plan_id: plan.id, category, name, qty, unit, unit_price,
        total: qty * unit_price, order: i,
      })),
    );
  }

  await seed("rundown",
    demoSeed.rundown.map(([time_start, time_end, activity, keterangan], i) => ({
      event_id: EV, variant: "A", no: i + 1, time_start, time_end,
      activity, keterangan, division_jobs: {},
    })),
  );
  await seed("job_harih",
    demoSeed.jobs.map(([job, pic], i) => ({ event_id: EV, no: String(i + 1), job, pic })),
  );
  await seed("teams",
    // fungsionaris/intern are derived from members.divisions now - the legacy
    // columns stay empty so nothing reads a stale second copy of the roster.
    demoSeed.teams.map(([division, coordinator]) => ({
      event_id: EV, division, coordinator, fungsionaris: "", intern: "",
    })),
  );
  await seed("prospects",
    demoSeed.prospects.map(([org_name, campus, pic, contact_status, their_response], i) => ({
      event_id: EV, no: String(i + 1), org_name, campus, pic,
      contact_status, their_response, source: "demo",
    })),
  );
  await seed("links",
    demoSeed.links.map(([section, division, name, url]) => ({
      event_id: EV, section, division, name, url, source: "demo",
    })),
  );

  if (failure) return { ok: false, error: failure };

  revalidatePath("/", "layout");
  return { ok: true };
}
