"use client";
import * as React from "react";
import { X } from "lucide-react";
import { SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";
import { Logo } from "./logo";
import { DemoBanner } from "./demo-banner";
import type { AppUser, OVEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { APP_VERSION } from "@/lib/version";

export function AppShell({
  user,
  events,
  activeEventId,
  demoMode,
  sandboxMode,
  children,
}: {
  user: AppUser;
  events: OVEvent[];
  activeEventId: string;
  demoMode: boolean;
  sandboxMode: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const t = useT();

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border lg:block">
        <SidebarContent user={user} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-[overlay-in_0.2s_ease]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-sidebar-border shadow-2xl animate-[fade-in_0.2s_ease]">
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

      {/* Main */}
      <div className={cn("lg:pl-64")}>
        {sandboxMode && <DemoBanner />}
        <Topbar
          user={user}
          events={events}
          activeEventId={activeEventId}
          demoMode={demoMode}
          sandboxMode={sandboxMode}
          onMenu={() => setMobileOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 lg:px-8">{children}</main>
        <footer className="border-t border-border px-6 py-5">
          <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <div className="flex items-center gap-2">
              <Logo size={18} />
              <span>Ormawa Visit Management System - External Affairs HMSI ITS</span>
            </div>
            <span>Dibangun dari Main Sheet OV · v{APP_VERSION}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
