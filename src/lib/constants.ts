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
  admin: { label: "Admin / PIC OV", description: "Akses penuh ke seluruh sistem", level: 5 },
  coordinator: { label: "Koordinator", description: "Kelola divisi & tugas divisinya", level: 4 },
  staff: { label: "Staff (Fungsionaris)", description: "Edit tugas yang ditugaskan", level: 3 },
  intern: { label: "Intern", description: "Update Result & Status tugasnya", level: 2 },
  viewer: { label: "Viewer", description: "Hanya melihat (read-only)", level: 1 },
};

export const ROLE_ORDER: Role[] = ["admin", "coordinator", "staff", "intern", "viewer"];

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

/** Which roles can access which modules (route keys). */
export const MODULE_ACCESS: Record<string, Role[]> = {
  dashboard: ["admin", "coordinator", "staff", "intern", "viewer"],
  tasks: ["admin", "coordinator", "staff", "intern", "viewer"],
  divisions: ["admin", "coordinator", "staff", "intern", "viewer"],
  prospects: ["admin", "coordinator", "staff", "viewer"],
  budget: ["admin", "coordinator", "viewer"],
  links: ["admin", "coordinator", "staff", "intern", "viewer"],
  calendar: ["admin", "coordinator", "staff", "intern", "viewer"],
  rundown: ["admin", "coordinator", "staff", "intern", "viewer"],
  members: ["admin", "coordinator", "staff", "intern", "viewer"],
  jobs: ["admin", "coordinator", "staff", "intern", "viewer"],
  faq: ["admin", "coordinator", "staff", "intern", "viewer"],
  events: ["admin", "coordinator", "viewer"],
  settings: ["admin"],
};

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
