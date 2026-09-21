import "server-only";
import { ROLE_META, STATUS_META } from "@/lib/constants";
import {
  getEvents, getDivisions, getTasks, getProspects, getProspectLinksByEvent, getLinks,
  getRundown, getJobs, getBudgetPlans, getMembers, getTeams,
  getTaskLinksByEvent, getTaskRefsByEvent, getTaskCommentsByEvent, getRoleRequests, getInbox,
} from "@/lib/data/repo";
import { getCompareEntries, getCompareSubjects, getFgdPlans, getFgdRows } from "@/lib/data/himpunan-repo";
import { getActiveEvent } from "@/lib/session";
import { formatDate, formatRupiah } from "@/lib/format";
import { memberDivisions, memberInDivision } from "@/lib/members";
import { planTotal, primaryBudgetPlan } from "@/lib/budget";
import { toThreads, formatCommentTime } from "@/lib/task-comments";
import type { AppUser, Division, Member, OVEvent, Task, TaskComment } from "@/lib/types";
import type { Passage } from "./retrieve";

// ============================================================
// The live half of Violet's knowledge: the Ormawa Visit on screen, row by row.
//
// WHY ROW BY ROW. The first version emitted ONE passage per module: a single
// "Data: Work Breakdown" paragraph holding every task title. That answers "how
// many tasks are overdue" and nothing else. Ask "when is the deadline for
// Susun konsep acara" and the retriever had to pick that one giant passage out
// of the corpus on the strength of a couple of shared words, and whether it did
// depended on how the question happened to be phrased. That is exactly the
// "sometimes it knows, sometimes it does not" the user reported: the same fact
// was reachable through one wording and not another, because it was buried in a
// passage about eighty other things.
//
// One passage per row fixes both halves at once. A specific question now has a
// specific passage to match, scored on its own words instead of competing with
// its eighty neighbours, and the aggregate summaries stay alongside for the
// counting questions. Retrieval is lexical and offline, so a few hundred extra
// passages cost microseconds and no API calls (see retrieve.ts).
//
// PRIVACY is unchanged: every read goes through the repo, which goes through the
// CALLER's Supabase session, so RLS decides what exists to index. The roster is
// additionally gated by role here, so Violet does not even hint at names it may
// not show.
// ============================================================

/** Roles allowed to see the roster (names + NRP are PII, see migration 0034). */
const CAN_SEE_ROSTER = new Set(["admin", "coordinator", "staff", "intern"]);

/**
 * Join the parts of a sentence, dropping the ones with nothing in them.
 *
 * `number` is accepted because `count && "..."` is the natural way to write a
 * conditional clause here and evaluates to 0, not false, when the list is empty.
 */
const sentence = (...parts: (string | number | false | null | undefined)[]) =>
  parts.filter((p) => typeof p === "string" && p).join(" ");

/** "belum diisi" reads better than an empty gap, and it is also the answer. */
const val = (s: string | null | undefined, empty = "belum diisi") =>
  (s ?? "").trim() || empty;

const statusLabel = (s: string) =>
  STATUS_META[s as keyof typeof STATUS_META]?.label ?? s;

/** Cut a quoted body down to size without slicing a word in half. */
const clip = (text: string, max: number) => {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
};

/** Human date, or a plain "belum ditentukan" that Violet can quote directly. */
const when = (iso: string | null | undefined, raw?: string) =>
  iso ? formatDate(iso, { long: true }) : (raw ?? "").trim() || "belum ditentukan";

/** Look a division up by key, for the name a person would actually say. */
function divName(divisions: Division[], key: string): string {
  const d = divisions.find((x) => x.key === key);
  return d ? `${d.name} (${d.short})` : key || "tanpa divisi";
}

/**
 * One task, with everything anybody asks about it.
 *
 * The synonym run ("deadline, tenggat, batas waktu") is not padding: the
 * retriever is lexical, so a passage is only findable through the words it
 * literally contains, and people ask the same question in all three ways.
 */
function taskPassage(
  t: Task,
  divisions: Division[],
  eventTitle: string,
  refs: string,
  resultLinks: string,
  comments: string,
): Passage {
  return {
    id: `task-${t.id}`,
    parent: "live-tasks",
    source: `Tugas: ${t.title}`,
    href: "/tasks",
    text: sentence(
      `Tugas "${t.title}"${t.no ? ` (nomor ${t.no})` : ""} di divisi ${divName(divisions, t.division)}`,
      `pada Ormawa Visit ${eventTitle}.`,
      `Status tugas: ${statusLabel(t.status)}.`,
      `PIC atau penanggung jawab tugas ini: ${val(t.pic, "belum ada PIC")}.`,
      `Tanggal mulai: ${when(t.start_date, t.start_raw)}.`,
      `Deadline, tenggat, batas waktu, atau tanggal selesai: ${when(t.end_date, t.end_raw)}.`,
      t.status === "overtime" && "Tugas ini overtime: sudah lewat deadline dan belum selesai.",
      t.notes.trim() && `Catatan tugas: ${t.notes.trim()}.`,
      t.result.trim() && `Hasil tugas: ${t.result.trim()}.`,
      resultLinks && `Tautan hasil tugas ini: ${resultLinks}.`,
      refs && `Referensi tugas: ${refs}.`,
      comments,
    ),
  };
}

/**
 * One task's notes, written out as sentences Violet can quote.
 *
 * Spelled out rather than counted, because "apa isi catatan tugas X" is the
 * question people actually ask, and a count answers none of it. The synonym
 * run is the same trick the rest of this file uses: retrieval is lexical, and
 * people say catatan, komentar, diskusi and revisi for the same thing.
 *
 * Only the ACTIVE edition gets this, like every other row-level passage.
 */
function commentsSentence(comments: TaskComment[] | undefined): string {
  const threads = toThreads(comments);
  if (!threads.length) return "";
  const open = threads.filter((th) => !th.root.resolved).length;
  const lines = threads.map((th) => {
    const state = th.root.resolved ? "sudah selesai" : "belum selesai";
    const replies = th.replies.length
      ? ` Balasan: ${th.replies.map((r) => `${r.author_name} menulis "${r.body}"`).join("; ")}.`
      : " Belum ada balasan.";
    return `${th.root.author_name} menulis "${th.root.body}" pada ${formatCommentTime(th.root.created_at)} (${state}).${replies}`;
  });
  return sentence(
    `Tugas ini punya ${threads.length} catatan (komentar, diskusi, revisi),`,
    open ? `${open} di antaranya belum selesai.` : "semuanya sudah ditandai selesai.",
    ...lines,
  );
}

/**
 * What one edition holds, for the editions that are NOT on screen.
 *
 * Rows are only indexed one-by-one for the ACTIVE edition: doing it for all of
 * them would multiply the corpus by the number of Ormawa Visits and let another
 * edition's rows out-score the one being asked about. But "berapa tugas di
 * Ormawa Visit 1 2025" was answered with "I do not know" even though the data
 * was right there, so every edition gets a passage naming its contents.
 */
function editionDataSummary(
  e: OVEvent,
  parts: {
    tasks: Task[];
    divisions: Division[];
    members: Member[];
    prospects: { org_name: string }[];
    rundownCount: number;
    jobCount: number;
    linkCount: number;
    budgetTotal: number;
    canSeeRoster: boolean;
  },
): string {
  const done = parts.tasks.filter((t) => t.status === "done").length;
  const overdue = parts.tasks.filter((t) => t.status === "overtime").length;
  return sentence(
    `Isi data Ormawa Visit ${e.title}:`,
    `${parts.tasks.length} tugas (${done} selesai, ${overdue} overtime),`,
    `${parts.divisions.length} divisi,`,
    parts.canSeeRoster ? `${parts.members.length} anggota,` : "",
    `${parts.prospects.length} prospek himpunan,`,
    `${parts.rundownCount} sesi rundown,`,
    `${parts.jobCount} job hari-H,`,
    `${parts.linkCount} tautan Super Link,`,
    `total anggaran ${formatRupiah(parts.budgetTotal)}.`,
    parts.divisions.length && `Divisi: ${parts.divisions.map((d) => d.name).join(", ")}.`,
    parts.prospects.length &&
      `Prospek: ${parts.prospects.map((p) => p.org_name || "(tanpa nama)").join(", ")}.`,
    parts.tasks.length && `Judul tugas: ${parts.tasks.map((t) => t.title).join("; ")}.`,
  );
}

/** A snapshot of the Ormawa Visit currently on screen. */
export async function livePassages(user: AppUser): Promise<Passage[]> {
  const event = await getActiveEvent();
  if (!event?.id) return [];

  // The roster is PII, so it is read only for roles allowed to see it. Teams
  // ride along because a division's coordinator lives there.
  const canSeeRoster = CAN_SEE_ROSTER.has(user.role);

  // ONE wave. These were three: eight unscoped reads, then six scoped ones,
  // then the roster on its own - so every question paid three round trips of
  // latency end to end where one would do. Nothing here depends on anything
  // else here.
  //
  // The unscoped reads are NOT an oversight, and scoping them would break the
  // corpus: `editionDataSummary` emits a passage per edition listing that
  // edition's task titles, division names and prospect names, so "what is in
  // OV 2025" is answerable while a different edition is open. Only the ACTIVE
  // edition gets row-level passages; the rest get that one summary each.
  //
  // What this does cost is real and worth knowing: the volume grows with every
  // edition ever created, on every question. If that becomes the bottleneck the
  // fix is to summarise old editions from counts rather than full titles, which
  // is a change to what Violet can answer, not a refactor.
  const [
    events, allDivisions, allTasks, allProspects, allLinks, allRundown, allJobs, allPlans,
    refsByTask, resultLinksByTask, commentsByTask, prospectLinksById, fgdPlans, fgdRows,
    compareEntries, compareSubjects,
    allMembers, allTeams, roleRequests, inbox,
  ] = await Promise.all([
    getEvents(), getDivisions(), getTasks(), getProspects(),
    getLinks(), getRundown(), getJobs(), getBudgetPlans(),
    getTaskRefsByEvent(event.id), getTaskLinksByEvent(event.id), getTaskCommentsByEvent(event.id),
    getProspectLinksByEvent(event.id),
    getFgdPlans(event.id), getFgdRows(event.id), getCompareEntries(event.id), getCompareSubjects(event.id),
    canSeeRoster ? getMembers() : [],
    canSeeRoster ? getTeams() : [],
    // Scoped by RLS, not by us: `role_requests_read` is
    // `user_id = auth.uid() or admin`, so an ordinary account gets back only
    // its OWN rows and an admin gets the queue. That is why this is safe to
    // index even though the rows carry names and emails.
    getRoleRequests(),
    // The caller's OWN inbox. A guest shares one anonymous identity, so there
    // is no personal inbox to read and no point asking the database for one.
    user.role === "guest" ? [] : getInbox(user.id),
  ]);

  /** Rows belonging to one edition. Lenient like the repo: an unscoped legacy
   *  row (no event_id) shows up everywhere rather than nowhere. */
  const forEvent = <T extends { event_id?: string | null }>(rows: T[], id: string) =>
    rows.filter((r) => !r.event_id || r.event_id === id);

  const divisions = forEvent(allDivisions, event.id);
  const tasks = forEvent(allTasks, event.id);
  const prospects = forEvent(allProspects, event.id);
  const links = forEvent(allLinks, event.id);
  // No variant filter. 0035 consolidated every row to "A" and deleted the "B"
  // set, and the rundown PAGE renders whatever is there without filtering - so
  // a filter here could only ever hide a row the page still shows.
  const rundown = forEvent(allRundown, event.id);
  const jobs = forEvent(allJobs, event.id);
  const plans = allPlans.filter((p) => p.event_id === event.id);

  const members = forEvent(allMembers, event.id);
  const teams = forEvent(allTeams, event.id);

  const out: Passage[] = [];

  // ---- Ormawa Visit editions ------------------------------------------------

  out.push({
    id: "live-events",
    source: "Data: Daftar Ormawa Visit",
    href: "/events",
    text: sentence(
      `Ada ${events.length} Ormawa Visit (edisi) di sistem:`,
      `${events.map((e) => `${e.title}${e.locked ? " (diarsipkan)" : ""}`).join(", ")}.`,
      `Yang sedang dibuka sekarang: ${event.title}${event.partner ? `, partner ${event.partner}` : ""}${event.event_date ? `, tanggal acara ${formatDate(event.event_date, { long: true })}` : ""}.`,
    ),
  });

  for (const e of events) {
    const eTasks = forEvent(allTasks, e.id);
    const measured =
      e.attendance_hmsi != null ||
      e.feedback_hmsi_count != null ||
      e.feedback_partner_count != null;
    out.push({
      id: `event-${e.id}`,
      parent: "live-events",
      source: `Ormawa Visit: ${e.title}`,
      href: "/events",
      text: sentence(
        `Ormawa Visit "${e.title}"${e.code ? ` dengan kode ${e.code}` : ""}.`,
        `Himpunan partner: ${val(e.partner, "belum ditentukan")}.`,
        `Kampus: ${val(e.campus)}.`,
        `Lokasi: ${val(e.location)}.`,
        `Tipe: ${val(e.type)}. Mode: ${val(e.mode)}.`,
        e.cabinet && `Kabinet: ${e.cabinet}.`,
        `Tanggal acara: ${when(e.event_date)}.`,
        (e.plan_start || e.plan_end) &&
          `Rentang perencanaan: ${when(e.plan_start)} sampai ${when(e.plan_end)}.`,
        `Status: ${val(e.status)}.`,
        e.locked
          ? "Edisi ini DIARSIPKAN, jadi hanya Admin yang bisa mengubah datanya."
          : "Edisi ini masih aktif dan bisa diubah.",
        // Performance Measurement (0029): filled in after the event, shown on
        // the Dashboard. Spelled out so "berapa yang hadir" has a passage.
        measured
          ? sentence(
              "Performance Measurement (hasil evaluasi setelah acara):",
              e.attendance_hmsi != null && `kehadiran fungsionaris HMSI ${e.attendance_hmsi} orang;`,
              e.feedback_hmsi_count != null &&
                `feedback dari HMSI ${e.feedback_hmsi_count} responden${e.feedback_hmsi_rating != null ? `, rata-rata penilaian ${e.feedback_hmsi_rating} dari 5` : ""};`,
              e.feedback_partner_count != null &&
                `feedback dari himpunan partner ${e.feedback_partner_count} responden${e.feedback_partner_rating != null ? `, rata-rata penilaian ${e.feedback_partner_rating} dari 5` : ""};`,
              e.report_url ? `tautan LPJ (laporan pertanggungjawaban): ${e.report_url}.` : "LPJ belum diunggah.",
            )
          : "Performance Measurement (kehadiran, feedback, rating, LPJ) belum diisi untuk edisi ini.",
        editionDataSummary(e, {
          tasks: eTasks,
          divisions: forEvent(allDivisions, e.id),
          members: forEvent(allMembers, e.id),
          prospects: forEvent(allProspects, e.id),
          rundownCount: forEvent(allRundown, e.id).length,
          jobCount: forEvent(allJobs, e.id).length,
          linkCount: forEvent(allLinks, e.id).length,
          // The MAIN plan's total, not every plan added together: two RAB
          // scenarios are two figures for the same money. Same rule the
          // Dashboard uses, so the two can never disagree.
          budgetTotal: planTotal(
            primaryBudgetPlan(allPlans.filter((p) => p.event_id === e.id)) ?? { items: [] },
          ),
          canSeeRoster,
        }),
        e.id === event.id
          ? "Ini adalah Ormawa Visit yang sedang dibuka sekarang, jadi rinciannya per baris juga tersedia."
          : "Edisi ini sedang tidak dibuka. Ganti Ormawa Visit aktif lewat pemilih di bagian atas untuk melihat rinciannya per baris.",
      ),
    });
  }

  // ---- Tasks ---------------------------------------------------------------

  const byStatus = { todo: 0, ongoing: 0, done: 0, overtime: 0 } as Record<string, number>;
  for (const t of tasks) byStatus[t.status]++;
  const overdue = tasks.filter((t) => t.status === "overtime");

  out.push({
    id: "live-tasks",
    source: "Data: Work Breakdown",
    href: "/tasks",
    text: sentence(
      `Ormawa Visit ${event.title} punya ${tasks.length} tugas (WBS, Work Breakdown):`,
      `${Object.entries(byStatus).map(([k, v]) => `${statusLabel(k)} ${v}`).join(", ")}.`,
      overdue.length
        ? `Tugas overtime (lewat deadline dan belum selesai): ${overdue.map((t) => `${t.title}${t.pic ? ` (PIC ${t.pic})` : ""}`).join("; ")}.`
        : "Tidak ada tugas yang overtime.",
      `Judul semua tugas: ${tasks.map((t) => t.title).join("; ")}.`,
    ),
  });

  for (const t of tasks) {
    const refs = (refsByTask[t.id] ?? [])
      .map((r) => `${r.label || r.url} (${r.url})`)
      .join(", ");
    const results = (resultLinksByTask[t.id] ?? [])
      .map((l) => `${l.label || l.url} (${l.url})${l.in_super_link ? ", juga terbit di Super Link" : ""}`)
      .join("; ");
    out.push(taskPassage(t, divisions, event.title, refs, results, commentsSentence(commentsByTask[t.id])));
  }

  // ---- Task notes ----------------------------------------------------------
  // The aggregate half of the same data. "Tugas mana saja yang masih ada
  // catatannya" is a counting question and the per-task passages cannot answer
  // it: each one only knows about itself, and the retriever would have to
  // return all of them at once to add up.
  {
    const withOpen = tasks
      .map((t) => ({ t, open: toThreads(commentsByTask[t.id]).filter((th) => !th.root.resolved) }))
      .filter((x) => x.open.length > 0);
    const totalThreads = Object.values(commentsByTask).reduce((n2, list) => n2 + toThreads(list).length, 0);
    out.push({
      id: "live-task-comments",
      source: "Data: catatan & diskusi tugas",
      href: "/tasks",
      text: sentence(
        `Catatan (komentar, diskusi, revisi) pada tugas Ormawa Visit ${event.title}:`,
        `ada ${totalThreads} catatan di seluruh tugas,`,
        withOpen.length
          ? `dan ${withOpen.length} tugas masih punya catatan yang BELUM selesai: ${withOpen
              .map(({ t, open }) =>
                // The BODY, not just a count. Asked "apa isi catatannya", the
                // retriever picks this summary over the per-task passage (the
                // question's words are all here), and a summary that answers
                // "2 catatan" and nothing else sends the reader back to the UI
                // for something Violet was holding all along. Truncated and
                // roots only: the whole corpus shares one 6,500-char budget.
                `${t.title}${t.pic ? ` (PIC ${t.pic})` : ""} dengan ${open.length} catatan, isinya: ${open
                  .map((th) => `${th.root.author_name} menulis "${clip(th.root.body, 120)}"`)
                  .join(" dan ")}`)
              .join("; ")}.`
          : "tidak ada tugas yang catatannya belum selesai.",
        "Catatan yang sudah ditandai selesai tidak lagi memunculkan lencana notifikasi pada tugasnya, tapi tetap bisa dibaca lewat tombol Edit.",
      ),
    });
  }

  // ---- Divisions -----------------------------------------------------------

  out.push({
    id: "live-divisions",
    source: "Data: Divisi",
    href: "/members",
    text: sentence(
      `Divisi pada ${event.title}: ${divisions.map((d) => `${d.name} (${d.short})`).join(", ") || "belum ada"}.`,
      `Divisi yang tidak diikutsertakan pada rundown: ${divisions.filter((d) => d.exclude_from_rundown).map((d) => d.name).join(", ") || "tidak ada"}.`,
    ),
  });

  for (const d of divisions) {
    const divTasks = tasks.filter((t) => t.division === d.key);
    const done = divTasks.filter((t) => t.status === "done").length;
    const divMembers = members.filter((m) => memberInDivision(m, d.key));
    const coordinator = teams.find((tm) => tm.division === d.key)?.coordinator?.trim();
    out.push({
      id: `division-${d.key}`,
      parent: "live-divisions",
      source: `Divisi: ${d.name}`,
      href: "/members",
      text: sentence(
        `Divisi ${d.name}, disingkat ${d.short}, pada Ormawa Visit ${event.title}.`,
        coordinator
          ? `Koordinator divisi ${d.name}: ${coordinator}.`
          : `Divisi ${d.name} belum punya koordinator.`,
        divMembers.length
          ? `Anggota divisi ${d.name} (${divMembers.length} orang): ${divMembers.map((m) => m.name).join(", ")}.`
          : "",
        `Jumlah tugas divisi ini: ${divTasks.length}, yang sudah selesai ${done}.`,
        divTasks.length && `Tugas divisi ${d.name}: ${divTasks.map((t) => t.title).join("; ")}.`,
        d.exclude_from_rundown
          ? `Divisi ${d.name} tidak dimunculkan sebagai kolom di rundown.`
          : `Divisi ${d.name} punya kolom sendiri di rundown.`,
      ),
    });
  }

  // ---- Members (PII: only for roles that may read the roster) --------------

  if (members.length) {
    out.push({
      id: "live-members",
      source: "Data: Anggota EA",
      href: "/members",
      text: sentence(
        `Ada ${members.length} anggota pada ${event.title}:`,
        `${members.filter((m) => m.type === "fungsionaris").length} fungsionaris,`,
        `${members.filter((m) => m.type === "intern").length} intern.`,
        `Nama: ${members.map((m) => m.name).join(", ")}.`,
      ),
    });

    for (const m of members) {
      const divs = memberDivisions(m).map((k) => divName(divisions, k));
      const isCoord = teams.some(
        (tm) => tm.coordinator?.trim() && tm.coordinator.trim() === m.name.trim(),
      );
      out.push({
        id: `member-${m.id}`,
        parent: "live-members",
        source: `Anggota: ${m.name}`,
        href: "/members",
        text: sentence(
          `${m.name}${m.nickname ? ` (biasa dipanggil ${m.nickname})` : ""} adalah anggota External Affairs pada Ormawa Visit ${event.title}.`,
          `Statusnya ${m.type === "intern" ? "intern (magang)" : "fungsionaris"}.`,
          m.nrp && `NRP: ${m.nrp}.`,
          m.year && `Angkatan: ${m.year}.`,
          divs.length ? `Divisi: ${divs.join(", ")}.` : "Belum punya divisi.",
          isCoord && `${m.name} adalah koordinator divisinya.`,
        ),
      });
    }
  }

  // ---- Reach & Offer -------------------------------------------------------

  if (prospects.length) {
    out.push({
      id: "live-prospects",
      source: "Data: Reach & Offer",
      href: "/prospects",
      text: sentence(
        `Ada ${prospects.length} prospek himpunan pada ${event.title}.`,
        `${prospects.map((p) => `${p.org_name || "(tanpa nama)"}${p.campus ? ` dari ${p.campus}` : ""}${p.their_response ? `, respons ${p.their_response}` : ""}`).join("; ")}.`,
      ),
    });

    for (const p of prospects) {
      const pLinks = (prospectLinksById[p.id] ?? [])
        .map((l) => `${l.label || l.url} (${l.url})${l.in_super_link ? ", juga terbit di Super Link" : ""}`)
        .join("; ");
      out.push({
        id: `prospect-${p.id}`,
        parent: "live-prospects",
        source: `Reach & Offer: ${p.org_name || "(tanpa nama)"}`,
        href: "/prospects",
        text: sentence(
          `Prospek himpunan "${val(p.org_name, "tanpa nama")}"${p.campus ? ` dari kampus ${p.campus}` : ""} pada Ormawa Visit ${event.title}.`,
          p.no && `Nomor urut: ${p.no}.`,
          `PIC yang menghubungi: ${val(p.pic, "belum ada")}.`,
          `Kontak: ${val(p.contact)}.`,
          `Lokasi: ${val(p.location)}. Mode: ${val(p.mode, "belum ditentukan")}.`,
          (p.date_text || p.month) && `Waktu: ${[p.date_text, p.month].filter(Boolean).join(" ")}.`,
          `Status menghubungi: ${val(p.contact_status, "belum dihubungi")}.`,
          `Jawaban mereka: ${val(p.their_response, "belum ada jawaban")}.`,
          `Jawaban kita: ${val(p.our_response, "belum ada jawaban")}.`,
          p.done ? "Prospek ini sudah selesai diproses." : "Prospek ini belum selesai diproses.",
          p.notes?.trim() && `Catatan prospek: ${p.notes.trim()}.`,
          p.is_primary &&
            `Ini adalah data utama Ormawa Visit ${event.title}: himpunan partner yang dipakai edisi ini.`,
          pLinks
            ? `Tautan milik himpunan ini (handbook, profil organisasi, proposal): ${pLinks}.`
            : "Belum ada tautan yang dilampirkan pada prospek ini.",
        ),
      });
    }
  }

  // ---- Rundown -------------------------------------------------------------

  if (rundown.length) {
    out.push({
      id: "live-rundown",
      source: "Data: Rundown",
      href: "/rundown",
      text: sentence(
        `Rundown ${event.title} punya ${rundown.length} sesi:`,
        `${rundown.map((r) => `${r.time_start || "?"}-${r.time_end || "?"} ${r.activity}`).join("; ")}.`,
      ),
    });

    for (const r of rundown) {
      const jobsPerDiv = Object.entries(r.division_jobs ?? {})
        .filter(([, v]) => (v ?? "").trim())
        .map(([k, v]) => `${divName(divisions, k)}: ${v.trim()}`)
        .join("; ");
      out.push({
        id: `rundown-${r.id}`,
        parent: "live-rundown",
        source: `Rundown: ${r.activity || `sesi ${r.no}`}`,
        href: "/rundown",
        text: sentence(
          `Sesi rundown nomor ${r.no}: "${val(r.activity, "belum ada kegiatan")}"`,
          `pada Ormawa Visit ${event.title}.`,
          `Jam mulai ${val(r.time_start, "belum diatur")}, jam selesai ${val(r.time_end, "belum diatur")}${r.duration ? `, durasi ${r.duration}` : ""}.`,
          `MC atau pembawa acara sesi ini: ${val(r.mc, "belum ada")}.`,
          `Kebutuhan operator: ${val(r.operator, "tidak ada")}.`,
          jobsPerDiv && `Tugas tiap divisi pada sesi ini: ${jobsPerDiv}.`,
          r.keterangan?.trim() && `Catatan: ${r.keterangan.trim()}.`,
        ),
      });
    }
  }

  // ---- Job Hari-H ----------------------------------------------------------

  if (jobs.length) {
    out.push({
      id: "live-jobs",
      source: "Data: Job Hari-H",
      href: "/jobs",
      text: `Pembagian tugas hari-H pada ${event.title}: ${jobs.map((j) => `${j.job}${j.pic ? ` (${j.pic})` : ""}`).join("; ")}.`,
    });

    for (const j of jobs) {
      out.push({
        id: `job-${j.id}`,
        parent: "live-jobs",
        source: `Hari-H: ${j.job}`,
        href: "/jobs",
        text: sentence(
          `Job hari-H "${val(j.job, "tanpa nama")}"${j.no ? ` (nomor ${j.no})` : ""} pada Ormawa Visit ${event.title}.`,
          `PIC atau penanggung jawab: ${val(j.pic, "belum ada")}.`,
          j.notes?.trim() && `Catatan: ${j.notes.trim()}.`,
        ),
      });
    }
  }

  // ---- Budget --------------------------------------------------------------

  if (plans.length) {
    // "Berapa anggaran Ormawa Visit ini" has ONE right answer, and it is the
    // main plan's total. Adding the scenarios up used to answer with a number
    // nobody would ever spend, and it grew every time someone drafted another
    // scenario.
    const main = primaryBudgetPlan(plans);
    out.push({
      id: "live-budget",
      source: "Data: Anggaran",
      href: "/budget",
      text: sentence(
        `Anggaran (RAB) ${event.title}: ${plans.length} rencana.`,
        main &&
          `Rencana utama (yang dipakai sebagai angka anggaran edisi ini, tampil juga di Dashboard) adalah "${main.name}", total ${formatRupiah(planTotal(main))}.`,
        plans.length > 1 &&
          "Rencana lain adalah skenario pembanding (misalnya RAB Minimal dan RAB Maksimal), jadi totalnya TIDAK dijumlahkan: anggaran edisi ini adalah total rencana utamanya saja.",
        `${plans.map((p) => `${p.name} (${p.items.length} item, ${formatRupiah(planTotal(p))}${p.id === main?.id ? ", rencana utama" : ""})`).join(", ")}.`,
      ),
    });

    for (const plan of plans) {
      const total = planTotal(plan);
      const byCategory = new Map<string, number>();
      for (const i of plan.items) {
        byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + (i.total ?? 0));
      }
      out.push({
        id: `budget-plan-${plan.id}`,
        parent: "live-budget",
        source: `Anggaran: ${plan.name}`,
        href: "/budget",
        text: sentence(
          `Rencana anggaran (RAB) "${plan.name}" pada Ormawa Visit ${event.title}.`,
          plan.id === main?.id
            ? "Ini rencana UTAMA edisi ini: totalnya yang dipakai sebagai angka anggaran di Dashboard."
            : "Ini bukan rencana utama, jadi totalnya adalah skenario pembanding dan tidak dipakai sebagai angka anggaran edisi.",
          `Total ${formatRupiah(total)} dari ${plan.items.length} item.`,
          byCategory.size &&
            `Per kategori: ${[...byCategory].map(([c, v]) => `${c || "tanpa kategori"} ${formatRupiah(v)}`).join(", ")}.`,
          plan.items.length &&
            `Item: ${plan.items.map((i) => `${i.name} ${formatRupiah(i.total)}`).join("; ")}.`,
        ),
      });

      // Per item, so "berapa harga konsumsi panitia" has something to match on
      // instead of relying on the whole plan being retrieved.
      for (const item of plan.items) {
        out.push({
          id: `budget-item-${item.id}`,
          parent: "live-budget",
          source: `Anggaran: ${item.name}`,
          href: "/budget",
          text: sentence(
            `Item anggaran "${val(item.name, "tanpa nama")}" dalam RAB "${plan.name}" pada Ormawa Visit ${event.title}.`,
            item.category && `Kategori: ${item.category}.`,
            `Jumlah (qty): ${item.qty ?? 0} ${item.unit || "unit"}.`,
            `Harga satuan: ${formatRupiah(item.unit_price)}.`,
            `Total biaya item ini: ${formatRupiah(item.total)}.`,
          ),
        });
      }
    }
  }

  // ---- Himpunan: plotting FGD + Compare -------------------------------------

  if (fgdPlans.length) {
    out.push({
      id: "live-fgd",
      source: "Data: Plotting FGD",
      href: "/himpunan",
      text: sentence(
        `Ada ${fgdPlans.length} tabel plotting FGD pada ${event.title}:`,
        `${fgdPlans.map((p) => `${p.title || "tanpa judul"} dengan ${p.partner_name || "mitra yang belum diisi"}`).join("; ")}.`,
      ),
    });

    for (const plan of fgdPlans) {
      const pairs = (fgdRows[plan.id] ?? [])
        .filter((r) => (r.ours ?? "").trim() || (r.theirs ?? "").trim())
        .map((r) => `${val(r.ours, "belum diisi")} dipasangkan dengan ${val(r.theirs, "belum diisi")}`)
        .join("; ");
      out.push({
        id: `fgd-${plan.id}`,
        parent: "live-fgd",
        source: `Plotting FGD: ${plan.partner_name || plan.title || "tanpa nama"}`,
        href: "/himpunan",
        text: sentence(
          `Tabel plotting Focus Group Discussion (FGD)${plan.title ? ` "${plan.title}"` : ""}`,
          `pada Ormawa Visit ${event.title}.`,
          `Himpunan mitranya: ${val(plan.partner_name, "belum diisi")}.`,
          `Pasangan departemen HMSI ITS dengan departemen mereka: ${pairs || "belum ada yang diisi"}.`,
        ),
      });
    }
  }

  // A compare SUBJECT is an explicit row (0041), not something derived from the
  // entries, so the list of associations being weighed up comes from the
  // subjects. Grouping the entries alone made a subject created from "Buat
  // perbandingan" but not yet filled in invisible to Violet, which is exactly
  // the state it is in right after somebody creates it and asks about it.
  {
    const byOrg = new Map<string, typeof compareEntries>();
    for (const sub of compareSubjects) byOrg.set(sub.org_name || "(tanpa nama)", []);
    for (const e of compareEntries) {
      const key = e.org_name || "(tanpa nama)";
      byOrg.set(key, [...(byOrg.get(key) ?? []), e]);
    }
    if (byOrg.size) {
    out.push({
      id: "live-compare",
      source: "Data: Compare himpunan",
      href: "/himpunan",
      text: sentence(
        `Perbandingan himpunan yang menerima ajakan pada ${event.title}:`,
        `${[...byOrg.keys()].join(", ")}.`,
        `Total ${compareEntries.length} aspek penilaian pada ${byOrg.size} himpunan.`,
        [...byOrg.entries()].filter(([, rows]) => !rows.length).length
          ? `Himpunan yang sudah dibuatkan perbandingan tapi BELUM ada aspek penilaiannya: ${[...byOrg.entries()].filter(([, rows]) => !rows.length).map(([org]) => org).join(", ")}.`
          : "Semua himpunan yang dibandingkan sudah punya aspek penilaian.",
      ),
    });

    for (const [org, rows] of byOrg) {
      out.push({
        id: `compare-${org.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        parent: "live-compare",
        source: `Compare: ${org}`,
        href: "/himpunan",
        text: sentence(
          `Penilaian himpunan ${org} pada Ormawa Visit ${event.title}, dipakai untuk membandingkan calon mitra.`,
          rows.length
            ? rows
              .map((r) =>
                sentence(
                  `Aspek ${val(r.aspect, "tanpa nama")}${r.indicator ? `, indikator yang dinilai: ${r.indicator}` : ""}.`,
                  `Kelebihan atau plus: ${val(r.plus, "belum diisi")}.`,
                  `Kekurangan atau minus: ${val(r.minus, "belum diisi")}.`,
                ),
              )
              .join(" ")
            : "Belum ada satu pun aspek penilaian yang diisi untuk himpunan ini.",
        ),
      });
    }
    }
  }

  // ---- Inbox ---------------------------------------------------------------
  // The caller's own messages, never anybody else's: `getInbox` is keyed on
  // their id and RLS refuses the rest, so an admin asking Violet about their
  // inbox sees their inbox, not everyone's.
  if (inbox.length) {
    const unread = inbox.filter((m) => !m.read_at);
    out.push({
      id: "live-inbox",
      source: "Data: Kotak Masuk",
      href: "/inbox",
      text: sentence(
        "Kotak Masuk (inbox, pesan, pengumuman, siaran) milik akun yang sedang bertanya:",
        `${inbox.length} pesan, ${unread.length} belum dibaca.`,
        unread.length
          ? `Yang belum dibaca: ${unread.map((m) => `"${m.title}" dari ${m.created_by_name || "Admin"} (${formatCommentTime(m.created_at)})`).join("; ")}.`
          : "Semua pesan sudah dibaca.",
        ...inbox.slice(0, 15).map((m) =>
          `Pesan "${m.title}" dari ${m.created_by_name || "Admin"}, dikirim ${formatCommentTime(m.created_at)}, ${m.read_at ? "sudah dibaca" : "belum dibaca"}: ${clip(m.body, 200)}`),
      ),
    });
  }

  // ---- Role requests -------------------------------------------------------
  // NOT edition data: a role is global (see AGENTS.md), so this passage has no
  // Ormawa Visit in it. Worth indexing anyway, because "apakah pengajuan peran
  // saya sudah disetujui" is a question about THIS system that Violet could
  // not answer at all, and the database already decides who sees what: an
  // ordinary account reads only its own rows.
  if (roleRequests.length) {
    const pending = roleRequests.filter((r) => r.status === "pending");
    const mine = roleRequests.filter((r) => r.user_id === user.id);
    const isAdmin = user.role === "admin";
    out.push({
      id: "live-role-requests",
      source: "Data: pengajuan peran (Role Request)",
      href: isAdmin ? "/roles" : "/settings",
      text: sentence(
        "Pengajuan peran (role request, permintaan akses, naik peran):",
        isAdmin
          ? sentence(
              `ada ${roleRequests.length} pengajuan, ${pending.length} di antaranya masih menunggu keputusan.`,
              pending.length
                ? `Yang menunggu: ${pending.map((r) => `${r.name || r.email} mengajukan ${ROLE_META[r.requested_role]?.label ?? r.requested_role}`).join("; ")}.`
                : "Tidak ada yang menunggu keputusan.",
            )
          : sentence(
              `pengajuan milikmu sendiri: ${mine.length} pengajuan.`,
              ...mine.map((r) => {
                const label = ROLE_META[r.requested_role]?.label ?? r.requested_role;
                const state = r.status === "pending" ? "masih menunggu keputusan admin"
                  : r.status === "approved" ? "sudah disetujui" : "diabaikan admin";
                return `Pengajuan peran ${label} ${state}.`;
              }),
            ),
        "Peran berlaku global untuk semua Ormawa Visit, dan hanya admin yang bisa menyetujuinya.",
      ),
    });
  }

  // ---- Super Link ----------------------------------------------------------

  if (links.length) {
    out.push({
      id: "live-links",
      source: "Data: Super Link",
      href: "/links",
      text: `Super Link ${event.title} berisi ${links.length} tautan: ${links.map((l) => l.name).join(", ")}.`,
    });

    for (const l of links) {
      out.push({
        id: `link-${l.id}`,
        parent: "live-links",
        source: `Super Link: ${l.name}`,
        href: "/links",
        text: sentence(
          `Tautan Super Link "${val(l.name, "tanpa nama")}" pada Ormawa Visit ${event.title}.`,
          l.section && `Kelompok: ${l.section}.`,
          l.division && `Divisi: ${divName(divisions, l.division)}.`,
          `URL: ${l.url}.`,
          l.note?.trim() && `Keterangan: ${l.note.trim()}.`,
        ),
      });
    }
  }

  return out;
}
