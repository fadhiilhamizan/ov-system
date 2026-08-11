import type { AppUser } from "./types";

// Shared demo identities (safe for client bundles - no secrets).
export const AUTH_COOKIE = "ov_demo_user";

// In the demo sandbox the identity IS the role, so name each user after the
// role it represents (not a real person). No division: an account never carries
// one - see AppUser in types.ts.
export const DEMO_USERS: AppUser[] = [
  { id: "u-admin", name: "Admin", email: "pic@ormawavisit.id", role: "admin", avatarColor: "#6366f1" },
  { id: "u-coord", name: "Koordinator", email: "koordinator@ormawavisit.id", role: "coordinator", avatarColor: "#64748b" },
  { id: "u-staff", name: "Staff", email: "staff@ormawavisit.id", role: "staff", avatarColor: "#10b981" },
  { id: "u-intern", name: "Intern", email: "intern@ormawavisit.id", role: "intern", avatarColor: "#d946ef" },
  { id: "u-guest", name: "Tamu", email: "tamu@ormawavisit.id", role: "guest", avatarColor: "#94a3b8" },
];
