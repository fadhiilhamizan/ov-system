// ============================================================
// Ormawa Visit "Demo" edition — a protected sandbox.
//
// The demo edition (id = "ov-demo") is seeded with mockup data so users can
// explore freely. It CANNOT be deleted, and it can be reset back to its
// original mockup at any time (Settings → "Reset Data Demo"). Every mutation
// is event-scoped, so playing in the demo never touches real Ormawa Visit
// data. See src/lib/seed/demo-seed.ts (data) and resetDemoData() in repo.ts.
//
// This module is intentionally dependency-free (no seed import) so it can be
// used from client components without bloating the bundle.
// ============================================================

export const DEMO_EVENT_ID = "ov-demo";

export function isDemoEvent(id: string | null | undefined): boolean {
  return id === DEMO_EVENT_ID;
}
