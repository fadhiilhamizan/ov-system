import "server-only";
import { GUIDE } from "@/lib/guide";
import { CHANGELOG } from "@/lib/changelog";
import { MODULE_ACCESS_LEVEL, ROLE_META, ROLE_ORDER, STATUS_META } from "@/lib/constants";
import { NAV } from "@/components/layout/nav-config";
import {
  getFaqs, getEvents, getDivisions, getTasks, getProspects, getLinks,
  getRundown, getJobs, getBudgetPlans, getMembers,
} from "@/lib/data/repo";
import { getActiveEvent } from "@/lib/session";
import { formatDate, formatRupiah } from "@/lib/format";
import type { AppUser } from "@/lib/types";
import type { Passage } from "./retrieve";
import { guideHref, resolveHref } from "./links";

// ============================================================
// Violet's knowledge base: THIS system and nothing else.
//
// Two kinds of passage:
//   * Documentation that ships with the app (Panduan, FAQ, the access matrix,
//     the changelog). Static, identical for everyone.
//   * A snapshot of the ACTIVE Ormawa Visit's data, so Violet can answer
//     "how many tasks are overdue" rather than only "what is a task".
//
// PRIVACY: every read goes through the repo, which goes through the caller's
// own Supabase session, so RLS applies. A Tamu asking about the roster gets an
// empty list from the database, not a leak. The roster passage is additionally
// skipped for roles that cannot read it, so Violet does not even hint at names
// it is not allowed to show.
// ============================================================

/** Roles allowed to see the roster (names + NRP are PII, see migration 0034). */
const CAN_SEE_ROSTER = new Set(["admin", "coordinator", "staff", "intern"]);

function guidePassages(): Passage[] {
  return GUIDE.flatMap((s) => {
    const parts = [
      s.purpose.id,
      ...s.steps.map((x) => x.id),
      ...(s.tips ?? []).map((x) => x.id),
      s.access ? `Hak akses: ${s.access.id}` : "",
    ].filter(Boolean);
    // One passage per section rather than per line: a step in isolation loses
    // the menu it belongs to, and the retriever already scores on the source.
    return [{
      id: `guide-${s.key}`,
      source: `Panduan: ${s.title.id}`,
      // Was `/${s.key}`, which produced /violet: a guide section is not always
      // a menu. `guideHref` returns the menu when there is one and the anchored
      // guide section when there is not.
      href: guideHref(s.key),
      text: parts.join(" "),
    }];
  });
}

/**
 * What Violet itself can do.
 *
 * "Apa saja yang bisa kamu lakukan?" is the first thing almost everybody asks,
 * and it used to retrieve NOTHING: every content word in it is a stop word
 * except "lakukan", which appeared in no passage, so the most common opening
 * question got the "I do not know" fallback. This passage is deliberately
 * padded with the ways people phrase it (bisa apa, kemampuan, fitur, bantu,
 * gunanya, what can you do) so the retriever finds it however it is asked.
 */
function selfPassage(): Passage {
  return {
    id: "violet-self",
    source: "Tentang Violet",
    href: "/panduan#guide-violet",
    text:
      "Violet bisa apa saja, kemampuan Violet, fitur Violet, gunanya Violet, apa yang bisa Violet lakukan, " +
      "what can you do, capabilities. " +
      "Violet adalah asisten chat untuk Ormawa Visit Management System. Yang bisa Violet lakukan: " +
      "(1) menjelaskan cara memakai sistem, fungsi tiap menu, dan aturan hak akses tiap peran; " +
      "(2) menjawab pertanyaan tentang data Ormawa Visit yang sedang dibuka, misalnya jumlah tugas, tugas yang overtime, " +
      "daftar divisi, rundown, anggaran, prospek himpunan, dan pembagian tugas hari-H, sebatas hak akses penanya; " +
      "(3) memberi pintasan ke menu atau bagian halaman yang dimaksud, dan halamannya langsung tergulir ke sana; " +
      "(4) merangkum isi Panduan, FAQ, dan changelog versi terbaru. " +
      "Yang TIDAK bisa Violet lakukan: mengubah, membuat, atau menghapus data apa pun (Violet hanya membaca), " +
      "menjawab hal di luar sistem ini, dan menampilkan data yang tidak boleh dilihat oleh peran penanya. " +
      "Cara memakai: Enter untuk mengirim, Shift+Enter untuk baris baru, Esc untuk menutup panel, " +
      "ikon tong sampah untuk membersihkan percakapan, dan tombol Salin untuk menyalin jawaban. " +
      "Percakapan tidak disimpan dan hilang saat panel ditutup atau halaman dimuat ulang.",
  };
}

function accessPassages(): Passage[] {
  const modules = NAV.flatMap((g) => g.items);
  const perModule = modules.map((m) => {
    const row = MODULE_ACCESS_LEVEL[m.key];
    if (!row) return null;
    const label = (lvl: string) =>
      lvl === "full" ? "akses penuh (buat, ubah, hapus)"
        : lvl === "limited" ? "akses terbatas (buat & ubah, tidak boleh hapus)"
          : lvl === "view" ? "hanya lihat" : "tidak ada akses";
    const parts = ROLE_ORDER.map((r) => `${ROLE_META[r].label}: ${label(row[r])}`);
    return {
      id: `access-${m.key}`,
      source: `Hak akses menu ${m.label}`,
      // The matrix that answers this lives inside Pengaturan, not on the menu
      // being asked about.
      href: "/settings#akses",
      text: `Hak akses untuk menu ${m.label}. ${parts.join(". ")}.`,
    };
  }).filter(Boolean) as Passage[];

  const roles: Passage = {
    id: "access-roles",
    source: "Peran & hak akses",
    href: "/settings#akses",
    text:
      `Peran di sistem ini: ${ROLE_ORDER.map((r) => `${ROLE_META[r].label} (${ROLE_META[r].description})`).join("; ")}. ` +
      "Peran berlaku global untuk SEMUA Ormawa Visit, tidak terikat divisi atau edisi tertentu. " +
      "Akun baru otomatis jadi Tamu dan harus mengajukan peran lewat menu akun, lalu disetujui admin di menu Role Request.",
  };
  return [roles, ...perModule];
}

function changelogPassages(): Passage[] {
  // Only the recent ones: older releases mostly describe behaviour that has
  // since changed again, which is worse than no answer.
  return CHANGELOG.slice(0, 8).map((e) => ({
    id: `changelog-${e.version}`,
    source: `Changelog v${e.version}`,
    // Anchored: Pengaturan is a long page and the changelog sits at the bottom
    // of it, so the bare path would land the reader nowhere near the answer.
    href: "/settings#changelog",
    text: `Versi ${e.version} (${e.date}): ${e.title}. ${e.changes.map((c) => c.text).join(" ")}`,
  }));
}

/** A snapshot of the Ormawa Visit currently on screen. */
async function livePassages(user: AppUser): Promise<Passage[]> {
  const event = await getActiveEvent();
  if (!event?.id) return [];

  const [events, divisions, tasks, prospects, links, rundown, jobs, plans] = await Promise.all([
    getEvents(), getDivisions(event.id), getTasks({ event_id: event.id }),
    getProspects(event.id), getLinks(event.id), getRundown(event.id, "A"),
    getJobs(event.id), getBudgetPlans(event.id),
  ]);

  const out: Passage[] = [];

  out.push({
    id: "live-events",
    source: "Data: Daftar Ormawa Visit",
    href: "/events",
    text:
      `Ada ${events.length} Ormawa Visit di sistem: ${events.map((e) => `${e.title}${e.locked ? " (diarsipkan)" : ""}`).join(", ")}. ` +
      `Yang sedang dibuka sekarang: ${event.title}${event.partner ? `, partner ${event.partner}` : ""}` +
      `${event.event_date ? `, tanggal acara ${formatDate(event.event_date, { long: true })}` : ""}.`,
  });

  const byStatus = { todo: 0, ongoing: 0, done: 0, overtime: 0 } as Record<string, number>;
  for (const t of tasks) byStatus[t.status]++;
  const overdue = tasks.filter((t) => t.status === "overtime");
  out.push({
    id: "live-tasks",
    source: "Data: Work Breakdown",
    href: "/tasks",
    text:
      `Ormawa Visit ${event.title} punya ${tasks.length} tugas: ` +
      `${Object.entries(byStatus).map(([k, v]) => `${STATUS_META[k as keyof typeof STATUS_META]?.label ?? k} ${v}`).join(", ")}. ` +
      (overdue.length
        ? `Tugas overtime (lewat deadline dan belum selesai): ${overdue.map((t) => `${t.title}${t.pic ? ` (PIC ${t.pic})` : ""}`).join("; ")}.`
        : "Tidak ada tugas yang overtime."),
  });

  out.push({
    id: "live-divisions",
    source: "Data: Divisi",
    href: "/members",
    text:
      `Divisi pada ${event.title}: ${divisions.map((d) => `${d.name} (${d.short})`).join(", ") || "belum ada"}. ` +
      `Divisi yang tidak diikutsertakan pada rundown: ${divisions.filter((d) => d.exclude_from_rundown).map((d) => d.name).join(", ") || "tidak ada"}.`,
  });

  if (CAN_SEE_ROSTER.has(user.role)) {
    const members = await getMembers(event.id);
    if (members.length) {
      out.push({
        id: "live-members",
        source: "Data: Anggota EA",
        href: "/members",
        text:
          `Ada ${members.length} anggota pada ${event.title}: ` +
          `${members.filter((m) => m.type === "fungsionaris").length} fungsionaris, ` +
          `${members.filter((m) => m.type === "intern").length} intern. ` +
          `Nama: ${members.map((m) => m.name).join(", ")}.`,
      });
    }
  }

  if (prospects.length) {
    out.push({
      id: "live-prospects",
      source: "Data: Reach & Offer",
      href: "/prospects",
      text:
        `Ada ${prospects.length} prospek himpunan pada ${event.title}. ` +
        `${prospects.map((p) => `${p.org_name || "(tanpa nama)"}${p.campus ? ` dari ${p.campus}` : ""}${p.their_response ? `, respons ${p.their_response}` : ""}`).join("; ")}.`,
    });
  }

  if (rundown.length) {
    out.push({
      id: "live-rundown",
      source: "Data: Rundown",
      href: "/rundown",
      text:
        `Rundown ${event.title} punya ${rundown.length} sesi: ` +
        `${rundown.map((r) => `${r.time_start || "?"}-${r.time_end || "?"} ${r.activity}`).join("; ")}.`,
    });
  }

  if (jobs.length) {
    out.push({
      id: "live-jobs",
      source: "Data: Job Hari-H",
      href: "/jobs",
      text: `Pembagian tugas hari-H: ${jobs.map((j) => `${j.job}${j.pic ? ` (${j.pic})` : ""}`).join("; ")}.`,
    });
  }

  if (plans.length) {
    const grand = plans.reduce((s, p) => s + p.items.reduce((a, i) => a + (i.total ?? 0), 0), 0);
    out.push({
      id: "live-budget",
      source: "Data: Anggaran",
      href: "/budget",
      text:
        `Anggaran ${event.title}: ${plans.length} rencana, total ${formatRupiah(grand)}. ` +
        `${plans.map((p) => `${p.name} (${p.items.length} item)`).join(", ")}.`,
    });
  }

  if (links.length) {
    out.push({
      id: "live-links",
      source: "Data: Super Link",
      href: "/links",
      text: `Super Link ${event.title} berisi ${links.length} tautan: ${links.map((l) => l.name).join(", ")}.`,
    });
  }

  return out;
}

async function faqPassages(): Promise<Passage[]> {
  const faqs = await getFaqs();
  return faqs.map((f, i) => ({
    id: `faq-${f.id || i}`,
    source: "FAQ",
    href: "/faq",
    text: `${f.question} ${f.answer}`,
  }));
}

/**
 * Everything Violet is allowed to know, for this caller.
 *
 * Rebuilt per question rather than cached: the live half changes on every
 * write, and a stale answer about "how many tasks are left" is worse than a
 * slightly slower one.
 */
export async function buildCorpus(user: AppUser): Promise<Passage[]> {
  const [faqs, live] = await Promise.all([faqPassages(), livePassages(user)]);
  const all = [
    selfPassage(), ...guidePassages(), ...accessPassages(), ...faqs,
    ...changelogPassages(), ...live,
  ];
  // One last sweep so a passage can never carry a shortcut to a page that does
  // not exist, however it was built. A missing link is fine; a broken one is
  // what made a user distrust the whole assistant.
  return all.map((p) => ({ ...p, href: resolveHref(p.href) }));
}
