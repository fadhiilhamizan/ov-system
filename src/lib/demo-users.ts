import type { AppUser } from "./types";

// Shared demo identities (safe for client bundles - no secrets).
export const AUTH_COOKIE = "ov_demo_user";

export const DEMO_USERS: AppUser[] = [
  { id: "u-admin", name: "Fadhiil Akmal", email: "pic@ormawavisit.id", role: "admin", division: "PIC", avatarColor: "#6366f1" },
  { id: "u-coord", name: "Irhab Faiz", email: "koordinator@ormawavisit.id", role: "coordinator", division: "OPERATIONAL", avatarColor: "#64748b" },
  { id: "u-staff", name: "Crystal Reinheart", email: "staff@ormawavisit.id", role: "staff", division: "EVENT", avatarColor: "#10b981" },
  { id: "u-intern", name: "Athilah Syahshiyah", email: "intern@ormawavisit.id", role: "intern", division: "CREATIVE", avatarColor: "#d946ef" },
  { id: "u-guest", name: "Tamu", email: "tamu@ormawavisit.id", role: "guest", division: null, avatarColor: "#94a3b8" },
];
