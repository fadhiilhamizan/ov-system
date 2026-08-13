import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE, SIDEBAR_COLLAPSED } from "@/lib/ui-prefs";
import { getCurrentUser, USE_SUPABASE } from "@/lib/auth";
import { getActiveEvent } from "@/lib/session";
import { getEvents, getRoleRequestsFor } from "@/lib/data/repo";
import { DEMO_COOKIE, demoActive } from "@/lib/demo";
import { requestableRolesFor } from "@/lib/permissions";
import { violetConfigured } from "@/lib/violet/llm";
import type { RoleRequest } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Auth FIRST: getCurrentUser() redirects unauthenticated visitors to /login.
  // It must run before any data fetch - reads are RLS-gated, so an unauthed
  // request would otherwise get zero rows and crash on `activeEvent.id`
  // (rendering the error boundary instead of the login page).
  const user = await getCurrentUser();

  // Runs on every navigation - keep it light. The division focus filter now
  // lives in the Work Breakdown toolbar, so the shell no longer needs the
  // divisions list or the active division here.
  const activeEvent = await getActiveEvent();
  const [events, store] = await Promise.all([getEvents(), cookies()]);
  const sandboxMode = demoActive(store.get(DEMO_COOKIE)?.value);
  // Read the sidebar state server-side so the first paint already has the
  // right width (no expand-then-collapse flash).
  const sidebarCollapsed = store.get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;

  // Which roles this account may ask for (empty for admins, demo identities and
  // anonymous Tamu sessions - none of which pay for the lookup below).
  const roleOptions = sandboxMode ? [] : requestableRolesFor(user);
  const pendingRoleRequest: RoleRequest | null = roleOptions.length
    ? ((await getRoleRequestsFor(user.id)).find((r) => r.status === "pending") ?? null)
    : null;
  // Only accounts with NO role get nagged by the banner; those that already
  // have one change roles from the user menu instead.
  const showRoleBanner = roleOptions.length > 0 && user.role === "guest";

  return (
    <AppShell
      user={user}
      events={events}
      activeEventId={activeEvent.id}
      demoMode={!USE_SUPABASE}
      sandboxMode={sandboxMode}
      activeEventLocked={!!activeEvent.locked}
      defaultCollapsed={sidebarCollapsed}
      roleOptions={roleOptions}
      pendingRoleRequest={pendingRoleRequest}
      showRoleBanner={showRoleBanner}
      violetEnabled={violetConfigured()}
    >
      {children}
    </AppShell>
  );
}
