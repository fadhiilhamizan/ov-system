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
  coordinator: { label: "Koordinator", description: "Kelola divisi, tugas, rundown & anggaran", level: 4 },
  staff: { label: "Staff", description: "Update status & isi hasil tugasnya", level: 3 },
  intern: { label: "Intern", description: "Update status & isi hasil tugasnya", level: 2 },
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
 *  - "full" = bisa kelola penuh (buat/ubah/hapus entitas utama modul).
 *  - "view" = bisa membuka & melihat (kadang update progres/kontribusi ringan).
 *  - "none" = tidak punya akses sama sekali (modul tidak bisa dibuka).
 *  MODULE_ACCESS (yang menggerbang navigasi) diturunkan dari sini. */
export type AccessLevel = "full" | "view" | "none";

export const MODULE_ACCESS_LEVEL: Record<string, Record<Role, AccessLevel>> = {
  //             admin   coordinator  staff   intern  guest
  dashboard: { admin: "view", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  tasks: { admin: "full", coordinator: "full", staff: "view", intern: "view", guest: "view" },
  divisions: { admin: "full", coordinator: "full", staff: "view", intern: "view", guest: "view" },
  calendar: { admin: "view", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  rundown: { admin: "full", coordinator: "full", staff: "view", intern: "view", guest: "view" },
  jobs: { admin: "full", coordinator: "full", staff: "view", intern: "view", guest: "view" },
  prospects: { admin: "full", coordinator: "full", staff: "full", intern: "view", guest: "view" },
  links: { admin: "full", coordinator: "full", staff: "view", intern: "view", guest: "none" },
  budget: { admin: "full", coordinator: "full", staff: "none", intern: "none", guest: "none" },
  members: { admin: "full", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  events: { admin: "full", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  faq: { admin: "full", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  panduan: { admin: "view", coordinator: "view", staff: "view", intern: "view", guest: "view" },
  settings: { admin: "full", coordinator: "none", staff: "none", intern: "none", guest: "none" },
};

/** Which roles can OPEN which modules (route keys) — any level except "none".
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
