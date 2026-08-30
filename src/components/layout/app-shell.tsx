"use client";
import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";
import dynamic from "next/dynamic";
import { Logo } from "./logo";
import { DemoBanner } from "./demo-banner";
import { ArchiveBanner } from "./archive-banner";
import { RoleRequestBanner } from "@/components/roles/role-request-banner";
import { AnchorScroller } from "./anchor-scroller";
import { SessionBeacons } from "@/components/developer/session-beacons";
import type { AppUser, OVEvent, RequestableRole, RoleRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useModalLayer } from "@/lib/use-modal-layer";
import { useT } from "@/lib/i18n/provider";
import { APP_VERSION } from "@/lib/version";
import { SIDEBAR_COOKIE, SIDEBAR_COLLAPSED, SIDEBAR_EXPANDED } from "@/lib/ui-prefs";

/**
 * Loaded on demand, not with the shell.
 *
 * Violet drags its markdown parser, its link registry and the whole chat panel
 * into whatever bundle imports it. Statically imported here, that rode along
 * with the app shell on EVERY page - including for the many visitors who never
 * open it, and including when `violetEnabled` is false and the button does not
 * even render. `ssr: false` because the panel is pure client state (it has no
 * server-rendered content to match) and skipping it avoids a hydration pass for
 * something usually closed.
 */
const VioletChat = dynamic(
  () => import("@/components/violet/violet-chat").then((m) => m.VioletChat),
  { ssr: false },
);

export function AppShell({
  user,
  events,
  activeEventId,
  demoMode,
  sandboxMode,
  activeEventLocked = false,
  defaultCollapsed = false,
  roleOptions = [],
  pendingRoleRequest = null,
  showRoleBanner = false,
  violetEnabled = false,
  isDeveloper = false,
  beaconsEnabled = false,
  children,
}: {
  user: AppUser;
  events: OVEvent[];
  activeEventId: string;
  demoMode: boolean;
  sandboxMode: boolean;
  /** The active Ormawa Visit is archived - read-only for everyone but admin. */
  activeEventLocked?: boolean;
  defaultCollapsed?: boolean;
  /** Roles this account may request (empty = the flow doesn't apply to them). */
  roleOptions?: RequestableRole[];
  /** Their request awaiting an admin decision, if any. */
  pendingRoleRequest?: RoleRequest | null;
  /** Only role-less accounts get the banner; others use the user menu. */
  showRoleBanner?: boolean;
  /** The chat assistant only renders when a Gemini key is configured. */
  violetEnabled?: boolean;
  /** Adds the hidden Developer entry to the account menu, and captures this
   *  session's console for the in-app one. Almost always false. */
  isDeveloper?: boolean;
  /** Presence heartbeat + uncaught-error reporting. On for every real account,
   *  off for guests and demo mode (see SessionBeacons). */
  beaconsEnabled?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const closeDrawer = React.useCallback(() => setMobileOpen(false), []);
  const drawerRef = useModalLayer<HTMLElement>(mobileOpen, closeDrawer);
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  // While collapsed, pointing at the rail expands it temporarily (overlaying
  // the content) without changing the persisted state.
  const [peeking, setPeeking] = React.useState(false);
  const t = useT();

  // Persisted in a cookie (not localStorage) so the server can render the right
  // width on first paint - no flash of the wrong sidebar.
  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    setPeeking(false);
    const value = next ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
    document.cookie = `${SIDEBAR_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  const showWide = !collapsed || peeking;

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar - a rail when collapsed, expanding on hover. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border transition-[width] duration-200 ease-out lg:block",
          showWide ? "w-64" : "w-[68px]",
          collapsed && peeking && "shadow-2xl",
        )}
        onMouseEnter={() => collapsed && setPeeking(true)}
        onMouseLeave={() => setPeeking(false)}
      >
        <SidebarContent
          user={user}
          collapsed={!showWide}
          toggleCollapsed={collapsed}
          onToggle={toggleCollapsed}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-[overlay-in_0.2s_ease]"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            ref={drawerRef}
            // It behaves as a modal - the overlay swallows every click behind
            // it - so it has to say so, and then actually do it: trap Tab, close
            // on Escape, stop the page scrolling underneath, and hand focus back
            // to the hamburger on the way out. See lib/use-modal-layer.ts.
            role="dialog"
            aria-modal="true"
            aria-label={t("Menu navigasi")}
            className="absolute inset-y-0 left-0 w-72 border-r border-sidebar-border shadow-2xl animate-[fade-in_0.2s_ease]"
          >
            <button
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-sidebar-muted hover:bg-sidebar-accent"
              onClick={() => setMobileOpen(false)}
              aria-label={t("Tutup menu")}
            >
              <X className="size-5" />
            </button>
            <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main - padding follows the PERSISTED state only, so a hover-peek
          overlays the content instead of shoving it sideways. */}
      <div className={cn("transition-[padding] duration-200 ease-out", collapsed ? "lg:pl-[68px]" : "lg:pl-64")}>
        {sandboxMode && <DemoBanner />}
        {activeEventLocked && <ArchiveBanner isAdmin={user.role === "admin"} />}
        {showRoleBanner && roleOptions.length > 0 && (
          <RoleRequestBanner options={roleOptions} pending={pendingRoleRequest} />
        )}
        <Topbar
          user={user}
          events={events}
          activeEventId={activeEventId}
          demoMode={demoMode}
          sandboxMode={sandboxMode}
          roleOptions={roleOptions}
          pendingRoleRequest={pendingRoleRequest}
          isDeveloper={isDeveloper}
          onMenu={() => setMobileOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 lg:px-8">{children}</main>
        {/* Applies the URL's #anchor after a navigation, so a shortcut lands on
            its section instead of at the top of a long page. */}
        <AnchorScroller />
        {/* Renders nothing. Feeds the hidden Developer menu: who is online, and
            which errors real users are hitting. */}
        {(beaconsEnabled || isDeveloper) && (
          <SessionBeacons isDeveloper={isDeveloper} networkEnabled={beaconsEnabled} />
        )}
        {violetEnabled && <VioletChat />}
        <footer className="border-t border-border px-6 py-5">
          <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <div className="flex items-center gap-2">
              <Logo size={18} />
              <span>Ormawa Visit Management System - External Affairs HMSI ITS</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <Link href="/privacy" className="hover:text-foreground hover:underline">
                {t("Kebijakan Privasi")}
              </Link>
              <span aria-hidden className="text-border">·</span>
              <Link href="/terms" className="hover:text-foreground hover:underline">
                {t("Ketentuan Layanan")}
              </Link>
              <span aria-hidden className="text-border">·</span>
              <span>v{APP_VERSION}</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
