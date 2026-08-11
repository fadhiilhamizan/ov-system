import type { DivisionKey, Role, TaskStatus } from "./types";

export const STATUS_META: Record<
  TaskStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  todo: {
    label: "To Do",
    color: "text-slate-600 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-800/60",
    dot: "bg-status-todo",
  },
  ongoing: {
    label: "On Going",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-500/15",
    dot: "bg-status-ongoing",
  },
  done: {
    label: "Done",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
    dot: "bg-status-done",
  },
  overtime: {
    label: "Overtime",
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-100 dark:bg-red-500/15",
    dot: "bg-status-overtime",
  },
};

export const STATUS_ORDER: TaskStatus[] = ["todo", "ongoing", "overtime", "done"];

export const ROLE_META: Record<Role, { label: string; description: string; level: number }> = {
  admin: { label: "Admin / PIC", description: "Akses penuh ke semua fitur", level: 5 },
  coordinator: {
    label: "Koordinator",
    description: "Kelola Work Breakdown, Rundown, Hari-H & Super Link; menu lain hanya lihat",
    level: 4,
  },
  staff: {
    label: "Staff",
    description: "Buat, ubah & isi hasil di Work Breakdown, Rundown, Hari-H, Super Link (tanpa hapus)",
    level: 3,
  },
  intern: {
    label: "Intern",
    description: "Buat, ubah & isi hasil di Work Breakdown, Rundown, Hari-H, Super Link (tanpa hapus)",
    level: 2,
  },
  guest: { label: "Tamu", description: "Hanya melihat", level: 1 },
};

export const ROLE_ORDER: Role[] = ["admin", "coordinator", "staff", "intern", "guest"];

/** Prospect pipeline stages derived from contact/response fields. */
export const PIPELINE_STAGES = [
  { key: "belum", label: "Belum dihubungi", color: "#94a3b8" },
  { key: "proses", label: "Dalam proses", color: "#0ea5e9" },
  { key: "menunggu", label: "Menunggu jawaban", color: "#f59e0b" },
  { key: "diterima", label: "Diterima", color: "#10b981" },
  { key: "ditolak", label: "Ditolak", color: "#ef4444" },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["key"];

export function prospectStage(p: {
  contact_status: string;
  their_response: string;
  our_response: string;
}): PipelineStage {
  const resp = `${p.their_response} ${p.our_response}`.toUpperCase();
  if (resp.includes("TERIMA")) return "diterima";
  if (resp.includes("TOLAK")) return "ditolak";
  if (resp.includes("TUNGGU")) return "menunggu";
  if (p.contact_status) return "proses";
  return "belum";
}

/** Per-module, per-role access LEVEL used by the settings matrix.
 *  - "full"    = kelola penuh (buat / ubah / isi hasil / HAPUS).
 *  - "limited" = buat, ubah & isi hasil, TAPI tidak boleh menghapus.
 *  - "view"    = hanya membuka & melihat.
 *  - "none"    = tidak punya akses sama sekali (modul tidak bisa dibuka).
 *  MODULE_ACCESS (yang menggerbang navigasi) diturunkan dari sini. */
export type AccessLevel = "full" | "limited" | "view" | "none";

/** Ordering used by `atLeast()` - a higher level implies every lower one. */
export const ACCESS_RANK: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  limited: 2,
  full: 3,
};

export const ACCESS_LEVEL_META: Record<AccessLevel, { label: string; description: string }> = {
  full: { label: "Akses penuh (kelola)", description: "Buat, ubah, isi hasil, dan hapus." },
  limited: {
    label: "Akses terbatas",
    description: "Buat, ubah, dan isi hasil - tidak bisa menghapus.",
  },
  view: { label: "Hanya lihat", description: "Bisa membuka dan melihat isinya saja." },
  none: { label: "Tidak ada akses", description: "Modul tidak bisa dibuka." },
};

export const MODULE_ACCESS_LEVEL: Record<string, Record<Role, AccessLevel>> = {
  //             admin   coordinator  staff   intern  guest
  dashboard: { admin: "view", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  tasks: { admin: "full", coordinator: "full", staff: "limited", intern: "limited", guest: "view" },
  divisions: { admin: "full", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  calendar: { admin: "view", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  rundown: { admin: "full", coordinator: "full", staff: "limited", intern: "limited", guest: "view" },
  jobs: { admin: "full", coordinator: "full", staff: "limited", intern: "limited", guest: "view" },
  prospects: { admin: "full", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  links: { admin: "full", coordinator: "full", staff: "limited", intern: "limited", guest: "none" },
  budget: { admin: "full", coordinator: "view", staff: "view", intern: "view", guest: "none" },
  members: { admin: "full", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  events: { admin: "full", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  faq: { admin: "full", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  panduan: { admin: "view", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  roles: { admin: "full", coordinator: "none", staff: "none", intern: "none", guest: "none" },
  // Tamu boleh MEMBUKA Pengaturan (matriks akses, changelog, arsip spreadsheet,
  // versi) tapi tidak boleh menyentuh apa pun di sana. Kartu yang destruktif -
  // Backup & Rollback, Reset Data Demo - punya pemeriksaan `can.manageBackups`
  // sendiri, bukan hanya bergantung pada level modul ini.
  settings: { admin: "full", coordinator: "view", staff: "view", intern: "view", guest: "view" },
};

/** Which roles can OPEN which modules (route keys) - any level except "none".
 *  Derived from MODULE_ACCESS_LEVEL so the two never drift apart. */
export const MODULE_ACCESS: Record<string, Role[]> = Object.fromEntries(
  Object.entries(MODULE_ACCESS_LEVEL).map(([key, byRole]) => [
    key,
    (Object.keys(byRole) as Role[]).filter((r) => byRole[r] !== "none"),
  ]),
);

export const DIVISION_ICON: Record<DivisionKey, string> = {
  PIC: "crown",
  COORDINATOR: "git-branch",
  SECRETARY: "notebook-pen",
  TREASURER: "wallet",
  LO: "radio",
  EVENT: "calendar-check",
  CONSUMPTION: "utensils",
  OPERATIONAL: "package",
  CREATIVE: "palette",
  MARKETING: "megaphone",
  OUTSOURCE: "handshake",
};
